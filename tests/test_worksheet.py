import csv

from radar import cli, pipeline
from radar.analysis.manual import import_manual_csv
from radar.collectors.fixture import FixtureClient
from radar.collectors.youtube import QuotaTracker
from radar.reports.build import build_rows
from radar.reports.worksheet import CSV_COLUMNS, render_worksheet_markdown, worksheet_rows, write_worksheet_csv
from radar.scoring.radar import JUDGMENT_DIMENSIONS


def _run(db, settings, now):
    client = FixtureClient(quota=QuotaTracker(10_000))
    s = pipeline.collect(client, db, settings, now, "fixture")
    pipeline.compute_metrics(db, settings, now)
    pipeline.run_heuristics(db, settings, now)
    pipeline.score_candidates(db, settings, now)
    return s


def test_worksheet_csv_round_trips_into_manual_judgments(db, settings, now, tmp_path):
    _run(db, settings, now)
    rows = worksheet_rows(build_rows(db, settings), top_n=3)
    assert [r["rank"] for r in rows] == [1, 2, 3]
    path = write_worksheet_csv(rows, tmp_path / "judgments.csv")
    text = path.read_text(encoding="utf-8-sig")
    parsed = list(csv.DictReader(text.splitlines()))
    assert list(parsed[0].keys()) == CSV_COLUMNS
    assert len(parsed) == 3 * len(JUDGMENT_DIMENSIONS) and all(p["value"] == "" for p in parsed)
    assert parsed[0]["heuristic_source"] == "heuristic_v0" and parsed[0]["url"].endswith(parsed[0]["video_id"])

    # analyst fills two cells, leaves the rest blank
    for p in parsed:
        if p["video_id"] == "smpl_A1" and p["dimension"] == "story_strength":
            p["value"], p["rationale"], p["author"] = "0.9", "반전이 분명", "kim"
        if p["video_id"] == "smpl_A1" and p["dimension"] == "channel_fit":
            p["value"] = "1"
    with path.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=CSV_COLUMNS)
        w.writeheader()
        w.writerows(parsed)
    n, errors = import_manual_csv(db, path, "2026-10-03T01:00:00Z")
    assert (n, errors) == (2, []), "blank values are skipped, not errors"
    pipeline.score_candidates(db, settings, now)
    a1 = {r["video_id"]: r for r in build_rows(db, settings)}["smpl_A1"]
    assert a1["judgments"]["story_strength"]["source"] == "manual" and a1["judgments"]["story_strength"]["value"] == 0.9
    assert a1["judgments"]["localization_potential"]["source"] == "heuristic_v0"


def test_worksheet_markdown_lists_leaders_with_guide_and_story_dna(db, settings, now):
    _run(db, settings, now)
    rows = worksheet_rows(build_rows(db, settings), top_n=2)
    md = render_worksheet_markdown(rows, generated_at=now, csv_name="judgments_x.csv")
    assert "판단 기준" in md and "Story Strength" in md and "radar judge --import judgments_x.csv" in md
    assert md.count("### ") == 2 and "smpl_A1" in md and "Story DNA" in md and "heuristic_v0" in md
    assert "후보가 없습니다" in render_worksheet_markdown([], generated_at=now, csv_name="x.csv")


def test_cli_worksheet(tmp_path):
    db_path, out = tmp_path / "r.db", tmp_path / "out"
    assert cli.main(["--db", str(db_path), "run", "--fixture", "--out", str(out)]) == 0
    assert cli.main(["--db", str(db_path), "worksheet", "--top", "5", "--out", str(out), "--now", "2026-10-03T02:00:00Z"]) == 0
    md, csv_path = out / "worksheet_20261003_0200.md", out / "judgments_20261003_0200.csv"
    assert md.is_file() and csv_path.is_file()
    assert "judgments_20261003_0200.csv" in md.read_text(encoding="utf-8")
    assert len(list(csv.DictReader(csv_path.read_text(encoding="utf-8-sig").splitlines()))) == 5 * len(JUDGMENT_DIMENSIONS)
