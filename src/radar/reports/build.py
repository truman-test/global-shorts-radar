"""Assemble report rows (shared by Markdown and CSV) and render them."""
from __future__ import annotations

import csv
import json
from datetime import datetime
from pathlib import Path

from radar.analysis.cluster import SOURCE as CLUSTER_SOURCE, cluster_titles, generic_tokens
from radar.analysis.judgments import resolve
from radar.analysis.story_dna import FIELDS as DNA_FIELDS, LABELS as DNA_LABELS
from radar.pipeline import ranked_candidates
from radar.scoring.radar import JUDGMENT_DIMENSIONS, METRIC_DIMENSIONS

STORY_DNA_FIELDS = [
    "Topic", "Hook", "Curiosity Gap", "Conflict", "Emotion", "Story Progression",
    "Reveal", "Payoff", "Audience Desire/Fear", "Why It Went Viral",
]

DIM_LABELS = {
    "outlier_ratio": "Outlier Ratio",
    "view_velocity": "View Velocity",
    "freshness": "Freshness",
    "story_strength": "Story Strength",
    "korea_localization_gap": "Korea Localization Gap",
    "localization_potential": "Localization Potential",
    "channel_fit": "Channel Fit",
}


def build_rows(db, settings, since: str | None = None) -> list[dict]:
    rows = []
    for rank, item in enumerate(ranked_candidates(db, settings, since), start=1):
        vid = item["video_id"]
        v, met, score = db.video(vid), db.latest_metrics(vid), db.latest_score(vid)
        snap = db.latest_snapshot(vid)
        ch = db.channel(v["channel_id"])
        ver = db.verification(vid)
        winning = resolve(db.judgments(vid))
        rows.append({
            "rank": rank,
            "video_id": vid,
            "url": f"https://www.youtube.com/shorts/{vid}",
            "title": v["title"],
            "channel_title": ch["title"] if ch else None,
            "channel_id": v["channel_id"],
            "found_by": ", ".join(db.discovery_queries(vid)),
            # observed
            "published_at": v["published_at"],
            "duration_seconds": met["duration_seconds"],
            "view_count": snap["view_count"],
            "like_count": snap["like_count"],
            "comment_count": snap["comment_count"],
            "subscriber_count": ch["subscriber_count"] if ch else None,
            "observed_at": snap["fetched_at"],
            # derived
            "hours_since_publish": met["hours_since_publish"],
            "views_per_hour": met["views_per_hour"],
            "channel_median_views": met["channel_median_views"],
            "baseline_size": met["baseline_size"],
            "baseline_kind": met["baseline_kind"],
            "outlier_ratio": met["outlier_ratio"],
            "engagement_rate": met["engagement_rate"],
            "freshness": met["freshness"],
            "recent_views_per_hour": met["recent_views_per_hour"],
            "velocity_ratio": met["velocity_ratio"],
            "trend_window_hours": met["trend_window_hours"],
            "snapshot_count": met["snapshot_count"],
            # score
            "radar_score": score["radar_score"],
            "weights_version": score["weights_version"],
            "components": json.loads(score["components_json"]),
            "missing": json.loads(score["missing_json"]),
            # judgment
            "judgments": {d: dict(j) for d, j in winning.items()},
            # verification
            "verification_status": ver["status"] if ver else "unverified",
            "verification_sources": json.loads(ver["sources_json"]) if ver else [],
            "verification_note": (ver["note"] if ver else "") or "",
            "story_dna": _story_dna_row(db.story_dna(vid)),
        })
    _attach_story_clusters(rows, settings)
    return rows


def _story_dna_row(row) -> dict | None:
    if row is None:
        return None
    return {"source": row["source"], "author": row["author"], "created_at": row["created_at"],
            "fields": json.loads(row["fields_json"]), "sources": json.loads(row["sources_json"])}


def _attach_story_clusters(rows: list[dict], settings) -> None:
    """Derived, report-time grouping of candidates that cover the same event (title overlap)."""
    by_id = {r["video_id"]: r for r in rows}
    ignore = generic_tokens(settings.keywords, *settings.topic_lexicon.values(),
                            settings.universal_terms, settings.region_specific_terms)
    for c in cluster_titles([(r["video_id"], r["title"], r["channel_id"]) for r in rows], ignore_tokens=ignore):
        for vid in c.members:
            by_id[vid].update({
                "story_cluster": f"S{c.cluster_id}",
                "cluster_size": c.size,
                "cluster_leader": vid == c.leader,
                "cluster_members": list(c.members),
                "cluster_shared_tokens": list(c.shared_tokens),
            })


