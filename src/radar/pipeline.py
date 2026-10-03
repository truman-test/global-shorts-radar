"""Orchestration: wires collectors -> storage -> metrics -> judgments -> scoring.

Each step reads its inputs from the database and writes its outputs back, so steps can be
re-run independently (e.g. re-score with new weights without touching the API).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from radar.analysis import heuristic, korea_gap
from radar.analysis.judgments import resolve
from radar.collectors.youtube import QuotaBudgetError, QuotaExceededError, YouTubeAPIError

QUOTA_ERRORS = (QuotaBudgetError, QuotaExceededError)
from radar.metrics import compute as m
from radar.scoring.radar import compute_score, normalize_outlier, normalize_velocity

log = logging.getLogger("radar")


@dataclass
class CollectSummary:
    run_id: int
    searches: int = 0
    candidates: int = 0
    channels: int = 0
    baseline_videos: int = 0
    quota_used: int = 0
    errors: list[str] = field(default_factory=list)


def collect(client, db, settings, now: datetime, mode: str) -> CollectSummary:
    now_iso = m.to_iso(now)
    run_id = db.start_run(now_iso, mode)
    client.raw_sink = lambda endpoint, params, data: db.save_raw(run_id, endpoint, params, now_iso, data)
    summary = CollectSummary(run_id=run_id)
    published_after = m.to_iso(now - timedelta(hours=settings.published_within_hours))

    try:
        # 1. Discover candidates via search (100 units per call).
        discovered: list[str] = []
        for region in settings.regions:
            for keyword in settings.keywords:
                try:
                    resp = client.search_shorts(keyword, region_code=region, published_after=published_after,
                                                max_results=settings.max_results_per_query)
                except QUOTA_ERRORS:
                    raise
                except YouTubeAPIError as exc:
                    summary.errors.append(f"search '{keyword}' ({region}): {exc}")
                    continue
                summary.searches += 1
                for item in resp.get("items", []):
                    vid = item.get("id", {}).get("videoId")
                    if vid:
                        db.add_discovery(vid, run_id, keyword, region, now_iso)
                        discovered.append(vid)
        discovered = list(dict.fromkeys(discovered))

        # 2. Observed stats for candidates.
        items = client.videos(discovered) if discovered else []
        for item in items:
            db.upsert_video(item, now_iso)
        summary.candidates = len(items)

        # 3. Channels + recent uploads for the outlier baseline.
        channel_ids = list(dict.fromkeys(i["snippet"]["channelId"] for i in items))
        for ch in client.channels(channel_ids) if channel_ids else []:
            db.upsert_channel(ch, now_iso)
            summary.channels += 1
            uploads = ch.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
            if not uploads:
                continue
            try:
                recent = client.recent_upload_ids(uploads, settings.recent_uploads_per_channel)
            except QUOTA_ERRORS:
                raise
            except YouTubeAPIError as exc:
                summary.errors.append(f"uploads for {ch['id']}: {exc}")
                continue
            fresh_ids = [v for v in recent if v not in discovered]
            for item in client.videos(fresh_ids) if fresh_ids else []:
                db.upsert_video(item, now_iso)
                summary.baseline_videos += 1
    except QUOTA_ERRORS as exc:
        summary.errors.append(f"stopped early, partial data kept: {exc}")
        log.warning("stopped collection on quota limit; partial data kept")
    finally:
        summary.quota_used = client.quota.used
        db.finish_run(run_id, summary.quota_used, "; ".join(summary.errors))
    return summary


def compute_metrics(db, settings, now: datetime, run_id: int | None = None) -> int:
    now_iso = m.to_iso(now)
    count = 0
    for vid in db.candidate_ids(run_id):
        video = db.video(vid)
        snap = db.latest_snapshot(vid)
        if video is None or snap is None:
            continue
        duration = m.parse_iso_duration(video["duration_iso"])
        # Rates and baselines are measured at observation time, so re-running compute later
        # does not distort them. Freshness is measured at decision time (`now`).
        observed_at = m.parse_ts(snap["fetched_at"])
        hours = m.hours_since(video["published_at"], observed_at)
        baseline, size, kind = m.channel_baseline(
            vid, [dict(r) for r in db.channel_videos_with_latest_views(video["channel_id"])], observed_at,
            settings.max_short_seconds, settings.baseline_min_age_hours,
            settings.recent_uploads_per_channel, settings.min_baseline_videos,
        )
        db.save_metrics({
            "video_id": vid,
            "computed_at": now_iso,
            "metric_version": m.METRIC_VERSION,
            "snapshot_fetched_at": snap["fetched_at"],
            "duration_seconds": duration,
            "is_short": int(m.is_short(duration, settings.max_short_seconds)),
            "hours_since_publish": round(hours, 2),
            "views_per_hour": m.views_per_hour(snap["view_count"], hours),
            "channel_median_views": baseline,
            "baseline_size": size,
            "baseline_kind": kind,
            "outlier_ratio": m.outlier_ratio(snap["view_count"], baseline),
            "engagement_rate": m.engagement_rate(snap["view_count"], snap["like_count"], snap["comment_count"]),
            "freshness": m.freshness(m.hours_since(video["published_at"], now), settings.freshness_half_life_hours),
        })
        db.ensure_verification(vid, now_iso)
        count += 1
    return count


def short_candidates(db, run_id: int | None = None) -> list[str]:
    out = []
    for vid in db.candidate_ids(run_id):
        met = db.latest_metrics(vid)
        if met is not None and met["is_short"]:
            out.append(vid)
    return out


def run_heuristics(db, settings, now: datetime, run_id: int | None = None) -> int:
    now_iso = m.to_iso(now)
    n = 0
    for vid in short_candidates(db, run_id):
        video = db.video(vid)
        existing = {(j["dimension"], j["source"]) for j in db.judgments(vid)}
        for j in heuristic.heuristic_judgments(video["title"] or "", video["description"] or "", settings):
            if (j.dimension, j.source) in existing:
                continue  # heuristics are deterministic; don't duplicate rows on re-runs
            db.add_judgment(vid, j.dimension, j.value, j.source, now_iso, rationale=j.rationale)
            n += 1
    return n


def run_korea_gap(client, db, settings, now: datetime, top_n: int, run_id: int | None = None) -> list[str]:
    """Measure KR saturation for the current top-N candidates. Returns log lines."""
    now_iso = m.to_iso(now)
    published_after = m.to_iso(now - timedelta(days=30))
    ranked = ranked_candidates(db, run_id)[:top_n]
    lines = []
    for row in ranked:
        vid = row["video_id"]
        try:
            res = korea_gap.check_korea_gap(client, db.video(vid)["title"] or "", settings.korean_terms, published_after)
        except YouTubeAPIError as exc:
            lines.append(f"{vid}: korea gap skipped ({exc})")
            if isinstance(exc, QUOTA_ERRORS):
                break
            continue
        if res.value is not None:
            db.add_judgment(vid, "korea_localization_gap", res.value, korea_gap.SOURCE, now_iso, rationale=res.rationale)
        lines.append(f"{vid}: {res.rationale}")
    return lines


def score_candidates(db, settings, now: datetime, run_id: int | None = None) -> int:
    now_iso = m.to_iso(now)
    n = 0
    for vid in short_candidates(db, run_id):
        met = db.latest_metrics(vid)
        signals = {
            "outlier_ratio": (normalize_outlier(met["outlier_ratio"], settings.outlier_cap), "derived:metrics"),
            "view_velocity": (normalize_velocity(met["views_per_hour"], settings.velocity_cap), "derived:metrics"),
            "freshness": (met["freshness"], "derived:metrics"),
        }
        for dim, j in resolve(db.judgments(vid)).items():
            signals[dim] = (j["value"], j["source"])
        result = compute_score(signals, settings.weights)
        db.save_score(vid, now_iso, settings.weights_version, result.radar_score,
                      result.available_weight, result.components, result.missing)
        n += 1
    return n


def ranked_candidates(db, run_id: int | None = None) -> list[dict]:
    rows = []
    for vid in short_candidates(db, run_id):
        score = db.latest_score(vid)
        if score is not None:
            rows.append({"video_id": vid, "radar_score": score["radar_score"]})
    rows.sort(key=lambda r: (-r["radar_score"], r["video_id"]))
    return rows
