"""Seed-channel suggestions from what the radar has already observed.

A channel that has produced a well-scored, on-topic candidate is a cheap, stable source: its
recent uploads cost ~3 quota units per run (no search). This module ranks such channels
deterministically from stored data so the editor can copy a TOML snippet into
[collect] seed_channels. It decides nothing by itself.
"""
from __future__ import annotations

from collections import defaultdict

from radar.analysis.judgments import resolve
from radar.pipeline import ranked_candidates

DEFAULT_MIN_SCORE = 45.0
DEFAULT_MIN_FIT = 0.6   # heuristic/LLM/manual channel_fit; 0.6 = "partial" or better


def suggest_seed_channels(db, settings, min_score: float = DEFAULT_MIN_SCORE, min_fit: float = DEFAULT_MIN_FIT,
                          top: int = 10) -> list[dict]:
    """Channels whose best ranked candidate scores >= min_score with channel_fit >= min_fit.

    Already-configured seed channels are skipped. Sorted by best score, then by number of
    ranked candidates.
    """
    per_channel: dict[str, list[dict]] = defaultdict(list)
    for r in ranked_candidates(db, settings):
        video = db.video(r["video_id"])
        if video is None:
            continue
        fit = resolve(db.judgments(r["video_id"])).get("channel_fit")
        per_channel[video["channel_id"]].append({
            "video_id": r["video_id"], "title": video["title"] or "", "radar_score": r["radar_score"],
            "channel_fit": None if fit is None else float(fit["value"]),
        })
    out = []
    for cid, cands in per_channel.items():
        if cid in settings.seed_channels:
            continue
        best = max(cands, key=lambda c: c["radar_score"])
        if best["radar_score"] < min_score or best["channel_fit"] is None or best["channel_fit"] < min_fit:
            continue
        ch = db.channel(cid)
        out.append({
            "channel_id": cid,
            "channel_title": (ch["title"] if ch else None) or "",
            "country": (ch["country"] if ch else None) or "",
            "subscriber_count": ch["subscriber_count"] if ch else None,
            "ranked_candidates": len(cands),
            "best_score": best["radar_score"],
            "best_fit": best["channel_fit"],
            "best_title": best["title"],
        })
    out.sort(key=lambda s: (-s["best_score"], -s["ranked_candidates"], s["channel_id"]))
    return out[:top]


def toml_snippet(suggestions: list[dict]) -> str:
    """A [collect] seed_channels block with one commented line per channel, ready to paste."""
    if not suggestions:
        return "seed_channels = []  # no channel met the thresholds yet\n"
    lines = ["seed_channels = ["]
    for s in suggestions:
        subs = "hidden" if s["subscriber_count"] is None else f"{s['subscriber_count']:,} subs"
        lines.append(f'  "{s["channel_id"]}",  # {s["channel_title"]} [{s["country"] or "--"}] {subs} · '
                     f'best {s["best_score"]:.1f} · fit {s["best_fit"]:.1f} · {s["best_title"][:50]}')
    lines.append("]")
    return "\n".join(lines) + "\n"
