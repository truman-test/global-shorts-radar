"""Deterministic metric calculations. Pure functions: no I/O, no API, no LLM."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from statistics import median
from typing import Iterable, Sequence

METRIC_VERSION = "m2"

_DURATION = re.compile(r"^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$")


def parse_iso_duration(value: str | None) -> int | None:
    """ISO-8601 duration (YouTube contentDetails.duration) -> seconds."""
    if not value:
        return None
    m = _DURATION.match(value)
    if not m:
        return None
    days, hours, minutes, seconds = (int(g) if g else 0 for g in m.groups())
    return days * 86400 + hours * 3600 + minutes * 60 + seconds


def parse_ts(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def to_iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def hours_since(published_at: str, now: datetime) -> float:
    return max((now - parse_ts(published_at)).total_seconds() / 3600.0, 0.0)


def views_per_hour(views: int | None, hours: float, min_hours: float = 1.0) -> float | None:
    """Average views per hour since publish. Hours are floored at `min_hours` to avoid blow-ups."""
    if views is None:
        return None
    return views / max(hours, min_hours)


def is_short(duration_seconds: int | None, max_short_seconds: int) -> bool:
    return duration_seconds is not None and 0 < duration_seconds <= max_short_seconds


def channel_baseline(
    target_video_id: str,
    channel_videos: Iterable[dict],
    now: datetime,
    max_short_seconds: int,
    min_age_hours: float,
    sample_size: int,
    min_videos: int,
) -> tuple[float | None, int, str]:
    """Median views of the channel's recent uploads, excluding the target video.

    Prefers a Shorts-only baseline (a Short compared against long-form medians is misleading);
    falls back to all formats. Uploads younger than `min_age_hours` are excluded because they have
    not accumulated views yet. Returns (median or None, baseline_size, baseline_kind).
    """
    eligible = [
        v for v in channel_videos
        if v["video_id"] != target_video_id
        and v.get("view_count") is not None
        and hours_since(v["published_at"], now) >= min_age_hours
    ]
    eligible.sort(key=lambda v: v["published_at"], reverse=True)
    shorts = [v for v in eligible if is_short(parse_iso_duration(v.get("duration_iso")), max_short_seconds)]
    for kind, pool in (("shorts", shorts), ("all_formats", eligible)):
        sample = pool[:sample_size]
        if len(sample) >= min_videos:
            return float(median(v["view_count"] for v in sample)), len(sample), kind
    return None, len(eligible[:sample_size]), "insufficient"


def outlier_ratio(views: int | None, baseline_median: float | None) -> float | None:
    if views is None or baseline_median is None or baseline_median <= 0:
        return None
    return views / baseline_median


def engagement_rate(views: int | None, likes: int | None, comments: int | None) -> float | None:
    if not views or (likes is None and comments is None):
        return None
    return ((likes or 0) + (comments or 0)) / views


def freshness(hours: float, half_life_hours: float) -> float:
    """Exponential decay in [0, 1]: 1.0 at publish, 0.5 after one half-life."""
    return 0.5 ** (max(hours, 0.0) / half_life_hours)


def velocity_trend(snapshots: Iterable[dict], published_at: str, min_interval_hours: float = 1.0) -> dict | None:
    """Momentum from repeated observations of the same video.

    Compares views gained between the latest snapshot and the most recent earlier snapshot at
    least `min_interval_hours` older, against the video's average views/hour up to that earlier
    snapshot. velocity_ratio > 1 means it is accelerating; < 1 means it is cooling down (normal
    for most Shorts). Returns None when fewer than two usable snapshots exist.
    """
    snaps = sorted((s for s in snapshots if s.get("view_count") is not None), key=lambda s: s["fetched_at"])
    if len(snaps) < 2:
        return None
    latest = snaps[-1]
    t1 = parse_ts(latest["fetched_at"])
    prev = next((s for s in reversed(snaps[:-1])
                 if (t1 - parse_ts(s["fetched_at"])).total_seconds() / 3600.0 >= min_interval_hours), None)
    if prev is None:
        return None
    t0 = parse_ts(prev["fetched_at"])
    window = (t1 - t0).total_seconds() / 3600.0
    # Counts are occasionally corrected downward (spam filtering); treat as no growth.
    recent = max(latest["view_count"] - prev["view_count"], 0) / window
    prior_avg = views_per_hour(prev["view_count"], hours_since(published_at, t0))
    return {
        "recent_views_per_hour": recent,
        "velocity_ratio": recent / prior_avg if prior_avg else None,
        "trend_window_hours": round(window, 2),
        "snapshot_count": len(snaps),
    }


def safe_median(values: Sequence[float]) -> float | None:
    return float(median(values)) if values else None
