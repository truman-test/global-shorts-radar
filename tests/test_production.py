import base64
import json

import pytest

from radar import pipeline
from radar.collectors.fixture import FixtureClient
from radar.collectors.youtube import QuotaTracker
from radar.production.assemble import write_ass
from radar.production.script import (Scene, Script, build_description, caption_chunks, estimate_seconds,
                                     load_script, validate)
from radar.production.textnorm import native, normalize_for_tts, sino, tts_problems
from radar.production.tts import GoogleTTS, TTSError


# ---------------------------------------------------------------- text normalization

def test_sino_and_native_numbers():
    assert [sino(n) for n in (0, 10, 15, 110, 340, 2024)] == ["영", "십", "십오", "백십", "삼백사십", "이천이십사"]
    assert sino(10000) == "만" and sino(100000000) == "일억" and sino(12578) == "만이천오백칠십팔"
    assert [native(n) for n in (1, 3, 10, 20, 21, 99)] == ["한", "세", "열", "스무", "스물한", "아흔아홉"]


def test_normalize_for_tts():
    assert normalize_for_tts("2024년 홍콩") == "이천이십사년 홍콩"
    assert normalize_for_tts("약 340억 원") == "약 삼백사십억 원"
    assert normalize_for_tts("1조 2,578억") == "일조 이천오백칠십팔억"
    assert normalize_for_tts("가족 3명, 10시 10분") == "가족 세명, 열시 십분"
    assert normalize_for_tts("FBI와 SNS") == "에프비아이와 에스엔에스"
    assert normalize_for_tts("3.5%") == "삼점오퍼센트"
    assert normalize_for_tts("IC3 보고서") == "아이씨쓰리 보고서"
    assert tts_problems(normalize_for_tts("iPhone 15")) == ["iPhone"]


def test_caption_chunks_break_after_punctuation_and_length():
    assert caption_chunks("엄마, 나야. 사고가 났어. 지금 바로 돈이 필요해.") == \
        ["엄마, 나야.", "사고가 났어.", "지금 바로 돈이 필요해."]
    assert caption_chunks("표적은 주로 기자, 활동가, 정치인 같은 특정 인물입니다.") == \
        ["표적은 주로 기자,", "활동가, 정치인 같은", "특정 인물입니다."]
    long = caption_chunks("사기범은 에스엔에스에 올린 짧은 영상만으로 목소리를 복제합니다")
    assert len(long) >= 3 and all(len(c.replace(" ", "")) <= 10 or " " not in c for c in long)


# ---------------------------------------------------------------- script QA gate

def _script(**over):
    scenes = [Scene("엄마, 나야. 사고가 났어. 지금 바로 돈이 필요해.", "엄마, 나 사고 났어", "phone", accent="red"),
              Scene("그런데 이 목소리, 진짜 딸이 아닐 수 있습니다. 사기범은 SNS 영상 몇 초로 목소리를 복제합니다.",
                    "그 목소리, 가짜일 수 있다", "voice"),
              Scene("미국 FBI는 가족끼리 비밀 단어를 정해 두라고 권고했습니다. 오늘 저녁 하나 정해 두세요.",
                    "가족 암호 정하기", "check", accent="green")]
    base = dict(id="2026-10-08-test", source_video_id="smpl_A1", title="엄마, 나야… 그 목소리 진짜일까? #Shorts",
                description="설명", tags=["보이스피싱", "AI 음성 복제"], disclaimer="※ 재연입니다", scenes=scenes,
                sources=[{"title": "FBI", "url": "https://www.ic3.gov/PSA/2024/PSA241203"}])
    base.update(over)
    return Script(**base)


def _verified_db(db, settings, now):
    pipeline.collect(FixtureClient(quota=QuotaTracker(10_000)), db, settings, now, "fixture")
    pipeline.compute_metrics(db, settings, now)
    db.set_verification("smpl_A1", "verified", "2026-10-03T01:00:00Z", ["https://www.ic3.gov/x"], "ok")
    return db


def test_valid_script_passes_and_estimates_length(db, settings, now):
    s = _script()
    assert 12 < estimate_seconds(s) < 30
    assert validate(s, _verified_db(db, settings, now)) == ([], [])


def test_qa_gate_catches_each_problem(db, settings, now):
    _verified_db(db, settings, now)
    assert any("source URL" in e for e in validate(_script(sources=[]))[0])
    assert any("disclaimer" in e for e in validate(_script(disclaimer=""))[0])
    bad_scene = Scene("영상 보러 가기 https://example.com", "링크", "phone")
    assert any("URLs" in e for e in validate(_script(scenes=_script().scenes + [bad_scene]))[0])
    assert any("misread" in e for e in validate(_script(scenes=[Scene("이 iPhone 꼭 쓰세요 정말 중요합니다", "x", "phone")] * 3))[0])
    assert any("icon" in e for e in validate(_script(scenes=[Scene("아주 긴 설명 문장입니다 정말로", "x", "rocket")] * 3))[0])
    assert any("estimated length" in e for e in validate(_script(scenes=[Scene("짧다", "x", "phone")] * 3))[0])
    unverified = _script(source_video_id="smpl_H1")
    errors, _ = validate(unverified, db)
    assert any("not verified" in e for e in errors)
    errors, warnings = validate(unverified, db, allow_unverified=True)
    assert not any("not verified" in e for e in errors) and any("not verified" in w for w in warnings)
    db.set_verification("smpl_A1", "false", "2026-10-03T02:00:00Z", [], "debunked")
    assert any("FALSE" in e for e in validate(_script(), db, allow_unverified=True)[0])


