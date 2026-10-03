"""Radar Score (0-100). Pure functions; inputs are already-computed metrics and judgments.

Missing dimensions are never imputed: they contribute 0 points and are listed in `missing`,
so a candidate's score is a lower bound until every dimension has a value.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

METRIC_DIMENSIONS = ("outlier_ratio", "view_velocity", "freshness")
JUDGMENT_DIMENSIONS = ("story_strength", "korea_localization_gap", "localization_potential", "channel_fit")
ALL_DIMENSIONS = METRIC_DIMENSIONS + JUDGMENT_DIMENSIONS


def validate_weights(weights: dict[str, float]) -> None:
    unknown = set(weights) - set(ALL_DIMENSIONS)
    missing = set(ALL_DIMENSIONS) - set(weights)
    if unknown or missing:
        raise ValueError(f"weights mismatch: unknown={sorted(unknown)} missing={sorted(missing)}")
    if any(w < 0 for w in weights.values()):
        raise ValueError("weights must be non-negative")
    total = sum(weights.values())
    if not math.isclose(total, 100.0, abs_tol=1e-6):
        raise ValueError(f"weights must sum to 100, got {total}")


def _clip(x: float) -> float:
    return min(max(x, 0.0), 1.0)


def normalize_outlier(ratio: float | None, cap: float) -> float | None:
    """log(ratio)/log(cap): 1x -> 0, cap -> 1. Ratios below 1 (underperformers) score 0."""
    if ratio is None:
        return None
    if ratio <= 1.0:
        return 0.0
    return _clip(math.log(ratio) / math.log(cap))


def normalize_velocity(vph: float | None, cap: float) -> float | None:
    if vph is None:
        return None
    return _clip(math.log10(1 + max(vph, 0.0)) / math.log10(1 + cap))


@dataclass
class ScoreResult:
    radar_score: float
    available_weight: float
    components: dict[str, dict] = field(default_factory=dict)
    missing: list[str] = field(default_factory=list)

    @property
    def provisional(self) -> bool:
        return bool(self.missing)


def compute_score(signals: dict[str, tuple[float | None, str]], weights: dict[str, float]) -> ScoreResult:
    """signals: dimension -> (normalized value in [0,1] or None, source label)."""
    validate_weights(weights)
    components: dict[str, dict] = {}
    missing: list[str] = []
    total = available = 0.0
    for dim in ALL_DIMENSIONS:
        value, source = signals.get(dim, (None, "missing"))
        weight = weights[dim]
        if value is None:
            missing.append(dim)
            components[dim] = {"value": None, "weight": weight, "points": 0.0, "source": source}
            continue
        value = _clip(float(value))
        points = value * weight
        total += points
        available += weight
        components[dim] = {"value": round(value, 4), "weight": weight, "points": round(points, 2), "source": source}
    return ScoreResult(radar_score=round(total, 2), available_weight=available, components=components, missing=missing)
