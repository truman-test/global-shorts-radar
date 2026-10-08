import json

from radar import cli, pipeline
from radar.analysis.story_dna import FIELDS, export_bundle, import_story_dna
from radar.collectors.fixture import FixtureClient
from radar.collectors.youtube import QuotaTracker
from radar.reports.build import build_rows, render_markdown


def _run(db, settings, now):
    client = FixtureClient(quota=QuotaTracker(10_000))
    pipeline.collect(client, db, settings, now, "fixture")
    pipeline.compute_metrics(db, settings, now)
    pipeline.run_heuristics(db, settings, now)
    pipeline.score_candidates(db, settings, now)


ANALYSIS = {
    "video_id": "smpl_A1",
    "topic": "AI 음성 복제 전화 사기",
    "hook": "엄마가 '나'에게 전화를 받았다",
    "curiosity_gap": "3초 음성으로 어떻게 가족을 속이나",
    "conflict": "가족 vs 보이지 않는 사기범",
    "emotion": "공포, 배신감",
    "story_progression": "평범한 전화 → 의심 → 확인 → 대응법",
    "reveal": "목소리는 SNS 영상 3초에서 복제됨",
    "payoff": "가족 암호를 정하라",
    "audience_desire_fear": "내 가족도 당할 수 있다",
    "why_viral": "누구나 겪을 수 있는 공포 + 즉시 쓸 수 있는 해법",
    "korean_angle": "보이스피싱 대응 '가족 암호' 캠페인, 경찰청 자료 기반",
    "judgments": {"story_strength": {"value": 0.85, "rationale": "반전과 해법이 분명"},
                  "korea_localization_gap": 0.6},
    "independent_sources": [{"url": "https://www.fbi.gov/example", "type": "government_police_company", "note": "FBI PSA"}],
    "author": "agent-1",
}


def test_export_bundle_has_public_metadata_only(db, settings, now):
    _run(db, settings, now)
    rows = build_rows(db, settings)
    bundle = export_bundle(db, rows[:2])
    assert [b["video_id"] for b in bundle] == [rows[0]["video_id"], rows[1]["video_id"]]
    b = bundle[0]
    assert b["title"] and "description" in b and b["observed"]["views"] == rows[0]["view_count"]
    assert "story_strength" in b["current_judgments"] and b["current_judgments"]["story_strength"]["source"] == "heuristic_v0"
    assert "transcript" not in json.dumps(bundle).lower()


def test_import_round_trip_judgments_and_verification(db, settings, now, tmp_path):
    _run(db, settings, now)
    p = tmp_path / "dna.json"
    p.write_text(json.dumps([ANALYSIS], ensure_ascii=False), encoding="utf-8")
    n, errors = import_story_dna(db, p, "2026-10-03T01:00:00Z", "llm:claude-fable-5-1")
    assert (n, errors) == (1, [])
    dna = db.story_dna("smpl_A1")
    assert dna["source"] == "llm:claude-fable-5-1" and json.loads(dna["fields_json"])["hook"] == ANALYSIS["hook"]
    pipeline.score_candidates(db, settings, now)
    row = {r["video_id"]: r for r in build_rows(db, settings)}["smpl_A1"]
    assert row["judgments"]["story_strength"]["source"] == "llm:claude-fable-5-1"
    assert row["judgments"]["story_strength"]["value"] == 0.85
    assert row["judgments"]["korea_localization_gap"]["value"] == 0.6
    assert row["judgments"]["localization_potential"]["source"] == "heuristic_v0", "untouched dimensions keep their source"
    assert row["verification_status"] == "in_progress" and row["verification_sources"] == ["https://www.fbi.gov/example"]
    assert row["story_dna"]["fields"]["topic"] == ANALYSIS["topic"]


def test_import_never_marks_verified_and_respects_human_status(db, settings, now, tmp_path):
    _run(db, settings, now)
    db.set_verification("smpl_A1", "false", "2026-10-03T00:30:00Z", ["https://police.example/notice"], "debunked")
    p = tmp_path / "dna.json"
    p.write_text(json.dumps([{**ANALYSIS, "verification_status": "verified"}]), encoding="utf-8")
    assert import_story_dna(db, p, "2026-10-03T01:00:00Z", "llm:x")[0] == 1
    assert db.verification("smpl_A1")["status"] == "false", "a human verdict is never overwritten by an agent"


