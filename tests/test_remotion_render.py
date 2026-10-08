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
    assert any("layout" in e for e in validate(Script(**{**s.__dict__, "scenes": [Scene("엄마 나야 사고가 났어 지금 돈이 필요해", "x", "phone", layout="chat")] * 3}))[0])


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
