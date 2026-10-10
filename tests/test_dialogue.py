"""Dialogue (드라마형) scenes: lines + cast parsing, the QA gate, per-voice synthesis, per-line spans, speaker pages,
the twist and the props the renderer reads."""
import json
import wave
from pathlib import Path

import pytest

from radar.production.remotion_render import (TAIL_GAP, build_props, cast_props, dialogue_pages, join_wavs,
                                              lines_props, presynth_lines, scene_length, scene_props, word_timings)
from radar.production.script import (DEFAULT_CAST, LINE_GAP, TWIST_DELAY, TWIST_HOLD, Line, Scene, Script, ScriptError,
                                     cast_of, estimate_seconds, line_seconds, load_script, mockup_side,
                                     scene_speech_seconds, validate)
from radar.production.tts import SupertonicTTS, TTSError

PILOT = Path("content/scripts/2026-10-10-skit-voice-clone.json")
CAST = {"scammer": {"voice": "M2", "label": "사기범"}, "victim": {"voice": "F2", "label": "엄마"}}


def _script(lines=None, cast=None, twist="", disclaimer="※ 실제 수법을 바탕으로 한 재연입니다", layout="call", **kw) -> Script:
    lines = lines if lines is not None else [Line("scammer", "엄마, 나 사고 났어."), Line("victim", "어머, 얼마면 돼?")]
    first = Scene(" ".join(x.text for x in lines), "엄마, 나 사고 났어", "phone", layout=layout, caller="아들",
                  lines=lines, twist=twist, **kw)
    rest = [Scene("급한 가족 전화는 일단 끊고, 저장된 번호로 다시 거세요.", "급한 전화는 끊기", "lock") for _ in range(2)]
    return Script(id="2026-10-10-t", source_video_id="x", title="딥보이스 사기 테스트 제목", description="", tags=[],
                  disclaimer=disclaimer, scenes=[first, *rest], sources=[{"url": "https://example.org"}],
                  cast=dict(CAST) if cast is None else cast)


def _errors(s: Script) -> list[str]:
    return validate(s)[0]


# ------------------------------------------------------------------ parsing

def test_load_script_reads_lines_cast_and_twist(tmp_path):
    s = load_script(PILOT)
    first = s.scenes[0]
    assert [x.speaker for x in first.lines] == ["scammer", "victim", "scammer"]
    assert first.narration == " ".join(x.text for x in first.lines)   # captions/checks see the joined text
    assert first.twist == "사기였습니다"
    assert s.cast["scammer"] == {"voice": "M2", "label": "사기범"} and s.cast["dochi"]["voice"] == "F1"
    assert s.extra["pilot"]
    data = json.loads(PILOT.read_text(encoding="utf-8"))
    data["scenes"][0]["narration"] = "둘 다 쓰면 안 된다."
    p = tmp_path / "both.json"
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    with pytest.raises(ScriptError, match="either narration or lines"):
        load_script(p)


def test_cast_defaults_and_roles():
    s = _script(cast={**CAST, "son": {"voice": "M1", "label": "아들"}, "mom": {"voice": "F3", "label": "엄마",
                                                                             "role": "victim"}})
    cast = cast_of(s)
    assert cast["narrator"] == DEFAULT_CAST["narrator"] and cast["dochi"]["voice"] == "F1"
    assert cast["dochi"]["label"] == "도치" and cast["dochi"]["role"] == "dochi"
    assert cast["scammer"]["role"] == "scammer" and cast["son"]["role"] == "neutral" and cast["mom"]["role"] == "victim"
    assert [mockup_side(r) for r in ("victim", "scammer", "neutral", "narrator", "dochi")] == ["me", "them", "them",
                                                                                               None, None]
    # a script may re-voice the defaults without losing their role
    assert cast_of(_script(cast={"dochi": {"voice": "F3"}}))["dochi"] == {"voice": "F3", "label": "도치", "role": "dochi"}


def test_tts_text_of_a_dialogue_scene_is_line_by_line():
    sc = Scene("", "h", lines=[Line("dochi", "3초면 돼요."), Line("dochi", "x", tts="엑스")])
    assert sc.tts_text() == "삼초면 돼요. 엑스"


# ------------------------------------------------------------------ the QA gate

def test_pilot_passes_the_gate_with_a_pilot_warning():
    errors, warnings = validate(load_script(PILOT))
    assert errors == []
    assert any("pilot script" in w for w in warnings)