def test_import_rejects_bad_entries_but_keeps_good_ones(db, settings, now, tmp_path):
    _run(db, settings, now)
    bad = [{"video_id": "nope", "topic": "x"},
           {**ANALYSIS, "judgments": {"story_strength": 1.5}},
           {**ANALYSIS, "independent_sources": [{"url": "not a url"}]},
           {**ANALYSIS, "video_id": "smpl_H1"}]
    p = tmp_path / "dna.json"
    p.write_text(json.dumps(bad), encoding="utf-8")
    n, errors = import_story_dna(db, p, "2026-10-03T01:00:00Z", "manual")
    assert n == 1 and len(errors) == 3 and db.story_dna("smpl_H1") is not None
    assert import_story_dna(db, p, "x", "robot")[1][0].startswith("source must be")


def test_manual_story_dna_outranks_llm(db, settings, now, tmp_path):
    _run(db, settings, now)
    p = tmp_path / "dna.json"
    p.write_text(json.dumps([ANALYSIS]), encoding="utf-8")
    import_story_dna(db, p, "2026-10-03T02:00:00Z", "llm:x")
    p.write_text(json.dumps([{**ANALYSIS, "hook": "사람이 쓴 훅"}]), encoding="utf-8")
    import_story_dna(db, p, "2026-10-03T01:00:00Z", "manual")  # older but human
    assert json.loads(db.story_dna("smpl_A1")["fields_json"])["hook"] == "사람이 쓴 훅"


def test_report_renders_filled_story_dna_with_source(db, settings, now, tmp_path):
    _run(db, settings, now)
    p = tmp_path / "dna.json"
    p.write_text(json.dumps([ANALYSIS], ensure_ascii=False), encoding="utf-8")
    import_story_dna(db, p, "2026-10-03T01:00:00Z", "llm:claude-fable-5-1")
    pipeline.score_candidates(db, settings, now)
    md = render_markdown(build_rows(db, settings), generated_at=now, mode="fixture", settings=settings)
    assert "**Story DNA** (llm:claude-fable-5-1" in md and "- Hook: 엄마가 '나'에게 전화를 받았다" in md
    assert "https://www.fbi.gov/example" in md and "IN_PROGRESS" in md
    assert md.count("- [ ] Topic:") == 6, "the other six candidates still show the empty checklist"


def test_cli_story_dna_export_and_import(tmp_path, capsys):
    db_path, out = tmp_path / "r.db", tmp_path / "out"
    assert cli.main(["--db", str(db_path), "run", "--fixture", "--out", str(out)]) == 0
    bundle = tmp_path / "bundle.json"
    assert cli.main(["--db", str(db_path), "story-dna", "--export", "3", "--out", str(bundle)]) == 0
    data = json.loads(bundle.read_text(encoding="utf-8"))
    assert len(data) == 3 and data[0]["video_id"] == "smpl_A1" and set(FIELDS) & set(data[0].keys()) == set()
    dna = tmp_path / "dna.json"
    dna.write_text(json.dumps([ANALYSIS], ensure_ascii=False), encoding="utf-8")
    assert cli.main(["--db", str(db_path), "story-dna", "--import", str(dna), "--source", "llm:test"]) == 0
    assert "imported 1" in capsys.readouterr().out
    assert cli.main(["--db", str(db_path), "story-dna", "--import", str(dna), "--source", "bot"]) == 1


def test_export_bundle_hides_human_and_llm_judgments_to_avoid_anchoring(db, settings, now, tmp_path):
    _run(db, settings, now)
    p = tmp_path / "dna.json"
    p.write_text(json.dumps([ANALYSIS]), encoding="utf-8")
    import_story_dna(db, p, "2026-10-03T01:00:00Z", "llm:x")
    pipeline.score_candidates(db, settings, now)
    rows = build_rows(db, settings)
    b = export_bundle(db, [r for r in rows if r["video_id"] == "smpl_A1"])[0]
    assert "story_strength" not in b["current_judgments"], "the llm value is hidden from the next analyst"
    assert b["current_judgments"]["localization_potential"]["source"] == "heuristic_v0"


def test_import_is_idempotent(db, settings, now, tmp_path):
    _run(db, settings, now)
    p = tmp_path / "dna.json"
    p.write_text(json.dumps([ANALYSIS]), encoding="utf-8")
    assert import_story_dna(db, p, "2026-10-03T01:00:00Z", "llm:x") == (1, [])
    n, errors = import_story_dna(db, p, "2026-10-03T02:00:00Z", "llm:x")
    assert n == 0 and "already imported" in errors[0]
    assert db.query("SELECT COUNT(*) AS n FROM story_dna")[0]["n"] == 1
    assert db.query("SELECT COUNT(*) AS n FROM judgments WHERE source = 'llm:x'")[0]["n"] == 2
    assert import_story_dna(db, p, "2026-10-03T03:00:00Z", "manual")[0] == 1, "a different source is a new analysis"
