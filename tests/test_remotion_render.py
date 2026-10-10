import json
import os
import zlib

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
    "compare": dict(real={"label": "진짜", "title": "공식 앱 안 알림", "points": ["앱에서 직접 확인"]},
                    fake={"label": "가짜", "title": "010-●●●●-●●●●", "points": ["주소 확인 링크"]}),
    "toggle": dict(path=["보안", "결제 인증"], setting="구매 시 인증 요구", toggle_to="on"),
    "flow": dict(nodes=[{"text": "문자를 받았다"}, {"text": "링크가 있다?", "yes": "누르지 않기"},
                        {"text": "공식 앱에서 조회"}]),
    "dots": dict(total=1000, stages=[{"label": "링크 클릭", "count": 120}, {"label": "금전 피해", "count": 9}]),
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
        "compare": {"real": GOOD["compare"]["real"], "fake": GOOD["compare"]["fake"]},
        "toggle": {"path": ["보안", "결제 인증"], "setting": "구매 시 인증 요구", "toggleTo": "on"},
        "flow": {"nodes": GOOD["flow"]["nodes"]},
        "dots": {"total": 1000, "stages": GOOD["dots"]["stages"], "unit": "명"},
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
                     "music": None, "transition": "continuity", "posterTailMs": 500, "theme": "classic",
                     "episode": s.id, "seed": zlib.crc32(s.id.encode("utf-8")), "shareLine": "부모님께도 보내 주세요",
                     "cta": "매일 1장, 생존노트", "scenes": [{"layout": "card"}]}
    # the seed is deterministic (per-episode stage variants, nothing random at render time)
    assert build_props(s, [], "채널")["seed"] == props["seed"]
    assert build_props(s, [], "채널", theme="pulse")["theme"] == "pulse"
    json.dumps(props, ensure_ascii=False)
    assert build_props(s, [], "채널", transition="classic")["transition"] == "classic"


def test_transition_comes_from_production_config(tmp_path):
    import pytest

    from radar.config import ConfigError
    from radar.production.config import load_production_config

    cfg = tmp_path / "radar.toml"
    cfg.write_text("[production]\nengine = \"remotion\"\n", encoding="utf-8")
    assert load_production_config(cfg, env={}, dotenv_path=tmp_path / "none").transition == "continuity"
    cfg.write_text("[production]\ntransition = \"Classic\"\n", encoding="utf-8")
    assert load_production_config(cfg, env={}, dotenv_path=tmp_path / "none").transition == "classic"
    cfg.write_text("[production]\ntransition = \"wipe\"\n", encoding="utf-8")
    with pytest.raises(ConfigError):
        load_production_config(cfg, env={}, dotenv_path=tmp_path / "none")
    # the shipped config keeps the default
    assert load_production_config(env={}, dotenv_path=tmp_path / "none").transition == "continuity"


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


