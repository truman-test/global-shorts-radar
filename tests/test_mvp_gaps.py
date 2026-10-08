"""Seed channels, candidate filters, discovery source, CLI --top/--min-score."""
import sqlite3

import pytest

from radar import cli, pipeline
from radar.collectors.fixture import FixtureClient
from radar.collectors.youtube import QuotaTracker
from radar.config import ConfigError, DEFAULT_CONFIG_PATH, load_settings
from radar.reports.build import build_rows, render_markdown
from radar.storage.db import Database


def _run(db, settings, now, budget=10_000):
    client = FixtureClient(quota=QuotaTracker(budget))
    s = pipeline.collect(client, db, settings, now, "fixture")
    pipeline.compute_metrics(db, settings, now)
    pipeline.run_heuristics(db, settings, now)
    pipeline.score_candidates(db, settings, now)
    return s, client


# ---------------------------------------------------------------- seed channels

def test_seed_channel_uploads_become_candidates_without_search(db, settings, now):
    settings.keywords, settings.seed_channels = [], ["UCsignal"]  # Signal Noise: H1 (6h) + 6 baseline Shorts
    s, client = _run(db, settings, now)
    assert s.searches == 0 and client.quota.used < 100, "no search.list call"
    rows = build_rows(db, settings)
    ids = [r["video_id"] for r in rows]
    assert ids[0] == "smpl_H1" and rows[0]["outlier_ratio"] == pytest.approx(250_000 / 30_000, rel=1e-3)
    assert rows[0]["found_by"] == "seed channel Signal Noise"
    src = {r["source"] for r in db.query("SELECT source FROM discoveries")}
    assert src == {"seed_channel"}
    # uploads inside the discovery window are discovered; those without a digital-topic term are
    # filtered from the ranking (seed_uploads_need_topic_match), older uploads are baseline only
    discovered = db.query("SELECT COUNT(DISTINCT video_id) AS n FROM discoveries")[0]["n"]
    assert s.candidates == discovered and discovered > len(ids) >= 1
    assert all("short #" not in r["title"] for r in rows), "generic 'Signal Noise short #N' uploads are not ranked"
    settings.seed_uploads_need_topic_match = False
    assert len(build_rows(db, settings)) > len(ids), "gate off: the generic uploads rank again"


def test_seed_and_keywords_combine_and_scope_independently(db, settings, now):
    settings.seed_channels = ["UCsignal"]
    settings.seed_uploads_need_topic_match = False  # count scoping, not the topic gate
    s, _ = _run(db, settings, now)
    ids = {r["video_id"] for r in build_rows(db, settings)}
    assert {"smpl_A1", "smpl_H1"} <= ids
    settings.seed_channels = []                      # seed removed: its baseline-window uploads leave, H1 stays (keyword hit)
    ids2 = {r["video_id"] for r in build_rows(db, settings)}
    assert "smpl_H1" in ids2 and len(ids2) < len(ids)
    settings.keywords = []                           # keywords removed, seed back: only seed uploads remain
    settings.seed_channels = ["UCsignal"]
    ids3 = {r["video_id"] for r in build_rows(db, settings)}
    assert "smpl_H1" in ids3 and "smpl_A1" not in ids3
    assert db.candidate_ids(queries=[], seed_channels=[]) == []


def test_discoveries_source_column_is_migrated_in_place(tmp_path):
    path = tmp_path / "old.db"
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE discoveries (video_id TEXT NOT NULL, run_id INTEGER NOT NULL, query TEXT NOT NULL, "
                 "region TEXT, discovered_at TEXT NOT NULL, PRIMARY KEY (video_id, run_id, query, region))")
    conn.execute("INSERT INTO discoveries VALUES ('v1', 1, 'AI scam', 'US', '2026-10-01T00:00:00Z')")
    conn.commit(); conn.close()
    db = Database(path)
    db.init_schema()
    assert db.query("SELECT source FROM discoveries")[0]["source"] == "keyword"
    assert db.candidate_ids(queries=["AI scam"], regions=["US"]) == ["v1"]
    assert db.discovery_queries("v1") == ["AI scam (US)"]
    db.close()


# ---------------------------------------------------------------- filters