def _why(r: dict) -> list[str]:
    """Plain-language reasons from computed metrics (no model, no judgment)."""
    parts = []
    if r["outlier_ratio"] is not None:
        parts.append(f"{r['outlier_ratio']:.1f}x channel baseline")
    else:
        parts.append("no channel baseline yet")
    parts.append(f"{_fmt(r['views_per_hour'], ',.0f')} views/hour")
    parts.append(f"published {_fmt(r['hours_since_publish'], '.0f')}h ago (freshness {_fmt(r['freshness'], '.2f')})")
    if r.get("velocity_ratio") is not None:
        parts.append(f"trend {_fmt_trend(r)}")
    return parts


def _cell(text) -> str:
    """Escape a value for a Markdown table cell."""
    return str(text or "").replace("|", "/").replace("\n", " ")


def _fmt_int(x) -> str:
    return "hidden" if x is None else f"{int(x):,}"


def _fmt(x, spec=".1f", none="n/a") -> str:
    return none if x is None else format(x, spec)


def _fmt_ratio(x) -> str:
    return "n/a" if x is None else f"{x:.1f}x"


TREND_UP, TREND_DOWN = 1.2, 0.8


def _fmt_trend(r: dict) -> str:
    ratio, window = r.get("velocity_ratio"), r.get("trend_window_hours")
    if ratio is None or window is None:
        return "—"
    arrow = "↑" if ratio >= TREND_UP else ("↓" if ratio <= TREND_DOWN else "→")
    return f"{arrow}{ratio:.1f}x/{window:.0f}h"


def _fit_label(value) -> str:
    if value is None:
        return "?"
    return "off-topic?" if value < 0.3 else ("partial" if value < 0.75 else "core")