@pytest.mark.parametrize("lines,problem", [
    ([Line("ghost", "누구세요?")], "not in the cast"),
    ([Line("scammer", "")], "1-60 characters"),
    ([Line("scammer", "가" * 61)], "1-60 characters"),
    ([Line("scammer", "여기로 들어가 www.●●●●.kr")], "no URLs"),
    ([Line("scammer", "OK 엄마 빨리 보내")], "TTS would misread"),
    ([Line("scammer", "010-1234-5678로 보내")], "real-looking number"),
    ([Line("scammer", "카톡으로 계좌 보낼게")], "real brand"),
    ([Line("scammer", "번호는 010-●●●●-●●●●이야")], "cannot be spoken"),
    ([Line("scammer", "hello mom please send money")], "not mostly Korean"),
    ([Line("scammer", "엄마")] * 7, "at most 6"),
])
def test_lines_get_the_narration_checks(lines, problem):
    errs = _errors(_script(lines=lines))
    assert any(problem in e for e in errs), errs


def test_numbers_in_lines_are_spoken_in_hangul():
    s = _script(lines=[Line("scammer", "엄마, 300만 원만 보내줘.")])
    assert [e for e in _errors(s) if e.startswith("scene 1")] == []
    assert s.scenes[0].lines[0].tts_text() == "엄마, 삼백만 원만 보내줘."


@pytest.mark.parametrize("cast,problem", [
    ({**CAST, "scammer": {"voice": "Z9", "label": "사기범"}}, "unknown voice"),
    ({**CAST, "scammer": {"label": "사기범"}}, "needs a voice"),
    ({**CAST, "scammer": {"voice": "M2"}}, "needs a label"),
    ({**CAST, "scammer": {"voice": "M2", "label": "아주 긴 사기범 이름"}}, "longer than 6"),
    ({**CAST, "scammer": {"voice": "M2", "label": "토스 직원"}}, "real brand"),
    ({**CAST, "scammer": {"voice": "M2", "label": "사기범", "role": "villain"}}, "unknown role"),
    ({**CAST, "Bad Id": {"voice": "M1", "label": "누구"}}, "speaker ids"),
])
def test_cast_rules(cast, problem):
    errs = _errors(_script(cast=cast))
    assert any(problem in e for e in errs), errs


def test_twist_disclaimer_and_warnings():
    assert _errors(_script(twist="사기였습니다")) == []
    assert any("twist stamp needs" in e for e in _errors(_script(twist="이건 사기였습니다 정말로")))
    assert any("must say 재연" in e for e in _errors(_script(disclaimer="※ 실제 사례 설명입니다")))
    s = _script(cast={**CAST, "extra": {"voice": "M3", "label": "경찰"}})
    s.scenes[1] = Scene("하나", "둘", twist="끝")
    s.scenes[2] = Scene("셋", "넷", twist="끝")
    warnings = validate(s)[1]
    assert any("never speak: extra" in w for w in warnings) and any("more than one twist" in w for w in warnings)


def test_dialogue_chat_needs_no_messages_but_short_bubbles():
    s = _script(layout="chat")
    s.scenes[0].caller = ""
    assert _errors(s) == []
    s.scenes[0].lines = [Line("scammer", "가" * 41)]
    assert any("chat bubble line" in e for e in _errors(s))
    s.scenes[0].lines = [Line("narrator", "가" * 41)]   # voice-over: no bubble, no bubble limit
    assert not any("chat bubble" in e for e in _errors(s))


def test_estimate_uses_each_voice_and_the_twist():
    fast, slow = line_seconds("엄마 나 사고 났어", "M3"), line_seconds("엄마 나 사고 났어", "F3")
    assert fast < slow
    assert line_seconds("하나. 둘.", "F1") > line_seconds("하나 둘", "F1") + 0.45   # a pause per extra sentence
    s = _script()
    speech = scene_speech_seconds(s, s.scenes[0])
    lines = s.scenes[0].lines
    assert speech == pytest.approx(line_seconds(lines[0].tts_text(), "M2") + line_seconds(lines[1].tts_text(), "F2")
                                   + LINE_GAP)
    plain = estimate_seconds(s)
    s.scenes[1].twist = "사기"
    assert estimate_seconds(s) == pytest.approx(plain + TWIST_DELAY + TWIST_HOLD - TAIL_GAP)
    assert 28 <= estimate_seconds(load_script(PILOT)) <= 32


# ------------------------------------------------------------------ synthesis: one Supertonic call per voice

def _write_wav(path: Path, seconds: float, rate: int = 44100) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"\0\0" * int(round(seconds * rate)))