def test_filters_are_loose_by_default_and_each_one_bites(db, settings, now):
    _run(db, settings, now)
    base = {r["video_id"] for r in build_rows(db, settings)}
    assert len(base) == 7

    settings.min_radar_score = 60
    assert {r["video_id"] for r in build_rows(db, settings)} < base
    assert "smpl_A1" in {r["video_id"] for r in build_rows(db, settings)}
    settings.min_radar_score = 0

    settings.max_age_hours = 24
    assert {r["video_id"] for r in build_rows(db, settings)} == {"smpl_A1", "smpl_H1"}  # 20h and 6h old
    settings.max_age_hours = 240

    settings.min_views = 500_000
    assert {r["video_id"] for r in build_rows(db, settings)} == {"smpl_A1", "smpl_B1", "smpl_E1", "smpl_F1"}
    settings.min_views = 100

    settings.min_outlier_ratio = 9.0
    ids = {r["video_id"] for r in build_rows(db, settings)}
    assert ids == {"smpl_A1", "smpl_D1", "smpl_F1"} and "smpl_C1" not in ids  # n/a ratio fails a positive minimum
    settings.min_outlier_ratio = 0

    settings.topic_categories = ["scam"]
    ids = {r["video_id"] for r in build_rows(db, settings)}
    assert "smpl_A1" in ids and "smpl_E1" in ids and "smpl_F1" not in ids
    reasons = pipeline.filter_reasons(db, settings, "smpl_F1")
    assert reasons and "topics" in reasons[0]
    settings.topic_categories = []
    assert pipeline.filter_reasons(db, settings, "smpl_F1") == []


def test_filters_apply_to_korea_gap_targets(db, settings, now):
    _run(db, settings, now)
    settings.min_radar_score = 60
    targets = pipeline.korea_gap_targets(db, settings, 5)
    assert targets and all(t in {"smpl_A1", "smpl_H1"} for t in targets)


def test_unknown_topic_category_is_a_config_error(tmp_path):
    text = DEFAULT_CONFIG_PATH.read_text(encoding="utf-8").replace("topic_categories = []", 'topic_categories = ["cooking"]')
    bad = tmp_path / "radar.toml"
    bad.write_text(text, encoding="utf-8")
    with pytest.raises(ConfigError):
        load_settings(bad, env={}, dotenv_path="/nonexistent/.env")


def test_report_shows_filters_and_plain_metric_reasons(db, settings, now):
    _run(db, settings, now)
    md = render_markdown(build_rows(db, settings), generated_at=now, mode="fixture", settings=settings)
    assert "Filters: age ≤ 240h · views ≥ 100" in md
    assert "Why (observed metrics only): 20.0x channel baseline · 50,000 views/hour · published 20h ago" in md


# ---------------------------------------------------------------- CLI

def test_cli_top_and_min_score(tmp_path):
    db_path, out = tmp_path / "r.db", tmp_path / "reports"
    assert cli.main(["--db", str(db_path), "run", "--fixture", "--out", str(out), "--top", "2", "--min-score", "60"]) == 0
    md = next(out.glob("radar_*.md")).read_text(encoding="utf-8")
    assert "score ≥ 60" in md and md.count("\n### ") == 2
    assert cli.main(["--db", str(db_path), "report", "--out", str(out), "--now", "2026-10-03T01:00:00Z", "--min-score", "99"]) == 0
    assert "No Short candidates" in (out / "radar_20261003_0100.md").read_text(encoding="utf-8")


def test_video_found_by_keyword_and_seed_is_fetched_and_counted_once(db, settings, now):
    settings.seed_channels = ["UCsignal"]            # H1 is also a "phone spyware" keyword hit
    s, client = _run(db, settings, now)
    rows = {r["video_id"]: r for r in build_rows(db, settings)}
    assert set(rows["smpl_H1"]["found_by"].split(", ")) == {"phone spyware (US)", "seed channel Signal Noise"}
    assert db.query("SELECT COUNT(*) AS n FROM video_snapshots WHERE video_id = 'smpl_H1'")[0]["n"] == 1
    ids = [r["video_id"] for r in db.query("SELECT DISTINCT video_id FROM discoveries")]
    assert s.candidates == len(ids), "each candidate counted once even with two discovery rows"
    videos_calls = db.query("SELECT COUNT(*) AS n FROM raw_responses WHERE endpoint = 'videos'")[0]["n"]
    assert videos_calls <= 2 + len({r["channel_id"] for r in db.query("SELECT channel_id FROM channels")}), "seed uploads batched"


def test_max_age_is_measured_at_the_last_observation(db, settings, now):
    from datetime import timedelta
    _run(db, settings, now)
    settings.max_age_hours = 24
    assert {r["video_id"] for r in build_rows(db, settings)} == {"smpl_A1", "smpl_H1"}
    # days later, without a new observation, the report is unchanged (anchor = last run, not wall clock)
    reasons = pipeline.filter_reasons(db, settings, "smpl_H1", anchor=now + timedelta(days=5))
    assert reasons and reasons[0].startswith("age ")
    assert pipeline.filter_reasons(db, settings, "smpl_H1") == []


def test_seed_topic_gate_does_not_touch_keyword_hits(db, settings, now):
    settings.seed_channels = ["UCkitchen"]  # F1 "garlic peeling trick" is a keyword hit too
    _run(db, settings, now)
    rows = {r["video_id"]: r for r in build_rows(db, settings)}
    assert "smpl_F1" in rows, "found by a keyword as well: the seed gate does not apply"
    assert db.discovery_sources("smpl_F1") == {"keyword", "seed_channel"}
    assert pipeline.filter_reasons(db, settings, "smpl_F1") == []
