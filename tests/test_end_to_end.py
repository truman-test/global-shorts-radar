import csv

from radar import cli, pipeline
from radar.collectors.fixture import FixtureClient
from radar.collectors.youtube import QuotaTracker
from radar.reports.build import build_rows, render_markdown, write_csv

FAKE_KEY = "AIzaFAKE-e2e-key-should-never-appear"


def run_fixture(db, settings, now, korea=0, budget=10_000):
    client = FixtureClient(quota=QuotaTracker(budget))
    s = pipeline.collect(client, db, settings, now, "fixture")
    pipeline.compute_metrics(db, settings, now, s.run_id)
    pipeline.run_heuristics(db, settings, now, s.run_id)
    pipeline.score_candidates(db, settings, now, s.run_id)
    if korea:
        pipeline.run_korea_gap(client, db, settings, now, korea, s.run_id)
        pipeline.score_candidates(db, settings, now, s.run_id)
    return s


def test_fixture_ranking(db, settings, now):
    s = run_fixture(db, settings, now)
    assert s.searches == len(settings.keywords) and not s.errors
    rows = build_rows(db)
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
    pipeline.run_heuristics(db, settings, now, s.run_id)
    assert len(db.query("SELECT * FROM judgments")) == before


def test_korea_gap_changes_ranking(db, settings, now):
    run_fixture(db, settings, now, korea=5)
    rows = {r["video_id"]: r for r in build_rows(db)}
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
    rows = build_rows(db)
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
