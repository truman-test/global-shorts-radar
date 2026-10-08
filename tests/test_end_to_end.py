import csv

from radar import cli, pipeline
from radar.collectors.fixture import FixtureClient
from radar.collectors.youtube import QuotaTracker
from radar.reports.build import build_rows, render_markdown, write_csv

FAKE_KEY = "AIzaFAKE-e2e-key-should-never-appear"


def run_fixture(db, settings, now, korea=0, budget=10_000):
    client = FixtureClient(quota=QuotaTracker(budget))
    s = pipeline.collect(client, db, settings, now, "fixture")
    pipeline.compute_metrics(db, settings, now)
    pipeline.run_heuristics(db, settings, now)
    pipeline.score_candidates(db, settings, now)
    if korea:
        pipeline.run_korea_gap(client, db, settings, now, korea)
        pipeline.score_candidates(db, settings, now)
    return s


def test_fixture_ranking(db, settings, now):
    s = run_fixture(db, settings, now)
    assert s.searches == len(settings.keywords) and not s.errors
    rows = build_rows(db, settings)
    ids = [r["video_id"] for r in rows]
    assert ids[0] == "smpl_A1"                       # 20x outlier first
    assert "smpl_G1" not in ids                      # 3m40s is not a Short
    a1 = rows[0]
    assert a1["outlier_ratio"] == 20.0 and a1["baseline_kind"] == "shorts" and a1["baseline_size"] == 10
    # Biggest raw-view channel is not an outlier and must rank below smaller outliers
    assert ids.index("smpl_B1") > ids.index("smpl_D1")
    c1 = next(r for r in rows if r["video_id"] == "smpl_C1")
    assert c1["outlier_ratio"] is None and "outlier_ratio" in c1["missing"]
    assert all(r["verification_status"] == "unverified" for r in rows)


def test_rerunning_steps_is_idempotent_for_heuristics(db, settings, now):
    s = run_fixture(db, settings, now)
    before = len(db.query("SELECT * FROM judgments"))
    pipeline.run_heuristics(db, settings, now)
    assert len(db.query("SELECT * FROM judgments")) == before


def test_korea_gap_changes_ranking(db, settings, now):
    run_fixture(db, settings, now, korea=5)
    rows = {r["video_id"]: r for r in build_rows(db, settings)}
    assert rows["smpl_A1"]["judgments"]["korea_localization_gap"]["value"] == 1.0
    assert rows["smpl_D1"]["judgments"]["korea_localization_gap"]["value"] == 0.0
    assert rows["smpl_A1"]["components"]["korea_localization_gap"]["source"] == "derived:kr_search_v0"


def test_budget_stop_keeps_partial_data(db, settings, now):
    s = run_fixture(db, settings, now, budget=250)  # only 2 searches fit
    assert s.searches == 2 and any("partial" in e for e in s.errors)
    assert db.query("SELECT quota_used FROM runs")[0]["quota_used"] <= 250


def test_report_content(db, settings, now, tmp_path):
    settings.api_key = FAKE_KEY
    run_fixture(db, settings, now)
    rows = build_rows(db, settings)
    md = render_markdown(rows, generated_at=now, mode="fixture", settings=settings)
    assert "FIXTURE MODE" in md and "UNVERIFIED" in md and "Story DNA" in md
    assert "heuristic_v0" in md and FAKE_KEY not in md
    path = write_csv(rows, tmp_path / "r.csv")
    text = path.read_text(encoding="utf-8-sig")
    assert FAKE_KEY not in text
    parsed = list(csv.DictReader(text.splitlines()))
    assert parsed[0]["video_id"] == "smpl_A1" and parsed[0]["story_strength_source"] == "heuristic_v0"


def test_cli_run_fixture(tmp_path, capsys):
    db_path, out = tmp_path / "r.db", tmp_path / "reports"
    assert cli.main(["--db", str(db_path), "run", "--fixture", "--out", str(out)]) == 0
    assert list(out.glob("*.md")) and list(out.glob("*.csv"))
    assert cli.main(["--db", str(db_path), "verify", "smpl_A1", "--status", "in_progress",
                     "--source", "https://example.org/notice"]) == 0
    assert cli.main(["--db", str(db_path), "report", "--out", str(out), "--now", "2026-10-03T01:00:00Z"]) == 0
    md = sorted(out.glob("*.md"))[-1].read_text(encoding="utf-8")
    assert "IN_PROGRESS" in md and "FIXTURE MODE" in md