def render_markdown(rows: list[dict], *, generated_at: datetime, mode: str, settings, run_info: dict | None = None,
                    top_n: int | None = None) -> str:
    top_n = top_n or settings.top_n
    out: list[str] = []
    out.append(f"# Global Shorts Radar — {generated_at:%Y-%m-%d %H:%M} UTC\n")
    if mode == "fixture":
        out.append("> **FIXTURE MODE** — synthetic sample data, not real YouTube videos. Use for pipeline validation only.\n")
    out.append("> Viral videos are **idea signals, not information sources**. Every candidate below is **UNVERIFIED** "
               "until independent fact research is recorded. Do not copy, translate or re-upload source content — "
               "extract Story DNA and build an original Korean story.\n")
    if run_info:
        out.append(f"Run #{run_info.get('run_id')} · searches: {run_info.get('searches')} · candidates: "
                   f"{run_info.get('candidates')} · estimated quota used: {run_info.get('quota_used')}\n")
    weights = " · ".join(f"{DIM_LABELS[k]} {int(v)}" for k, v in settings.weights.items())
    out.append(f"Weights `{settings.weights_version}`: {weights}\n")
    out.append("Score legend: metric dimensions are computed from observed API data; judgment dimensions show their "
               "source (`heuristic_v0` = keyword guess, low confidence · `manual` = human · `derived:kr_search_v0` = "
               "Korean YouTube search proxy). Missing dimensions score 0 (score is a lower bound, marked *provisional*).\n")
    out.append("Trend = views/hour between the last two observations ÷ the video's average views/hour before that "
               "(↑ ≥1.2x accelerating · → steady · ↓ ≤0.8x cooling · — needs `radar track`). Derived data shown for "
               "context; it is **not** part of the Radar Score.\n")
    out.append(f"Story = candidates whose titles describe the same event (`{CLUSTER_SOURCE}`, derived from title "
               "overlap, not part of the score). The ranking shows one row per story (its best-scoring video); "
               "`×N` = N videos cover it. Every video is listed in the CSV.\n")
    topics = ", ".join(settings.topic_categories) if settings.topic_categories else "any"
    out.append(f"Filters: age ≤ {settings.max_age_hours:.0f}h · views ≥ {settings.min_views:,} · "
               f"outlier ≥ {settings.min_outlier_ratio:g}x · score ≥ {settings.min_radar_score:g} · topics: {topics}\n")
    leaders = [r for r in rows if r.get("cluster_leader", True)]
    shown = leaders[:top_n]

    out.append("## Ranking\n")
    out.append("| # | Score | Story | Outlier | Median | Views/h | Trend | Age (h) | Views | Topic fit | Title | Channel | Verified |")
    out.append("|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    for r in shown:
        prov = "*" if r["missing"] else ""
        title = _cell(r["title"])
        story = f"×{r['cluster_size']}" if r.get("cluster_size", 1) > 1 else ""
        out.append(
            f"| {r['rank']} | {r['radar_score']:.1f}{prov} | {story} | {_fmt_ratio(r['outlier_ratio'])} | "
            f"{_fmt(r['channel_median_views'], ',.0f')} | "
            f"{_fmt(r['views_per_hour'], ',.0f')} | {_fmt_trend(r)} | {_fmt(r['hours_since_publish'], '.0f')} | "
            f"{_fmt_int(r['view_count'])} | {_fit_label(r['components']['channel_fit']['value'])} | "
            f"[{title}]({r['url']}) | {_cell(r['channel_title'])} | {r['verification_status'].upper()} |"
        )
    out.append("\n`*` = provisional (some dimensions missing).\n")

    by_id = {r["video_id"]: r for r in rows}
    stories = [r for r in shown if r.get("cluster_size", 1) > 1]
    if stories:
        out.append("## Stories covered by several videos\n")
        out.append("One event reported by many channels is a topic signal in itself. Members are ranked videos "
                   "outside the table above; judge the story, not any single upload.\n")
        for r in stories:
            members = [by_id[v] for v in r["cluster_members"]]
            views = sum(m["view_count"] or 0 for m in members)
            channels = len({m["channel_id"] for m in members})
            shared = ", ".join(r["cluster_shared_tokens"][:5]) or "n/a"
            out.append(f"- **{r['story_cluster']}** ×{r['cluster_size']} · {channels} channels · {views:,} views total · "
                       f"shared title terms: {shared}")
            for m in members[1:]:
                out.append(f"  - #{m['rank']} {m['radar_score']:.1f} · {_fmt_ratio(m['outlier_ratio'])} · "
                           f"[{_cell(m['title'])}]({m['url']}) · {_cell(m['channel_title'])}")
        out.append("")

    out.append("## Candidates\n")
    for r in shown:
        out.append(f"### {r['rank']}. {r['title']}\n")
        out.append(f"- Link: {r['url']} · Channel: {r['channel_title']} · Found by: {r['found_by']}")
        if r.get("cluster_size", 1) > 1:
            others = ", ".join(f"#{by_id[v]['rank']}" for v in r["cluster_members"][1:])
            out.append(f"- Story: **{r['story_cluster']}** — {r['cluster_size']} videos cover this event (also {others}); "
                       f"shared title terms: {', '.join(r['cluster_shared_tokens'][:5]) or 'n/a'}")
        out.append(f"- Fact status: **{r['verification_status'].upper()}**"
                   + (f" (sources: {', '.join(r['verification_sources'])})" if r["verification_sources"] else
                      " — the story's claims have not been checked against official/news sources"))
        out.append(f"- Radar Score: **{r['radar_score']:.1f}** / 100"
                   + (f" — provisional, missing: {', '.join(DIM_LABELS[m] for m in r['missing'])}" if r["missing"] else ""))
        out.append("- Why (observed metrics only): " + " · ".join(_why(r)))
        out.append("")
        out.append("**Observed** (YouTube Data API, as of " + str(r["observed_at"]) + ")\n")
        out.append(f"views {_fmt_int(r['view_count'])} · likes {_fmt_int(r['like_count'])} · comments "
                   f"{_fmt_int(r['comment_count'])} · channel subscribers {_fmt_int(r['subscriber_count'])} · "
                   f"published {r['published_at']} · duration {r['duration_seconds']}s\n")
        floor = settings.min_baseline_median_views
        floored = r["channel_median_views"] is not None and r["channel_median_views"] < floor
        baseline = (f"{_fmt(r['channel_median_views'], ',.0f')} median over {r['baseline_size']} recent "
                    f"{'Shorts' if r['baseline_kind'] == 'shorts' else 'uploads'}"
                    + (f", floored to {floor:,.0f}" if floored else "")
                    if r["channel_median_views"] is not None else
                    f"not enough channel history ({r['baseline_size']} eligible uploads)")
        out.append("**Derived** (deterministic)\n")
        out.append(f"outlier ratio {_fmt_ratio(r['outlier_ratio'])} (baseline: {baseline}) · views/hour "
                   f"{_fmt(r['views_per_hour'], ',.0f')} · age {_fmt(r['hours_since_publish'], '.0f')}h · freshness "
                   f"{_fmt(r['freshness'], '.2f')} · engagement {_fmt(r['engagement_rate'] and r['engagement_rate'] * 100, '.1f')}%\n")
        if r["velocity_ratio"] is not None:
            out.append(f"trend {_fmt_trend(r)}: {_fmt(r['recent_views_per_hour'], ',.0f')} views/hour over the last "
                       f"{_fmt(r['trend_window_hours'], '.0f')}h ({r['snapshot_count']} observations)\n")
        else:
            out.append(f"trend: not measured yet ({r['snapshot_count'] or 1} observation) — run `radar track` later\n")
        out.append("**Score breakdown**\n")
        out.append("| Dimension | Type | Value | Points | Source / rationale |")
        out.append("|---|---|---|---|---|")
        for dim in METRIC_DIMENSIONS + JUDGMENT_DIMENSIONS:
            c = r["components"][dim]
            kind = "metric" if dim in METRIC_DIMENSIONS else "judgment"
            j = r["judgments"].get(dim)
            why = f"{c['source']}: {j['rationale']}" if j else c["source"]
            out.append(f"| {DIM_LABELS[dim]} | {kind} | {_fmt(c['value'], '.2f', '—')} | "
                       f"{c['points']:.1f}/{c['weight']:.0f} | {_cell(why)} |")
        out.append("")
        dna = r.get("story_dna")
        if dna:
            who = dna["source"] + (f", {dna['author']}" if dna.get("author") else "")
            out.append(f"**Story DNA** ({who}, {dna['created_at'][:10]}; a judgment, not a fact — public metadata only)\n")
            for f in DNA_FIELDS:
                out.append(f"- {DNA_LABELS[f]}: {_cell(dna['fields'].get(f) or '—')}")
            if dna["sources"]:
                out.append("- Independent sources proposed (human confirmation pending):")
                out.extend(f"  - {s.get('type') or 'source'}: {s['url']}" + (f" — {_cell(s['note'])}" if s.get("note") else "")
                           for s in dna["sources"])
            else:
                out.append("- Independent sources proposed: none found")
            out.append("")
        else:
            out.append("**Story DNA — to fill by analyst/LLM (do not transcribe the source)**\n")
            out.extend(f"- [ ] {f}:" for f in STORY_DNA_FIELDS)
            out.append("- [ ] Independent sources found (official → police/company → major news → specialist):")
            out.append("- [ ] Original Korean angle (must stand on its own without the source video):\n")
    if not rows:
        out.append("_No Short candidates found in this run._\n")
    return "\n".join(out)


CSV_COLUMNS = [
    "rank", "radar_score", "provisional", "missing", "video_id", "url", "title", "channel_title", "channel_id",
    "found_by", "story_cluster", "cluster_size", "cluster_leader", "published_at", "duration_seconds", "view_count", "like_count", "comment_count", "subscriber_count",
    "observed_at", "hours_since_publish", "views_per_hour", "channel_median_views", "baseline_size", "baseline_kind",
    "outlier_ratio", "engagement_rate", "freshness", "recent_views_per_hour", "velocity_ratio", "trend_window_hours",
    "snapshot_count", "weights_version", "verification_status",
]


def write_csv(rows: list[dict], path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    dims = METRIC_DIMENSIONS + JUDGMENT_DIMENSIONS
    header = CSV_COLUMNS + [f"{d}_points" for d in dims] + [f"{d}_source" for d in JUDGMENT_DIMENSIONS]
    with path.open("w", newline="", encoding="utf-8-sig") as fh:  # BOM so Excel opens UTF-8 correctly
        w = csv.DictWriter(fh, fieldnames=header, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            flat = {k: (round(v, 4) if isinstance(v, float) else v) for k, v in r.items()}
            flat.update(provisional=bool(r["missing"]), missing=";".join(r["missing"]))
            for d in dims:
                flat[f"{d}_points"] = r["components"][d]["points"]
            for d in JUDGMENT_DIMENSIONS:
                flat[f"{d}_source"] = r["components"][d]["source"]
            w.writerow(flat)
    return path
