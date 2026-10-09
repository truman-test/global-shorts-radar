import json
import os

import pytest

from radar.production.remotion_render import build_props, caption_pages, ensure_sfx, word_timings
from radar.production.script import Scene, Script, load_script, validate


def test_word_timings_exact_when_boundaries_match_display_words():
    display = "보낸 돈은 2억 홍콩달러,".split()
    marks = [(0.0, 0.3, "보낸"), (0.35, 0.6, "돈은"), (0.7, 1.0, "이억"), (1.05, 1.6, "홍콩달러")]
    out = word_timings(display, marks, 0.0, 1.7)
    assert out == [("보낸", 0.0, 0.3), ("돈은", 0.35, 0.6), ("2억", 0.7, 1.0), ("홍콩달러,", 1.05, 1.6)]


def test_word_timings_fall_back_to_character_weights():
    out = word_timings(["가", "가나다라"], None, 0.0, 1.0)
    assert out[0][1] == 0.0 and abs(out[0][2] - 0.2) < 1e-9 and abs(out[1][2] - 1.0) < 1e-9
    assert word_timings(["가", "나"], [(0, 1, "가")], 0.0, 2.0)[1][2] == 2.0, "count mismatch -> proportional"


def test_caption_pages_follow_chunking_and_never_overlap():
    narration = "엄마, 나야. 사고가 났어. 지금 바로 돈이 필요해."
    words = word_timings(narration.split(), None, 0.9, 4.0)
    pages = caption_pages(narration, words, scene_end=4.3)
    assert [len(p["words"]) for p in pages] == [2, 2, 4]
    assert pages[0]["startMs"] == 900
    for a, b in zip(pages, pages[1:]):
        assert a["endMs"] == b["startMs"]
    assert pages[-1]["endMs"] <= 4300


def test_call_layout_needs_a_caller():
    s = Script(id="2026-10-08-t", source_video_id="x", title="제목 테스트입니다", description="", tags=[],
               disclaimer="※ 재연", sources=[{"url": "https://example.org"}],
               scenes=[Scene("엄마 나야 사고가 났어 지금 바로 돈이 필요해", "전화", "phone", layout="call")] * 3)
    assert any("caller" in e for e in validate(s)[0])
    assert any("unknown layout" in e for e in validate(Script(**{**s.__dict__, "scenes": [Scene("엄마 나야 사고가 났어 지금 돈이 필요해", "x", "phone", layout="map")] * 3}))[0])


NARR = "엄마 나야 사고가 났어 지금 바로 돈이 필요해"


def _errors(**kw) -> list[str]:
    s = Script(id="2026-10-09-t", source_video_id="x", title="제목 테스트입니다", description="", tags=[],
               disclaimer="※ 재연", sources=[{"url": "https://example.org"}],
               scenes=[Scene(NARR, "헤드라인", "phone", **kw)] + [Scene(NARR, "카드", "phone")] * 2)
    return [e for e in validate(s)[0] if e.startswith("scene 1")]


GOOD = {
    "chat": dict(chat_title="딸", messages=[{"from": "them", "text": "엄마 나 폰 고장났어"}, {"from": "me", "text": "괜찮아?"}]),
    "sms": dict(sender="택배 안내", sms_text="주소 불일치로 보관 중입니다. 확인: http://●●●●.kr/…"),
    "alert": dict(app_label="은행 앱", alert_text="고객님 계좌에서 1,280,000원이 출금되었습니다."),
    "stat": dict(stat_value="6,581억 원", stat_label="한 해 피해액"),
    "timeline": dict(steps=[{"when": "1일차", "text": "메신저로 접근"}, {"when": "2일차", "text": "앱 설치 유도"}]),
    "checklist": dict(items=["가족 암호 정하기", "링크 누르지 않기"]),
}


@pytest.mark.parametrize("layout", sorted(GOOD))
def test_new_layouts_validate_and_need_their_fields(layout):
    assert _errors(layout=layout, **GOOD[layout]) == []
    missing = _errors(layout=layout)
    assert missing and all(f"layout '{layout}' needs" in e for e in missing)