def test_cli_live_without_key_fails_cleanly(tmp_path, capsys, monkeypatch):
    monkeypatch.delenv("YOUTUBE_API_KEY", raising=False)
    monkeypatch.setattr("radar.config.PROJECT_ROOT", tmp_path)  # ignore any local .env
    assert cli.main(["--db", str(tmp_path / "r.db"), "run"]) == 2
    assert "YOUTUBE_API_KEY" in capsys.readouterr().err


def _rows(db, settings):
    return {r["video_id"]: r for r in build_rows(db, settings)}


def test_track_measures_trend_cheaply(db, settings, now):
    from datetime import timedelta

    run_fixture(db, settings, now)
    assert _rows(db, settings)["smpl_A1"]["velocity_ratio"] is None  # one observation only
    later = now + timedelta(hours=6)
    client = FixtureClient(quota=QuotaTracker(10_000), now=cli.to_iso(later))
    s = pipeline.track(client, db, settings, later, "fixture")
    assert s.refreshed == 8 and client.quota.used == 1  # one videos.list call, no searches
    pipeline.compute_metrics(db, settings, later)
    pipeline.score_candidates(db, settings, later)
    rows = _rows(db, settings)
    assert len(db.snapshots("smpl_A1")) == 2
    assert rows["smpl_A1"]["velocity_ratio"] == 1.5 and rows["smpl_A1"]["view_count"] == 1_450_000
    assert rows["smpl_H1"]["velocity_ratio"] > 1.2
    assert rows["smpl_B1"]["velocity_ratio"] < 0.8 and rows["smpl_D1"]["velocity_ratio"] < 0.8
    md = render_markdown(list(rows.values()), generated_at=later, mode="fixture", settings=settings)
    assert "↑1.5x/6h" in md and "↓" in md and "not** part of the Radar Score" in md


def test_trend_does_not_change_score_formula(db, settings, now):
    from datetime import timedelta

    run_fixture(db, settings, now)
    later = now + timedelta(hours=6)
    pipeline.track(FixtureClient(now=cli.to_iso(later)), db, settings, later, "fixture")
    pipeline.compute_metrics(db, settings, later)
    pipeline.score_candidates(db, settings, later)
    comps = _rows(db, settings)["smpl_A1"]["components"]
    assert set(comps) == {"outlier_ratio", "view_velocity", "freshness", "story_strength",
                          "korea_localization_gap", "localization_potential", "channel_fit"}


def test_candidates_leave_window(db, settings, now):
    from datetime import timedelta

    run_fixture(db, settings, now)
    much_later = now + timedelta(hours=settings.candidate_window_hours + 1)
    s = pipeline.track(FixtureClient(now=cli.to_iso(much_later)), db, settings, much_later, "fixture")
    assert s.refreshed == 0


def test_collect_reobserves_previous_candidates(db, settings, now, tmp_path):
    import json
    from datetime import timedelta

    run_fixture(db, settings, now)
    data = json.loads(FixtureClient().path.read_text(encoding="utf-8"))
    data["search"] = [e for e in data["search"] if e["match"]["q"] not in ("AI scam", "data breach")]
    path = tmp_path / "fixture.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    later = now + timedelta(hours=6)
    s = pipeline.collect(FixtureClient(path, now=cli.to_iso(later)), db, settings, later, "fixture")
    # smpl_A1, smpl_E1 and smpl_G1 were only found by the removed searches but are still in the window
    assert s.refreshed == 3
    assert len(db.snapshots("smpl_E1")) == 2 and len(db.snapshots("smpl_G1")) == 2 and len(db.snapshots("smpl_A1")) == 2


def test_cli_track(tmp_path, capsys):
    db_path, out = tmp_path / "r.db", tmp_path / "reports"
    assert cli.main(["--db", str(db_path), "track", "--fixture", "--out", str(out)]) == 0
    assert "no candidates" in capsys.readouterr().out
    assert cli.main(["--db", str(db_path), "run", "--fixture", "--out", str(out)]) == 0
    assert cli.main(["--db", str(db_path), "track", "--fixture", "--out", str(out)]) == 0
    md = (out / "radar_20261003_0600.md").read_text(encoding="utf-8")
    assert "FIXTURE MODE" in md and "↑1.5x/6h" in md
    # standalone report days later still shows the last observation's candidates
    assert cli.main(["--db", str(db_path), "report", "--out", str(out), "--now", "2026-10-08T00:00:00Z"]) == 0
    assert "smpl_A1" in (out / "radar_20261008_0000.md").read_text(encoding="utf-8")


def test_exclude_channel_countries_is_opt_in_and_keeps_data(db, settings, now):
    run_fixture(db, settings, now)
    assert len(build_rows(db, settings)) == 7
    settings.exclude_channel_countries = ["US"]  # every sample channel is US
    pipeline.score_candidates(db, settings, now)
    assert build_rows(db, settings) == []
    assert db.query("SELECT COUNT(*) AS n FROM videos")[0]["n"] > 0  # observed data untouched
    settings.exclude_channel_countries = []
    assert len(build_rows(db, settings)) == 7