@pytest.mark.parametrize("kw,problem", [
    (dict(layout="compare", real={"label": "진짜", "title": "", "points": []}, fake=GOOD["compare"]["fake"]), "real.title"),
    (dict(layout="compare", real=GOOD["compare"]["real"], fake={"label": "가짜", "title": "http://evil.kr/a", "points": []}),
     "unmasked link"),
    (dict(layout="compare", real=GOOD["compare"]["real"], fake={"label": "가짜", "title": "카카오 알림", "points": []}),
     "real brand"),
    (dict(layout="compare", real=GOOD["compare"]["real"],
          fake={"label": "가짜", "title": "가짜 문자", "points": ["가" * 15]}), "points"),
    (dict(layout="toggle", path=["보안"] * 4, setting="인증"), "1-3 menu steps"),
    (dict(layout="toggle", path=["보안"], setting="인증", toggle_to="maybe"), "toggle_to"),
    (dict(layout="toggle", path=["보안"], setting="가" * 15), "longer than 14"),
    (dict(layout="flow", nodes=[{"text": "하나"}, {"text": "둘"}]), "3-5 nodes"),
    (dict(layout="flow", nodes=[{"text": "가"}, {"text": "나", "yes": "다", "no": "라"}, {"text": "마"}]), "not both"),
    (dict(layout="flow", nodes=[{"text": "가" * 17}, {"text": "나"}, {"text": "다"}]), "1-16 characters"),
    (dict(layout="dots", total=5, stages=[{"label": "a", "count": 3}, {"label": "b", "count": 1}]), "10-1,000,000"),
    (dict(layout="dots", total=100, stages=[{"label": "클릭", "count": 30}, {"label": "피해", "count": 40}]), "funnel"),
    (dict(layout="dots", total=100, stages=[{"label": "클릭", "count": 30}]), "2-4 stages"),
    (dict(layout="dots", total=100, stages=[{"label": "클릭", "count": -1}, {"label": "피해", "count": 1}]), "whole number"),
    (dict(mark="없는 말"), "not part of the headline"),
])
def test_new_layout_rules(kw, problem):
    assert any(problem in e for e in _errors(**kw)), _errors(**kw)


def test_new_layouts_load_from_json(tmp_path):
    data = json.loads(open("content/scripts/2026-10-08-family-password.json", encoding="utf-8").read())
    data["scenes"][1].update(layout="compare", mark="암호",
                             real={"title": "가족만 아는 암호", "points": ["미리 정해 둔 말"]},
                             fake={"title": "급하다는 목소리", "points": ["암호를 모른다"]})
    data["scenes"][2].update(layout="dots", total="1,000", stages=[{"label": "응답", "count": "300"},
                                                                    {"label": "송금", "count": 12}])
    data["scenes"][3].update(layout="toggle", path=["보안"], setting="모르는 번호 차단", toggle_to="ON")
    p = tmp_path / "s.json"
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    s = load_script(p)
    assert s.scenes[1].real == {"label": "진짜", "title": "가족만 아는 암호", "points": ["미리 정해 둔 말"]}
    assert s.scenes[1].fake["label"] == "가짜" and s.scenes[1].mark == "암호"
    assert s.scenes[2].total == 1000 and s.scenes[2].stages[0] == {"label": "응답", "count": 300}
    assert s.scenes[3].toggle_to == "on"
    errs = [e for e in validate(s)[0] if not e.startswith("scene 2")]   # scene 2's headline need not contain "암호"
    assert errs == [], errs
    from radar.production.remotion_render import scene_props
    props = scene_props(s.scenes[1], "", 0.0, 1.0, 1.25, [])
    assert props["mark"] == "암호" and props["real"]["title"] == "가족만 아는 암호"
    data["scenes"][2]["stages"][0]["count"] = 2.5
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    assert any("whole number" in e for e in validate(load_script(p))[0])


def test_build_props_carries_the_category():
    s = load_script("content/scripts/2026-10-08-family-password.json")
    props = build_props(s, [], "채널", theme="paper", category="voice")
    assert props["theme"] == "paper" and props["category"] == "voice"

def test_mascot_switch_per_scene(tmp_path):
    from radar.production.remotion_render import scene_props
    assert _errors(mascot=False) == [] and _errors(mascot=True) == []
    assert any("mascot must be true or false" in e for e in _errors(mascot="no"))
    assert scene_props(Scene(NARR, "헤드", "phone", mascot=False), "", 0.0, 1.0, 1.25, [])["mascot"] is False
    assert "mascot" not in scene_props(Scene(NARR, "헤드", "phone"), "", 0.0, 1.0, 1.25, [])
    data = json.loads(open("content/scripts/2026-10-08-family-password.json", encoding="utf-8").read())
    data["scenes"][1]["mascot"] = False
    p = tmp_path / "s.json"
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    s = load_script(p)
    assert s.scenes[1].mascot is False and s.scenes[0].mascot is None and validate(s)[0] == []