@pytest.mark.parametrize("field,text,problem", [
    ("sms_text", "확인: http://evil-site.kr/a", "unmasked link"),
    ("sms_text", "확인: www.●●●●.com", "unmasked link"),
    ("sms_text", "확인 bit.ly/3xYz", "unmasked link"),
    ("sms_text", "확인: http://●●●●.kr/abc", "unmasked link"),
    ("sms_text", "확인: http://●●●●.●●●●.●●●●.com/●●●●●", "longer than 24"),
    ("sms_text", "문의 010-1234-5678", "real-looking number"),
    ("sms_text", "문의 1588-1234 로 연락", "real-looking number"),
    ("sms_text", "계좌 12345678901 입금", "real-looking number"),
    ("sender", "02-123-4567", "real-looking number"),
    ("sender", "국민은행", "real brand"),
    ("sms_text", "[Toss] 결제 확인", "real brand"),
])
def test_sms_mockup_rejects_real_links_numbers_and_brands(field, text, problem):
    fields = dict(GOOD["sms"], **{field: text})
    assert any(problem in e for e in _errors(layout="sms", **fields))


def test_masked_values_and_lookalike_words_are_allowed():
    from radar.production.script import mockup_text_problems
    assert mockup_text_problems("확인: http://●●●●.kr/…") == []
    assert mockup_text_problems("링크 http://●●●.●●●.com/●●에서 확인") == []
    assert mockup_text_problems("발신 010-●●●●-●●●●") == []
    assert mockup_text_problems("토스트 한 조각, 1,280,000원 출금, 3일차") == []


def test_chat_alert_stat_timeline_checklist_limits():
    assert any("'from'" in e for e in _errors(layout="chat", messages=[{"from": "mom", "text": "안녕"}]))
    assert any("at most 5" in e for e in _errors(layout="chat", messages=[{"from": "me", "text": "응"}] * 6))
    assert any("real brand" in e for e in _errors(layout="chat", chat_title="딸",
                                                   messages=[{"from": "them", "text": "카카오페이로 보내줘"}]))
    assert any("real brand" in e for e in _errors(layout="alert", app_label="신한 앱", alert_text="출금 알림"))
    assert any("no number" in e for e in _errors(layout="stat", stat_value="아주 많음", stat_label="피해"))
    assert any("2-4 steps" in e for e in _errors(layout="timeline", steps=[{"when": "1일", "text": "접근"}]))
    assert any("2-4 items" in e for e in _errors(layout="checklist", items=["하나"] * 5))
    assert any("longer than" in e for e in _errors(layout="alert", app_label="은행 앱", alert_text="가" * 71))


def test_load_script_reads_layout_fields(tmp_path):
    data = json.loads(open("content/scripts/2026-10-08-family-password.json", encoding="utf-8").read())
    data["scenes"][1].update(layout="chat", chat_title="딸", messages=[{"from": "them", "text": "엄마 나야"}])
    data["scenes"][2].update(layout="timeline", steps=[{"when": "1일차", "text": "접근"}, {"when": "2일차", "text": "송금"}])
    p = tmp_path / "s.json"
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    s = load_script(p)
    assert s.scenes[1].messages == [{"from": "them", "text": "엄마 나야"}] and s.scenes[1].chat_title == "딸"
    assert s.scenes[2].steps[1] == {"when": "2일차", "text": "송금"}
    assert validate(s)[0] == []