def test_story_clusters_in_rows_and_csv(db, settings, now, tmp_path):
    run_fixture(db, settings, now)
    rows = build_rows(db, settings)
    assert all(r["story_cluster"].startswith("S") and r["cluster_size"] == 1 and r["cluster_leader"] for r in rows)
    assert len({r["story_cluster"] for r in rows}) == len(rows)
    text = write_csv(rows, tmp_path / "c.csv").read_text(encoding="utf-8-sig")
    parsed = list(csv.DictReader(text.splitlines()))
    assert parsed[0]["story_cluster"] == "S1" and parsed[0]["cluster_leader"] == "True"
    md = render_markdown(rows, generated_at=now, mode="fixture", settings=settings)
    assert "| Story |" in md and "Stories covered by several videos" not in md


def test_relevance_language_is_sent_with_every_search(db, settings, now):
    import json as _json
    settings.relevance_language = "en"
    run_fixture(db, settings, now)
    params = [_json.loads(r["params_json"]) for r in db.query("SELECT params_json FROM raw_responses WHERE endpoint = 'search'")]
    assert params and all(p.get("relevanceLanguage") == "en" for p in params)


def test_channels_without_country_survive_the_exclusion(db, settings, now):
    run_fixture(db, settings, now)
    db.conn.execute("UPDATE channels SET country = NULL WHERE channel_id = 'UCbytesized'")  # smpl_A1's channel
    db.conn.commit()
    settings.exclude_channel_countries = ["us"]  # case-insensitive
    assert [r["video_id"] for r in build_rows(db, settings)] == ["smpl_A1"]


def test_korea_gap_targets_one_video_per_story(db, settings, now):
    s = run_fixture(db, settings, now)
    a1 = db.video("smpl_A1")
    twin = {"id": "smpl_A1b", "snippet": {"channelId": a1["channel_id"], "publishedAt": a1["published_at"],
            "title": "My mom got a call from 'me' - the AI voice clone scam, full story", "description": ""},
            "contentDetails": {"duration": "PT40S"}, "statistics": {"viewCount": "900000", "likeCount": "1", "commentCount": "1"}}
    db.upsert_video(twin, cli.to_iso(now))
    db.add_discovery("smpl_A1b", s.run_id, "AI scam", "US", cli.to_iso(now))
    pipeline.compute_metrics(db, settings, now)
    pipeline.run_heuristics(db, settings, now)
    pipeline.score_candidates(db, settings, now)
    ranked = [r["video_id"] for r in pipeline.ranked_candidates(db, settings)]
    assert ranked[:2] == ["smpl_A1", "smpl_A1b"], "the twin ranks right behind the original"
    targets = pipeline.korea_gap_targets(db, settings, 3)
    assert targets[0] == "smpl_A1" and "smpl_A1b" not in targets and len(targets) == 3


def test_exclude_channel_countries_rejects_a_bare_string(tmp_path):
    import pytest
    from radar.config import DEFAULT_CONFIG_PATH, ConfigError, load_settings
    import re
    text = re.sub(r'^exclude_channel_countries = \[.*\]', 'exclude_channel_countries = "IN"',
                  DEFAULT_CONFIG_PATH.read_text(encoding="utf-8"), count=1, flags=re.M)
    assert 'exclude_channel_countries = "IN"' in text
    bad = tmp_path / "radar.toml"
    bad.write_text(text, encoding="utf-8")
    with pytest.raises(ConfigError):
        load_settings(bad, env={}, dotenv_path="/nonexistent/.env")


def test_cli_report_since_limits_to_new_discoveries(tmp_path):
    db_path, out = tmp_path / "r.db", tmp_path / "reports"
    assert cli.main(["--db", str(db_path), "run", "--fixture", "--out", str(out)]) == 0
    # nothing discovered after the fixture time -> empty report, not an error
    assert cli.main(["--db", str(db_path), "report", "--out", str(out), "--now", "2026-10-03T01:00:00Z",
                     "--since", "2026-10-03T00:30:00Z"]) == 0
    md = (out / "radar_20261003_0100.md").read_text(encoding="utf-8")
    assert "No Short candidates" in md
    assert cli.main(["--db", str(db_path), "report", "--out", str(out), "--now", "2026-10-03T02:00:00Z",
                     "--since", "2026-10-03T00:00:00Z"]) == 0
    assert "smpl_A1" in (out / "radar_20261003_0200.md").read_text(encoding="utf-8")