def _runner(record):
    def run(args, input=None, **kw):
        job = json.loads(input)
        record.append(job)
        items = [{"sentences": [{"start": 0.0, "end": 0.4}] * len(it["sentences"])} for it in job["items"]]
        from types import SimpleNamespace
        return SimpleNamespace(returncode=0, stdout=json.dumps({"items": items}), stderr="")
    return run


def test_synthesize_batch_sends_one_job_per_voice(tmp_path):
    py = tmp_path / "python.exe"
    py.write_text("")
    calls = []
    tts = SupertonicTTS(py, voice="F1", runner=_runner(calls))
    out = tts.synthesize_batch([("엄마. 나야.", tmp_path / "a.wav"), ("응.", tmp_path / "b.wav")], voice="M2")
    assert len(calls) == 1 and calls[0]["voice"] == "M2"
    assert [it["sentences"] for it in calls[0]["items"]] == [["엄마.", "나야."], ["응."]]
    assert out[0] == [(0.0, 0.4, "엄마."), (0.0, 0.4, "나야.")] and out[1] == [(0.0, 0.4, "응.")]
    assert tts.synthesize_batch([]) == []
    bad = SupertonicTTS(py, runner=lambda *a, **k: _runner([])(*a, **k).__class__(
        returncode=0, stdout=json.dumps({"items": [{"sentences": []}]}), stderr=""))
    with pytest.raises(TTSError):
        bad.synthesize_batch([("하나. 둘.", tmp_path / "c.wav")])


class FakeSupertonic:
    """Records synthesize_batch calls and writes 0.5 s of silence per sentence."""
    name, ext, publishable = "supertonic", ".wav", True

    def __init__(self):
        self.calls = []

    def synthesize_batch(self, jobs, voice=None):
        from radar.production.textnorm import split_sentences
        self.calls.append((voice, [t for t, _ in jobs]))
        out = []
        for text, path in jobs:
            n = len(split_sentences(text)) or 1
            _write_wav(Path(path), 0.5 * n + 0.1 * (n - 1))
            out.append([(k * 0.6, k * 0.6 + 0.5, s) for k, s in enumerate(split_sentences(text))])
        return out


def test_presynth_groups_every_line_by_voice(tmp_path):
    s = load_script(PILOT)
    tts = FakeSupertonic()
    pre = presynth_lines(s, tts, tmp_path)
    voices = sorted(v for v, _ in tts.calls)
    assert voices == ["F1", "F2", "M2"]                      # one worker call per voice of the cast
    assert len(pre) == sum(len(sc.lines) for sc in s.scenes)
    m2 = next(texts for v, texts in tts.calls if v == "M2")
    assert m2 == [s.scenes[0].lines[0].tts_text(), s.scenes[0].lines[2].tts_text()]
    assert presynth_lines(s, type("Tone", (), {"name": "tone"})(), tmp_path) == {}


def test_join_wavs_is_sample_exact(tmp_path):
    parts = []
    for k, sec in enumerate((0.5, 0.25, 1.0)):
        parts.append(tmp_path / f"p{k}.wav")
        _write_wav(parts[-1], sec)
    spans = join_wavs(parts, 0.3, tmp_path / "out.wav")
    assert spans == [(0.0, 0.5), (0.8, 1.05), (1.35, 2.35)]
    with wave.open(str(tmp_path / "out.wav"), "rb") as w:
        assert w.getnframes() == round(2.35 * 44100)


def test_dialogue_speech_keeps_exact_line_spans(tmp_path):
    pytest.importorskip("imageio_ffmpeg")
    from radar.production.remotion_render import _dialogue_speech
    s = load_script(PILOT)
    tts = FakeSupertonic()
    pre = presynth_lines(s, tts, tmp_path)
    wav, speech, words, spans = _dialogue_speech(s.scenes[0], 0, tts, tmp_path, pre)
    # lines: 2 sentences, 2 sentences, 1 sentence -> 1.1 s, 1.1 s, 0.5 s with 0.3 s gaps
    assert [tuple(round(x, 2) for x in sp) for sp in spans] == [(0.0, 1.1), (1.4, 2.5), (2.8, 3.3)]
    assert speech == pytest.approx(3.3, abs=0.01)
    assert [w for w, _, _ in words[1]] == s.scenes[0].lines[1].text.split()
    assert words[1][0][1] == pytest.approx(1.4, abs=0.01)    # each line's words start at its own span
    assert all(spans[k][0] <= a and b <= spans[k][1] + 1e-6 for k in range(3) for _, a, b in words[k])


