from datetime import timedelta

import pytest

from radar.metrics import compute as m


@pytest.mark.parametrize("value,expected", [
    ("PT45S", 45), ("PT1M5S", 65), ("PT3M", 180), ("PT1H2M3S", 3723), ("P1DT1S", 86401), ("P0D", 0),
    (None, None), ("garbage", None),
])
def test_parse_iso_duration(value, expected):
    assert m.parse_iso_duration(value) == expected


def test_spec_outlier_example():
    assert m.outlier_ratio(1_000_000, 50_000) == 20.0


def test_outlier_ratio_guards():
    assert m.outlier_ratio(100, None) is None
    assert m.outlier_ratio(100, 0) is None
    assert m.outlier_ratio(None, 10) is None


def test_views_per_hour_floors_tiny_ages():
    assert m.views_per_hour(1000, 0.0) == 1000  # floored at 1h, no division by zero
    assert m.views_per_hour(1000, 10) == 100
    assert m.views_per_hour(None, 10) is None


def test_freshness_half_life():
    assert m.freshness(0, 48) == 1.0
    assert m.freshness(48, 48) == pytest.approx(0.5)
    assert m.freshness(-5, 48) == 1.0


def test_is_short():
    assert m.is_short(45, 180) and m.is_short(180, 180)
    assert not m.is_short(220, 180) and not m.is_short(None, 180) and not m.is_short(0, 180)


def _v(vid, hours_ago, views, now, duration="PT40S"):
    return {"video_id": vid, "published_at": m.to_iso(now - timedelta(hours=hours_ago)),
            "view_count": views, "duration_iso": duration}


def test_baseline_excludes_target_new_and_prefers_shorts(now):
    vids = [_v("target", 20, 1_000_000, now), _v("new", 5, 10, now)]
    vids += [_v(f"s{i}", 100 + i, v, now) for i, v in enumerate([40, 50, 60])]
    vids += [_v(f"l{i}", 200 + i, 999_999, now, "PT12M") for i in range(5)]
    median, size, kind = m.channel_baseline("target", vids, now, 180, 48, 15, 3)
    assert (median, size, kind) == (50.0, 3, "shorts")


def test_baseline_falls_back_to_all_formats(now):
    vids = [_v("s0", 100, 10, now)] + [_v(f"l{i}", 200 + i, 100, now, "PT12M") for i in range(3)]
    assert m.channel_baseline("x", vids, now, 180, 48, 15, 3) == (100.0, 4, "all_formats")


def test_baseline_insufficient(now):
    vids = [_v("a", 100, 10, now), _v("b", 120, 20, now)]
    median, size, kind = m.channel_baseline("x", vids, now, 180, 48, 15, 3)
    assert median is None and kind == "insufficient" and size == 2


def test_baseline_respects_sample_size(now):
    # newest 3 shorts are low, older ones high: sample_size=3 must use only the newest
    vids = [_v(f"n{i}", 50 + i, 10, now) for i in range(3)] + [_v(f"o{i}", 500 + i, 10_000, now) for i in range(5)]
    assert m.channel_baseline("x", vids, now, 180, 48, 3, 3)[0] == 10.0


def test_engagement_rate():
    assert m.engagement_rate(1000, 40, 10) == 0.05
    assert m.engagement_rate(1000, None, None) is None
    assert m.engagement_rate(0, 1, 1) is None
