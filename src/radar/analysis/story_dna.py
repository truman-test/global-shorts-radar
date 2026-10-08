"""Story DNA: the structural analysis of a candidate (judgment layer).

What we take from a viral video is never its content but its Story DNA: topic, hook, curiosity
gap, conflict, emotion, progression, reveal, payoff, audience desire/fear, why it went viral,
and an original Korean angle that stands without the source. Analysts (human or LLM agents)
produce it from public metadata only; every record carries its `source`.

This module exports an analysis bundle for analysts and imports their results:
- Story DNA text fields            -> story_dna table (source = manual | llm:<model>)
- optional judgment values (0..1)  -> judgments table, same source
- optional independent sources     -> verification: status becomes `in_progress` with the URLs.
  Agents never mark a story `verified`; only a human does that with `radar verify`.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from radar.analysis.manual import valid_source
from radar.scoring.radar import JUDGMENT_DIMENSIONS

FIELDS = [
    "topic", "hook", "curiosity_gap", "conflict", "emotion", "story_progression", "reveal", "payoff",
    "audience_desire_fear", "why_viral", "korean_angle",
]
LABELS = {
    "topic": "Topic", "hook": "Hook", "curiosity_gap": "Curiosity Gap", "conflict": "Conflict", "emotion": "Emotion",
    "story_progression": "Story Progression", "reveal": "Reveal", "payoff": "Payoff",
    "audience_desire_fear": "Audience Desire/Fear", "why_viral": "Why It Went Viral",
    "korean_angle": "Original Korean angle",
}
SOURCE_TYPES = ("official", "government_police_company", "major_news", "specialist", "secondary", "social")


def export_bundle(db, rows: list[dict]) -> list[dict]:
    """Everything an analyst may use per candidate: public metadata, metrics, current judgments.

    Deliberately excludes anything that is not public metadata (no transcript, no media), and
    excludes earlier human/LLM judgments: an analyst who sees them anchors on them, which makes
    their output useless as an independent second opinion. Only heuristic/derived values are shown.
    """
    bundle = []
    for r in rows:
        video = db.video(r["video_id"])
        bundle.append({
            "video_id": r["video_id"],
            "url": r["url"],
            "title": r["title"],
            "description": (video["description"] if video else "") or "",
            "tags": json.loads(video["tags_json"] or "[]") if video else [],
            "channel_title": r["channel_title"],
            "channel_country": None,
            "published_at": r["published_at"],
            "duration_seconds": r["duration_seconds"],
            "observed": {"views": r["view_count"], "likes": r["like_count"], "comments": r["comment_count"],
                         "subscribers": r["subscriber_count"], "observed_at": r["observed_at"]},
            "derived": {"outlier_ratio": r["outlier_ratio"], "views_per_hour": r["views_per_hour"],
                        "hours_since_publish": r["hours_since_publish"], "velocity_ratio": r.get("velocity_ratio"),
                        "radar_score": r["radar_score"], "rank": r["rank"],
                        "story_cluster": r.get("story_cluster"), "cluster_size": r.get("cluster_size", 1)},
            "current_judgments": {d: {"value": j["value"], "source": j["source"], "rationale": j.get("rationale")}
                                  for d, j in r["judgments"].items()
                                  if j["source"].startswith(("heuristic", "derived:"))},
            "verification_status": r["verification_status"],
        })
        ch = db.channel(video["channel_id"]) if video else None
        bundle[-1]["channel_country"] = ch["country"] if ch else None
    return bundle


def _validate_entry(entry: dict, lineno: int) -> list[str]:
    errors = []
    if not isinstance(entry, dict) or not entry.get("video_id"):
        return [f"entry {lineno}: missing video_id"]
    for dim, j in (entry.get("judgments") or {}).items():
        if dim not in JUDGMENT_DIMENSIONS:
            errors.append(f"entry {lineno}: unknown judgment dimension '{dim}'")
            continue
        try:
            v = float(j["value"] if isinstance(j, dict) else j)
        except (TypeError, ValueError, KeyError):
            errors.append(f"entry {lineno}: judgment {dim} has no numeric value")
            continue
        if not 0.0 <= v <= 1.0:
            errors.append(f"entry {lineno}: judgment {dim} value {v} outside [0, 1]")
    for s in entry.get("independent_sources") or []:
        if not isinstance(s, dict) or not str(s.get("url", "")).startswith("http"):
            errors.append(f"entry {lineno}: independent source without an http(s) url")
    return errors


def import_story_dna(db, path: str | Path, now: str, source: str) -> tuple[int, list[str]]:
    """Import a JSON list of analyses. Returns (imported_count, errors); invalid entries are skipped.

    Idempotent: an entry identical (same source, fields and sources) to one already stored is
    skipped and reported, so a retried import does not duplicate judgments.
    """
    if not valid_source(source):
        return 0, [f"source must be 'manual' or 'llm:<model>', got {source!r}"]
    path = Path(path)
    if not path.is_file():
        return 0, [f"file not found: {path}"]
    try:
        entries = json.loads(path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        return 0, [f"invalid JSON: {exc}"]
    if isinstance(entries, dict):
        entries = entries.get("analyses") or entries.get("entries") or [entries]
    imported, errors = 0, []
    for n, entry in enumerate(entries, start=1):
        errs = _validate_entry(entry, n)
        if errs:
            errors.extend(errs)
            continue
        vid = str(entry["video_id"])
        if db.video(vid) is None:
            errors.append(f"entry {n}: unknown video_id '{vid}'")
            continue
        fields = {f: str(entry.get(f) or "").strip() for f in FIELDS}
        sources = [{"url": s["url"], "type": s.get("type", ""), "note": s.get("note", "")}
                   for s in entry.get("independent_sources") or []]
        if db.has_story_dna(vid, source, fields, sources):
            errors.append(f"entry {n}: identical {source} analysis for '{vid}' already imported; skipped")
            continue
        db.add_story_dna(vid, source, now, fields, sources, author=str(entry.get("author") or "") or None)
        for dim, j in (entry.get("judgments") or {}).items():
            value = float(j["value"] if isinstance(j, dict) else j)
            rationale = (j.get("rationale") if isinstance(j, dict) else "") or ""
            db.add_judgment(vid, dim, value, source, now, rationale=rationale, author=str(entry.get("author") or "") or None)
        if sources:
            current = db.verification(vid)
            if current is None or current["status"] == "unverified":
                db.set_verification(vid, "in_progress", now, [s["url"] for s in sources],
                                    f"sources proposed by {source}; human confirmation pending")
        imported += 1
    return imported, errors
