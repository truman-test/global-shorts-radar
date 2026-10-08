import json

from radar import cli, pipeline
from radar.analysis.story_dna import import_story_dna
from radar.collectors.fixture import FixtureClient
from radar.collectors.youtube import QuotaTracker
from radar.reports.brief import brief_rows, render_brief
from radar.reports.build import build_rows

ANALYSIS = {
    "video_id": "smpl_A1",
    "topic": "AI 음성 복제 전화 사기", "hook": "엄마가 '나'에게 전화를 받았다", "curiosity_gap": "3초 음성으로 어떻게 가족을 속이나",
    "conflict": "가족 vs 보이지 않는 사기범", "emotion": "공포, 배신감", "story_progression": "평범한 전화 → 의심 → 확인 → 대응법",
    "reveal": "목소리는 SNS 영상 3초에서 복제됨", "payoff": "가족 암호를 정하라", "audience_desire_fear": "내 가족도 당할 수 있다",
    "why_viral": "누구나 겪을 수 있는 공포 + 즉시 쓸 수 있는 해법", "korean_angle": "보이스피싱 대응 '가족 암호' 캠페인",
    "judgments": {"story_strength": {"value": 0.85, "rationale": "반전과 해법이 분명"}},
    "independent_sources": [{"url": "https://www.fbi.gov/example", "type": "government_police_company", "note": "FBI PSA"}],
    "author": "agent-1",
}


def _run(db, settings, now):
    client = FixtureClient(quota=QuotaTracker(10_000))
    pipeline.collect(client, db, settings, now, "fixture")
    pipeline.compute_metrics(db, settings, now)
    pipeline.run_heuristics(db, settings, now)
    pipeline.score_candidates(db, settings, now)


def _analyze(db, tmp_path, *entries):
    p = tmp_path / "dna.json"
    p.write_text(json.dumps(list(entries), ensure_ascii=False), encoding="utf-8")
    assert import_story_dna(db, p, "2026-10-03T01:00:00Z", "llm:x")[1] == []


def test_brief_prefers_verified_then_score_and_needs_story_dna(db, settings, now, tmp_path):
    _run(db, settings, now)
    _analyze(db, tmp_path, ANALYSIS, {**ANALYSIS, "video_id": "smpl_D1"}, {**ANALYSIS, "video_id": "smpl_E1"})
    pipeline.score_candidates(db, settings, now)
    rows = build_rows(db, settings)
    picked = brief_rows(rows, top=3)
    assert [r["video_id"] for r in picked][0] == "smpl_A1", "best score first while all are in_progress"
    db.set_verification("smpl_E1", "verified", "2026-10-03T02:00:00Z", ["https://police.example/x"], "ok")
    picked = brief_rows(build_rows(db, settings), top=3)
    assert picked[0]["video_id"] == "smpl_E1", "verified story jumps to the top"
    assert all(r["story_dna"] for r in picked) and "smpl_H1" not in [r["video_id"] for r in picked]
    db.set_verification("smpl_E1", "false", "2026-10-03T03:00:00Z", [], "debunked")
    assert "smpl_E1" not in [r["video_id"] for r in brief_rows(build_rows(db, settings), top=3)]
    assert [r["video_id"] for r in brief_rows(build_rows(db, settings), top=3, produced={"smpl_A1"})][0] == "smpl_D1"
    low_fit = {**ANALYSIS, "video_id": "smpl_D1", "topic": "배터리 잡담 (주제 밖)", "judgments": {"channel_fit": 0.2}}  # new fields: not a duplicate
    _analyze(db, tmp_path, low_fit)
    pipeline.score_candidates(db, settings, now)
    assert "smpl_D1" not in [r["video_id"] for r in brief_rows(build_rows(db, settings), top=3)], "off-topic stories leave the brief"


def test_render_brief_contents(db, settings, now, tmp_path):
    _run(db, settings, now)
    _analyze(db, tmp_path, ANALYSIS)
    pipeline.score_candidates(db, settings, now)
    md = render_brief(brief_rows(build_rows(db, settings), 3), generated_at=now, settings=settings)
    assert "## 1. My mom got a call" in md and "- 소재: AI 음성 복제 전화 사기" in md
    assert "0–3초 훅: 엄마가 '나'에게 전화를 받았다" in md
    assert "https://www.fbi.gov/example" in md and "검증 진행 중" in md and "제작 전 확인" in md
    assert "채널 평소의 20.0배" in md
    assert "후보가 없습니다" in render_brief([], generated_at=now, settings=settings)


def test_cli_brief_and_publish_log(tmp_path, capsys):
    db_path, out = tmp_path / "r.db", tmp_path / "out"
    assert cli.main(["--db", str(db_path), "run", "--fixture", "--out", str(out)]) == 0
    dna = tmp_path / "dna.json"
    dna.write_text(json.dumps([ANALYSIS, {**ANALYSIS, "video_id": "smpl_H1"}], ensure_ascii=False), encoding="utf-8")
    assert cli.main(["--db", str(db_path), "story-dna", "--import", str(dna), "--source", "llm:t"]) == 0
    assert cli.main(["--db", str(db_path), "brief", "--top", "3", "--out", str(out), "--now", "2026-10-03T02:00:00Z"]) == 0
    md = (out / "brief_20261003_0200.md").read_text(encoding="utf-8")
    assert md.count("\n## ") == 2
    assert cli.main(["--db", str(db_path), "publish-log", "smpl_A1", "--url", "https://youtube.com/shorts/mine1",
                     "--title", "우리 집 비밀 암호", "--now", "2026-10-03T03:00:00Z"]) == 0
    assert cli.main(["--db", str(db_path), "brief", "--top", "3", "--out", str(out), "--now", "2026-10-03T04:00:00Z"]) == 0
    md2 = (out / "brief_20261003_0400.md").read_text(encoding="utf-8")
    assert md2.count("\n## ") == 1 and "smpl_A1" not in md2
    assert cli.main(["--db", str(db_path), "publish-log", "nope", "--url", "https://x"]) == 2
