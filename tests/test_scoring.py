import pytest

from radar.scoring.radar import (ALL_DIMENSIONS, compute_score, normalize_outlier, normalize_velocity,
                                 validate_weights)


def test_config_weights_are_spec_weights(settings):
    assert settings.weights == {"outlier_ratio": 25, "view_velocity": 20, "freshness": 10, "story_strength": 15,
                                "korea_localization_gap": 15, "localization_potential": 10, "channel_fit": 5}
    assert sum(settings.weights.values()) == 100


@pytest.mark.parametrize("bad", [
    {"outlier_ratio": 100},
    {d: 100 / 7 + (1 if d == "freshness" else 0) for d in ALL_DIMENSIONS},
    {**{d: 20 for d in ALL_DIMENSIONS}, "channel_fit": -20},
])
def test_invalid_weights_rejected(bad):
    with pytest.raises(ValueError):
        validate_weights(bad)


def test_normalize_outlier():
    assert normalize_outlier(None, 50) is None
    assert normalize_outlier(0.5, 50) == 0.0
    assert normalize_outlier(1.0, 50) == 0.0
    assert normalize_outlier(50, 50) == 1.0
    assert normalize_outlier(500, 50) == 1.0
    assert normalize_outlier(5, 50) < normalize_outlier(20, 50) < 1.0


def test_normalize_velocity_monotone_and_bounded():
    vals = [normalize_velocity(v, 100_000) for v in (0, 10, 1_000, 100_000, 10**9)]
    assert vals == sorted(vals) and vals[0] == 0.0 and vals[-1] == 1.0


def full(value):
    return {d: (value, "test") for d in ALL_DIMENSIONS}


def test_score_bounds(settings):
    assert compute_score(full(1.0), settings.weights).radar_score == 100
    assert compute_score(full(0.0), settings.weights).radar_score == 0
    assert compute_score(full(7.0), settings.weights).radar_score == 100  # clipped


def test_missing_dimensions_not_imputed(settings):
    signals = full(1.0)
    signals["korea_localization_gap"] = (None, "missing")
    res = compute_score(signals, settings.weights)
    assert res.radar_score == 85
    assert res.missing == ["korea_localization_gap"] and res.provisional
    assert res.available_weight == 85
    assert res.components["korea_localization_gap"]["points"] == 0


def test_component_sources_preserved(settings):
    signals = full(0.5)
    signals["story_strength"] = (0.5, "heuristic_v0")
    res = compute_score(signals, settings.weights)
    assert res.components["story_strength"]["source"] == "heuristic_v0"
    assert res.components["story_strength"]["points"] == 7.5
