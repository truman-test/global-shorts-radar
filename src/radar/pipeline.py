"""Orchestration: wires collectors -> storage -> metrics -> judgments -> scoring.

Each step reads its inputs from the database and writes its outputs back, so steps can be
re-run independently (e.g. re-score with new weights without touching the API).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from radar.analysis import heuristic, korea_gap
from radar.analysis.cluster import cluster_titles, generic_tokens
from radar.analysis.judgments import resolve
from radar.collectors.youtube import QuotaBudgetError, QuotaExceededError, YouTubeAPIError
from radar.metrics import compute as m
from radar.scoring.radar import compute_score, normalize_outlier, normalize_velocity

log = logging.getLogger("radar")

QUOTA_ERRORS = (QuotaBudgetError, QuotaExceededError)


def window_start(db, settings, anchor: datetime | None = None) -> str | None:
    """Start of the candidate window: `candidate_window_hours` before the anchor.

    The anchor defaults to the latest run's observation time (not the wall clock), so a report
    generated days after the last collection still shows that collection's candidates.
    """
    if anchor is None:
        latest = db.latest_run_started_at()
        if latest is None:
            return None
        anchor = m.parse_ts(latest)
    return m.to_iso(anchor - timedelta(hours=settings.candidate_window_hours))


@dataclass
class CollectSummary:
    run_id: int
    searches: int = 0
    candidates: int = 0
    channels: int = 0
    baseline_videos: int = 0
    refreshed: int = 0
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
                    resp = client.search_shorts(keyword, region_code=region, relevance_language=settings.relevance_language,
                                                published_after=published_after,
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

        # 2. Observed stats for new hits plus earlier candidates still in the window, so every
        #    tracked candidate gets a fresh snapshot (videos.list: 1 unit per 50 ids).
        previous = [v for v in db.candidate_ids(window_start(db, settings, now)) if v not in discovered]
        items = client.videos(discovered + previous) if (discovered or previous) else []
        for item in items:
            db.upsert_video(item, now_iso)
        new_items = [i for i in items if i["id"] not in previous]
        summary.candidates = len(new_items)
        summary.refreshed = len(items) - len(new_items)

        # 3. Channels + recent uploads for the outlier baseline (new hits only; earlier
        #    candidates' channels were sampled when they were discovered).
        channel_ids = list(dict.fromkeys(i["snippet"]["channelId"] for i in new_items))
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


def track(client, db, settings, now: datetime, mode: str) -> CollectSummary:
    """Re-observe candidates in the window without searching (no 100-unit calls).

    Each call appends a snapshot per video; repeated tracking enables velocity_trend.
    """
    now_iso = m.to_iso(now)
    ids = db.candidate_ids(window_start(db, settings, now))
    run_id = db.start_run(now_iso, f"{mode}-track")
    client.raw_sink = lambda endpoint, params, data: db.save_raw(run_id, endpoint, params, now_iso, data)
    summary = CollectSummary(run_id=run_id)
    try:
        for item in client.videos(ids) if ids else []:
            db.upsert_video(item, now_iso)
            summary.refreshed += 1
    except QUOTA_ERRORS as exc:
        summary.errors.append(f"stopped early, partial data kept: {exc}")
    finally:
        summary.quota_used = client.quota.used
        db.finish_run(run_id, summary.quota_used, "; ".join(summary.errors))
    return summary


def _candidates(db, settings, since: str | None) -> list[str]:
    return db.candidate_ids(since if since is not None else window_start(db, settings))


def compute_metrics(db, settings, now: datetime, since: str | None = None) -> int:
    now_iso = m.to_iso(now)
    count = 0
    for vid in _candidates(db, settings, since):
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
            **_trend_columns(db.snapshots(vid), video["published_at"]),
        })
        db.ensure_verification(vid, now_iso)
        count += 1
    return count


def _trend_columns(snapshots, published_at: str) -> dict:
    trend = m.velocity_trend([dict(r) for r in snapshots], published_at) or {}
    return {
        "recent_views_per_hour": trend.get("recent_views_per_hour"),
        "velocity_ratio": trend.get("velocity_ratio"),
        "trend_window_hours": trend.get("trend_window_hours"),
        "snapshot_count": len(snapshots),
    }


def short_candidates(db, settings, since: str | None = None) -> list[str]:
    """Candidates that are Shorts and not excluded by channel country (opt-in config).

    Channels without an observed country are always kept.
    """
    excluded = db.video_ids_by_channel_country(settings.exclude_channel_countries)
    out = []
    for vid in _candidates(db, settings, since):
        if vid in excluded:
            continue
        met = db.latest_metrics(vid)
        if met is not None and met["is_short"]:
            out.append(vid)
    return out


def run_heuristics(db, settings, now: datetime, since: str | None = None) -> int:
    now_iso = m.to_iso(now)
    n = 0
    for vid in short_candidates(db, settings, since):
        video = db.video(vid)
        existing = {(j["dimension"], j["source"]) for j in db.judgments(vid)}
        for j in heuristic.heuristic_judgments(video["title"] or "", video["description"] or "", settings):
            if (j.dimension, j.source) in existing:
                continue  # heuristics are deterministic; don't duplicate rows on re-runs
            db.add_judgment(vid, j.dimension, j.value, j.source, now_iso, rationale=j.rationale)
            n += 1
    return n


def korea_gap_targets(db, settings, top_n: int, since: str | None = None) -> list[str]:
    """Top-N *stories*: one video per title cluster, so one event is not checked (and paid for) N times."""
    items = []
    for row in ranked_candidates(db, settings, since):
        video = db.video(row["video_id"])
        items.append((row["video_id"], video["title"] if video else None, video["channel_id"] if video else None))
    ignore = generic_tokens(settings.keywords, *settings.topic_lexicon.values(),
                            settings.universal_terms, settings.region_specific_terms)
    return [c.leader for c in cluster_titles(items, ignore_tokens=ignore)][:top_n]


def run_korea_gap(client, db, settings, now: datetime, top_n: int, since: str | None = None) -> list[str]:
    """Measure KR saturation for the top-N stories (~101 units each). Returns log lines."""
    now_iso = m.to_iso(now)
    published_after = m.to_iso(now - timedelta(days=30))
    lines = []
    for vid in korea_gap_targets(db, settings, top_n, since):
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


def score_candidates(db, settings, now: datetime, since: str | None = None) -> int:
    now_iso = m.to_iso(now)
    n = 0
    for vid in short_candidates(db, settings, since):
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


def ranked_candidates(db, settings, since: str | None = None) -> list[dict]:
    rows = []
    for vid in short_candidates(db, settings, since):
        score = db.latest_score(vid)
        if score is not None:
            rows.append({"video_id": vid, "radar_score": score["radar_score"]})
    rows.sort(key=lambda r: (-r["radar_score"], r["video_id"]))
    return rows
