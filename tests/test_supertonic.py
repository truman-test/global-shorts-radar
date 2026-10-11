import json
from types import SimpleNamespace

import pytest

from radar.production.remotion_render import sentence_word_timings
from radar.production.textnorm import split_sentences
from radar.production.tts import SupertonicTTS, TTSError


def test_split_sentences_keeps_punctuation():
    assert split_sentences("엄마, 나야. 사고가 났어. 지금 바로 돈이 필요해.") == ["엄마, 나야.", "사고가 났어.", "지금 바로 돈이 필요해."]
    assert split_sentences("의심할 수 있을까요? 아니요!") == ["의심할 수 있을까요?", "아니요!"]
    assert split_sentences("마침표 없는 문장") == ["마침표 없는 문장"]


def test_sentence_word_timings_respect_sentence_boundaries():
    spans = [(0.0, 1.4, "엄마, 나야."), (1.5, 2.9, "사고가 났어."), (3.0, 4.9, "지금 바로 돈이 필요해.")]
    words = sentence_word_timings("엄마, 나야. 사고가 났어. 지금 바로 돈이 필요해.", spans, 4.9)
    assert [w for w, _, _ in words] == ["엄마,", "나야.", "사고가", "났어.", "지금", "바로", "돈이", "필요해."]
    assert words[2][1] == 1.5 and abs(words[3][2] - 2.9) < 1e-9 and abs(words[-1][2] - 4.9) < 1e-9
    # mismatch -> whole-scene proportional fallback, still covering every word
    assert len(sentence_word_timings("하나. 둘.", [(0, 1, "x")], 2.0)) == 2


def _runner(stdout, rc=0, record=None):
    def run(args, input=None, **kw):
        if record is not None:
            record.append((args, json.loads(input)))
        return SimpleNamespace(returncode=rc, stdout=stdout, stderr="boom")
    return run


def test_supertonic_backend_calls_worker_with_sentences(tmp_path):
    py = tmp_path / "python.exe"
    py.write_text("")
    calls = []
    out = json.dumps({"items": [{"sentences": [{"start": 0.0, "end": 1.0}, {"start": 1.1, "end": 2.0}]}]})
    tts = SupertonicTTS(py, voice="M2", speed=1.2, runner=_runner(out, record=calls))
    spans = tts.synthesize_sentences("첫 문장. 둘째 문장.", tmp_path / "a.wav")
    assert spans == [(0.0, 1.0, "첫 문장."), (1.1, 2.0, "둘째 문장.")]
    job = calls[0][1]
    assert job["voice"] == "M2" and job["speed"] == 1.2 and job["items"][0]["sentences"] == ["첫 문장.", "둘째 문장."]
    assert tts.publishable is True and tts.ext == ".wav"


def test_supertonic_backend_errors(tmp_path):
    with pytest.raises(TTSError):
        SupertonicTTS(tmp_path / "missing.exe").synthesize("문장.", tmp_path / "a.wav")
    py = tmp_path / "python.exe"
    py.write_text("")
    with pytest.raises(TTSError):
        SupertonicTTS(py, runner=_runner("", rc=1)).synthesize("문장.", tmp_path / "a.wav")
    with pytest.raises(TTSError):
        SupertonicTTS(py, runner=_runner(json.dumps({"items": [{"sentences": []}]}))).synthesize("문장.", tmp_path / "a.wav")


def test_supertonic_job_trims_and_can_keep_a_line_whole(tmp_path):
    py = tmp_path / "python.exe"
    py.write_text("")
    calls = []
    out = json.dumps({"items": [{"sentences": [{"start": 0.0, "end": 0.5}, {"start": 0.7, "end": 1.2}]}]})
    tts = SupertonicTTS(py, voice="M3", speed=1.2, takes=3, runner=_runner(out, record=calls))
    tts.synthesize_batch([("엄마, 나야. 사고 났어.", tmp_path / "a.wav")], whole=True, speeds=[1.08])
    job = calls[0][1]
    assert job["items"][0]["whole"] is True and job["items"][0]["speed"] == 1.08
    assert job["items"][0]["sentences"] == ["엄마, 나야.", "사고 났어."]     # spans stay per sentence
    assert job["takes"] == 3 and len(job["pad"]) == 2 and job["gap"] > 0


def _worker():
    import importlib.util
    from pathlib import Path
    spec = importlib.util.spec_from_file_location("supertonic_worker",
                                                  Path(__file__).resolve().parents[1] / "tools" / "supertonic_worker.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_worker_trims_padding_and_finds_sentence_pauses():
    np = pytest.importorskip("numpy")   # the worker runs in .venv-tts
    w = _worker()
    sr = 44100
    tone = lambda s: (0.3 * np.sin(2 * np.pi * 220 * np.arange(int(s * sr)) / sr)).astype(np.float32)
    silence = lambda s: np.zeros(int(s * sr), np.float32)
    clip = np.concatenate([silence(0.4), tone(0.5), silence(0.25), tone(0.6), silence(0.5)])
    out = w.trim(clip, sr, 0.06, 0.12)
    assert abs(len(out) / sr - (0.06 + 1.35 + 0.12)) < 0.02          # 0.9 s of model padding gone
    assert abs(out[0]) < 1e-6 and abs(out[-1]) < 1e-6                 # faded cut edges
    spans = w.sentence_spans(out, sr, ["엄마, 나야.", "사고 났어."])
    assert abs(spans[0]["end"] - (0.06 + 0.5)) < 0.02 and abs(spans[1]["start"] - (0.06 + 0.75)) < 0.02
    flat = w.sentence_spans(w.trim(tone(1.0), sr, 0.06, 0.12), sr, ["가나.", "다라마바."])   # no pause: by characters
    assert flat[0]["end"] < flat[1]["end"] and abs(flat[0]["end"] / flat[1]["end"] - 1 / 3) < 0.02
    assert w.cer("급해, 돈 좀 보내 줘!", "급해 돈 좀 보내줘") == 0.0 and w.cer("급해, 돈 좀 보내 줘!", "근 좀 보내줘") > 0.3