def test_description_has_disclaimer_sources_and_hashtags():
    d = build_description(_script())
    assert "※ 재연입니다" in d and "https://www.ic3.gov/PSA/2024/PSA241203" in d and "음성: AI 합성 음성 (실제 인물의 목소리가 아닙니다)" in d
    assert d.rstrip().endswith("#Shorts #보이스피싱 #AI음성복제")


def test_repository_scripts_pass_the_gate_without_db():
    from pathlib import Path
    paths = sorted(Path("content/scripts").glob("*.json"))
    assert paths, "the first scripts are committed"
    for p in paths:
        errors, _ = validate(load_script(p))
        assert errors == [], (p.name, errors)


# ---------------------------------------------------------------- captions / rendering / TTS

def test_write_ass(tmp_path):
    path = write_ass([(1.5, 2.25, "안녕 {하세요}")], tmp_path / "c.ass", "Malgun Gothic")
    text = path.read_text(encoding="utf-8")
    assert "PlayResX: 1080" in text and "PlayResY: 1920" in text and "Style: Cap,Malgun Gothic,84" in text
    assert "Dialogue: 0,0:00:01.50,0:00:02.25,Cap,,0,0,0,,안녕 (하세요)" in text


def test_render_every_icon(tmp_path):
    from PIL import Image
    from radar.production.render import ICONS, find_font, render_scene
    try:
        font = find_font()
    except FileNotFoundError:
        pytest.skip("no Korean font on this machine")
    for i, icon in enumerate(ICONS):
        out = render_scene(Scene("내레이션", f"헤드라인 {icon} 아주 길게 써서 두 줄로 넘어가는지 확인", icon, sub="보조 문구"),
                           tmp_path / f"{icon}.png", channel_name="채널", disclaimer="※ 재연", font_path=font,
                           show_disclaimer=(i == 0))
        assert Image.open(out).size == (1080, 1920)


class _Resp:
    def __init__(self, status, payload):
        self.status_code, self._payload = status, payload
        self.text = json.dumps(payload)

    def json(self):
        return self._payload


class _Session:
    def __init__(self, resp):
        self.resp, self.calls = resp, []

    def post(self, url, params=None, json=None, timeout=None):
        self.calls.append({"url": url, "params": params, "json": json})
        return self.resp


def test_google_tts_writes_audio_and_never_leaks_the_key(tmp_path):
    ok = _Session(_Resp(200, {"audioContent": base64.b64encode(b"ID3audio").decode()}))
    g = GoogleTTS("KEY-SECRET-123", voice="ko-KR-Neural2-A", session=ok)
    g.synthesize("안녕하세요", tmp_path / "a.mp3")
    assert (tmp_path / "a.mp3").read_bytes() == b"ID3audio"
    call = ok.calls[0]
    assert call["params"] == {"key": "KEY-SECRET-123"} and call["json"]["voice"]["languageCode"] == "ko-KR"
    assert "KEY-SECRET-123" not in repr(g)
    bad = GoogleTTS("KEY-SECRET-123", session=_Session(_Resp(403, {"error": "bad key KEY-SECRET-123"})))
    with pytest.raises(TTSError) as exc:
        bad.synthesize("x", tmp_path / "b.mp3")
    assert "KEY-SECRET-123" not in str(exc.value) and "403" in str(exc.value)
    with pytest.raises(TTSError):
        GoogleTTS("")


# ---------------------------------------------------------------- end to end (offline: tone voice)

def test_produce_end_to_end_with_tone_voice(tmp_path):
    pytest.importorskip("imageio_ffmpeg")
    from radar.production.assemble import media_info, produce
    from radar.production.render import find_font
    from radar.production.tts import ToneTTS
    try:
        font = find_font()
    except FileNotFoundError:
        pytest.skip("no Korean font on this machine")
    result = produce(_script(), tmp_path, tts=ToneTTS(), channel_name="테스트 채널", font_path=font)
    duration, size = media_info(result.video)
    assert size == "1080x1920" and abs(duration - result.duration) < 0.1 and 8 < duration < 40
    meta = json.loads(result.meta.read_text(encoding="utf-8"))
    assert meta["publishable"] is False and meta["tts_backend"] == "tone" and "※ 재연입니다" in meta["description"]
    assert result.thumbnail.is_file() and any("preview only" in w for w in result.warnings)
    ass = (result.video.parent / "work" / "captions.ass").read_text(encoding="utf-8")
    assert ass.count("Dialogue:") >= 6