# ------------------------------------------------------------------ captions and props

def test_dialogue_pages_tag_the_speaker_and_never_mix_lines():
    s = _script(lines=[Line("scammer", "엄마, 나 사고 났어. 합의금이 급해."), Line("victim", "어머, 어떡해. 얼마면 돼?")])
    scene = s.scenes[0]
    spans = [(0.4, 1.6), (1.9, 3.0)]
    words = [word_timings(line.text.split(), None, a, b) for line, (a, b) in zip(scene.lines, spans)]
    pages = dialogue_pages(scene, words, spans, scene_end=3.3)
    assert [(p["speaker"], p["line"]) for p in pages] == [("scammer", 0), ("scammer", 0), ("victim", 1), ("victim", 1)]
    by_line = {}
    for p in pages:
        by_line.setdefault(p["line"], []).append(p)
    assert " ".join(w["text"] for p in by_line[0] for w in p["words"]) == scene.lines[0].text
    # a line's last page holds until the next speaker starts (no blank caption in the gap); the last one ends in time
    assert by_line[0][-1]["endMs"] == 1900 and pages[-1]["endMs"] <= 3300
    for a, b in zip(pages, pages[1:]):
        assert a["endMs"] <= b["startMs"]


def test_props_carry_lines_cast_and_twist():
    s = _script(twist="사기였습니다")
    scene = s.scenes[0]
    lines = lines_props(scene, [(0.4, 1.6), (1.9, 3.0)], cast_of(s))
    assert lines == [{"speaker": "scammer", "text": scene.lines[0].text, "startMs": 400, "endMs": 1600, "side": "them"},
                     {"speaker": "victim", "text": scene.lines[1].text, "startMs": 1900, "endMs": 3000, "side": "me"}]
    length = scene_length(scene, 0.4, 2.6)
    assert length == pytest.approx(0.4 + 2.6 + TWIST_DELAY + TWIST_HOLD)
    assert scene_length(s.scenes[1], 0.0, 2.0) == pytest.approx(2.0 + TAIL_GAP)
    props = scene_props(scene, "a.wav", 0.4, 2.6, length, [], lines)
    assert props["lines"] == lines and props["twist"] == {"text": "사기였습니다", "atMs": round((3.0 + TWIST_DELAY) * 1000)}
    assert "lines" not in scene_props(s.scenes[1], "", 0.0, 1.0, 1.25, [])
    assert cast_props(s) == {"scammer": {"label": "사기범", "role": "scammer", "side": "them"},
                             "victim": {"label": "엄마", "role": "victim", "side": "me"}}
    assert build_props(s, [], "채널")["cast"] == cast_props(s)
    plain = load_script("content/scripts/2026-10-08-family-password.json")
    assert "cast" not in build_props(plain, [], "채널")   # narration-only scripts render exactly as before
    pilot = cast_props(load_script(PILOT))
    assert pilot["dochi"] == {"label": "도치", "role": "dochi"}   # voice-over: no mockup side


# ------------------------------------------------------------------ the renderer reads what Python writes

SRC = Path("video/src")


def test_renderer_knows_the_dialogue_props():
    types = (SRC / "types.ts").read_text(encoding="utf-8")
    for name in ("lines?: SpokenLine[]", "twist?: Twist", "cast?: Record<string, CastMember>", "speaker?: string",
                 'side?: "me" | "them"'):
        assert name in types, name
    roles = set(json.loads((SRC / "tokens.json").read_text(encoding="utf-8"))["speakers"]) - {"_doc"}
    from radar.production.script import SPEAKER_ROLES
    assert roles == set(SPEAKER_ROLES)
    captions = (SRC / "Captions.tsx").read_text(encoding="utf-8")
    assert "SpeakerChip" in captions and "page.speaker" in captions
    short = (SRC / "Short.tsx").read_text(encoding="utf-8")
    assert "<Freeze frame={at} active={frozen}>" in short and 'name="stamp"' in short and "TwistStamp" in short
    # the stamp's hand lettering lives in Handwriting.tsx (the only user of the hand font, see test_design_tokens)
    assert "export const Stamp" in (SRC / "Handwriting.tsx").read_text(encoding="utf-8")


def test_stamp_sfx_is_generated(tmp_path):
    pytest.importorskip("imageio_ffmpeg")
    from radar.production.assemble import media_info
    from radar.production.remotion_render import ensure_sfx
    seconds, _ = media_info(ensure_sfx(tmp_path) / "stamp.wav")
    assert 0.2 < seconds < 0.5