def test_scene_props_carry_layout_fields_in_camel_case():
    from radar.production.remotion_render import LEAD_IN, scene_props
    expect = {
        "chat": {"chatTitle": "딸", "messages": GOOD["chat"]["messages"]},
        "sms": {"sender": "택배 안내", "smsText": GOOD["sms"]["sms_text"]},
        "alert": {"appLabel": "은행 앱", "alertText": GOOD["alert"]["alert_text"]},
        "stat": {"statValue": "6,581억 원", "statLabel": "한 해 피해액"},
        "timeline": {"steps": GOOD["timeline"]["steps"]},
        "checklist": {"items": GOOD["checklist"]["items"]},
    }
    base = {"layout", "audio", "leadInMs", "speechMs", "durationMs", "pages", "headline", "sub", "icon", "accent"}
    for layout, extra in expect.items():
        props = scene_props(Scene(NARR, "헤드", "phone", layout=layout, **GOOD[layout]), "a.wav", 0.0, 2.0, 2.25, [])
        assert set(props) == base | set(extra) and all(props[k] == v for k, v in extra.items())
    card = scene_props(Scene(NARR, "헤드", "phone"), "", 0.0, 1.0, 1.25, [])
    assert set(card) == base
    assert LEAD_IN["call"] > LEAD_IN["alert"] > 0 and "chat" not in LEAD_IN


def test_family_script_uses_the_call_layout():
    s = load_script("content/scripts/2026-10-08-family-password.json")
    assert s.scenes[0].layout == "call" and s.scenes[0].caller == "딸"
    assert validate(s)[0] == []


def test_build_props_shape():
    s = load_script("content/scripts/2026-10-08-family-password.json")
    props = build_props(s, [{"layout": "card"}], "채널")
    assert props == {"channel": "채널", "voiceLabel": "AI 음성", "disclaimer": s.disclaimer, "sfx": True,
                     "music": None, "scenes": [{"layout": "card"}]}
    json.dumps(props, ensure_ascii=False)


def test_music_props_resolve_from_manifest(tmp_path, monkeypatch):
    from radar.production import assets
    from radar.production.assemble import ProductionError
    from radar.production.remotion_render import MUSIC_DUCK, music_props
    s = load_script("content/scripts/2026-10-08-family-password.json")
    assert s.music == "tense"
    fake = tmp_path / "video" / "public" / "music" / "t.mp3"
    fake.parent.mkdir(parents=True)
    fake.write_bytes(b"x" * 20)
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"music": [{"id": "t", "mood": "tense", "title": "T", "artist": "A",
                                               "file": "video/public/music/t.mp3", "license": "L",
                                               "license_url": "u", "attribution_required": False}]}), encoding="utf-8")
    monkeypatch.setattr(assets, "PROJECT_ROOT", tmp_path)
    monkeypatch.setattr(assets, "MANIFEST", manifest)
    monkeypatch.setattr(assets, "music_for", lambda mood, path=manifest: assets.__dict__["load_manifest"](manifest)["music"][0])
    props, item = music_props(s)
    assert props == {"src": "music/t.mp3", "volume": 0.22, "duckVolume": MUSIC_DUCK} and item["id"] == "t"
    s.music = ""
    assert music_props(s) == (None, None)
    monkeypatch.setattr(assets, "music_for", lambda mood, path=manifest: None)
    s.music = "tense"
    with pytest.raises(ProductionError):
        music_props(s)


def test_unknown_music_mood_is_a_script_error():
    s = load_script("content/scripts/2026-10-08-family-password.json")
    s.music = "polka"
    assert any("music mood" in e for e in validate(s)[0])


def test_ensure_sfx_generates_our_own_sounds(tmp_path):
    pytest.importorskip("imageio_ffmpeg")
    from radar.production.assemble import media_info
    out = ensure_sfx(tmp_path)
    for name in ("ring", "vibrate", "whoosh", "pop", "ding"):
        seconds, _ = media_info(out / f"{name}.wav")
        assert seconds > 0.1, name


@pytest.mark.skipif(os.environ.get("RADAR_TEST_REMOTION") != "1", reason="slow: set RADAR_TEST_REMOTION=1 to render")
def test_remotion_render_end_to_end(tmp_path):
    from radar.production.remotion_render import produce_remotion
    from radar.production.tts import ToneTTS
    s = load_script("content/scripts/2026-10-08-family-password.json")
    s.scenes = s.scenes[:2]
    result = produce_remotion(s, tmp_path, tts=ToneTTS(), channel_name="테스트")
    assert result.size == "1080x1920" and result.duration > 5
