"""Supertonic 3 worker: runs in the separate Python 3.12 venv (.venv-tts), called by
radar.production.tts.SupertonicTTS through a subprocess.

stdin (JSON): {"voice": "F1", "speed": 1.12, "steps": 16, "gap": 0.3, "pad": [0.06, 0.12], "takes": 1,
               "items": [{"sentences": ["...", "..."], "out": "C:/.../s0.wav", "whole": false, "speed": 1.1}]}
stdout (JSON): {"items": [{"out": "...", "sample_rate": 44100, "duration": 7.9,
                           "sentences": [{"start": 0.0, "end": 3.1}, ...], "takes": [0.0, 0.25]}]}

The model pads every call with ~0.3-0.6 s of silence at both ends. Each synthesized piece is trimmed to its
speech plus `pad` (before, after), with short fades on the cut edges, so a clip starts and ends on its voice.

- "whole": false (narration): each sentence is synthesized separately and joined with `gap` seconds of silence;
  its exact start/end inside the clip is known (Supertonic has no word timestamps).
- "whole": true (a dialogue line): the line is synthesized in ONE call, so "엄마, 나야. 사고 났어." keeps one
  intonation and the model's own short pause, instead of two clips with ~0.8 s of dead air and a prosody reset
  between them. Sentence spans are then read off the line's internal pauses (char-weighted when it has none).
- "takes" > 1: the model samples noise, so takes differ, and a take sometimes swallows a syllable at speed 1.2
  ("어머, 다친 데는 없고?" heard as "다침대는 없고"). With faster-whisper and its cached "small" model in this venv
  (local files only, nothing is downloaded), every take is transcribed and the one closest to the text is kept;
  without them only the first take is made. Takes are seeded (text, voice, take), so a re-render is identical.

Supertonic 3 weights: OpenRAIL-M (commercial use allowed; outputs must be disclosed as AI-generated;
no impersonation). https://huggingface.co/Supertone/supertonic-3
"""
import json
import re
import sys
import zlib

import numpy as np

FLOOR_DB = -45.0      # speech = 5 ms frames within 45 dB of the piece's loudest frame (keeps soft onsets and tails)
FADE_IN, FADE_OUT = 0.006, 0.02
PAUSE_DB = -38.0      # an internal pause: frames this far under the peak...
PAUSE_MIN = 0.06      # ...for at least this long


def _env(audio: np.ndarray, sr: int, hop: float = 0.005) -> tuple[np.ndarray, int]:
    w = max(1, int(hop * sr))
    n = len(audio) // w
    frames = audio[:n * w].reshape(n, w) if n else np.zeros((1, 1), np.float32)
    return 10 * np.log10((frames.astype(np.float64) ** 2).mean(1) + 1e-12), w


def trim(audio: np.ndarray, sr: int, pre: float, post: float) -> np.ndarray:
    """The piece's speech plus `pre`/`post` seconds, with a short raised-cosine fade on each cut edge."""
    env, w = _env(audio, sr)
    on = np.where(env > env.max() + FLOOR_DB)[0]
    if not len(on):
        return audio
    a = max(0, on[0] * w - int(pre * sr))
    b = min(len(audio), (on[-1] + 1) * w + int(post * sr))
    out = audio[a:b].astype(np.float32).copy()
    for n, rising in ((min(len(out), int(FADE_IN * sr)), True), (min(len(out), int(FADE_OUT * sr)), False)):
        if n > 1:
            ramp = (0.5 - 0.5 * np.cos(np.linspace(0, np.pi, n))).astype(np.float32)
            if rising:
                out[:n] *= ramp
            else:
                out[-n:] *= ramp[::-1]
    return out


def _weight(text: str) -> int:
    return max(1, len(re.sub(r"[^\w]", "", text)))


def sentence_spans(audio: np.ndarray, sr: int, sentences: list[str]) -> list[dict]:
    """Spans of the sentences inside one clip of the whole line: its n-1 longest internal pauses (in time order)
    split it; char-weighted over the clip when the voice ran the sentences together."""
    total = len(audio) / sr
    if len(sentences) == 1:
        return [{"start": 0.0, "end": round(total, 4)}]
    env, w = _env(audio, sr)
    hop = w / sr
    quiet = env < env.max() + PAUSE_DB
    pauses, k = [], 0
    while k < len(quiet):
        if quiet[k]:
            j = k
            while j < len(quiet) and quiet[j]:
                j += 1
            if k > 0 and j < len(quiet) and (j - k) * hop >= PAUSE_MIN:   # internal only
                pauses.append((k * hop, j * hop))
            k = j
        else:
            k += 1
    need = len(sentences) - 1
    if len(pauses) >= need:
        cuts = sorted(sorted(pauses, key=lambda p: p[1] - p[0], reverse=True)[:need])
        bounds = [0.0] + [x for p in cuts for x in p] + [total]
        return [{"start": round(bounds[2 * i], 4), "end": round(bounds[2 * i + 1], 4)} for i in range(len(sentences))]
    weights = [_weight(s) for s in sentences]
    spans, t = [], 0.0
    for wt in weights:
        d = total * wt / sum(weights)
        spans.append({"start": round(t, 4), "end": round(t + d, 4)})
        t += d
    return spans


def _norm(s: str) -> str:
    return re.sub(r"[^가-힣0-9A-Za-z]", "", s)


def cer(ref: str, hyp: str) -> float:
    """Character error rate of an ASR transcript against the spoken text (Hangul/digits/letters only)."""
    r, h = _norm(ref), _norm(hyp)
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        p, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (r[i - 1] != h[j - 1]))
    return d[len(h)] / max(1, len(r))


def _to16k(audio: np.ndarray, sr: int) -> np.ndarray:
    n = np.arange(-200, 201)
    h = np.sinc(2 * 7600 / sr * n) * np.hamming(len(n))
    y = np.convolve(audio, h / h.sum(), mode="same")
    return np.interp(np.arange(int(len(y) * 16000 / sr)) / 16000, np.arange(len(y)) / sr, y).astype(np.float32)


def load_asr():
    """faster-whisper "small" from the local cache, or None (then takes are not compared)."""
    try:
        from faster_whisper import WhisperModel
        return WhisperModel("small", device="cpu", compute_type="int8", local_files_only=True)
    except Exception:
        return None


def main() -> None:
    job = json.loads(sys.stdin.buffer.read().decode("utf-8"))   # UTF-8 whatever the console code page is
    from supertonic import TTS  # imported late so `--help`-style failures are cheap

    tts = TTS(model="supertonic-3", auto_download=True)
    voice = job.get("voice", "F1")
    style = tts.get_voice_style(voice_name=voice)
    speed, steps, gap = float(job.get("speed", 1.12)), int(job.get("steps", 16)), float(job.get("gap", 0.12))
    pre, post = (float(x) for x in job.get("pad", (0.06, 0.12)))
    takes = max(1, int(job.get("takes", 1)))
    asr = load_asr() if takes > 1 else None
    takes = takes if asr is not None else 1
    sr = int(getattr(tts, "sample_rate", 0) or 44100)

    def synth(text: str, item_speed: float, take: int) -> np.ndarray:
        np.random.seed(zlib.crc32(f"{voice}|{item_speed}|{take}|{text}".encode("utf-8")))
        wav, _ = tts.synthesize(text, voice_style=style, lang="ko", total_steps=steps, speed=item_speed)
        return trim(np.asarray(wav, dtype=np.float32).reshape(-1), sr, pre, post)

    def best(text: str, item_speed: float) -> tuple[np.ndarray, list[float]]:
        scored = []
        for take in range(takes):
            audio = synth(text, item_speed, take)
            if asr is None:
                return audio, []
            segs, _ = asr.transcribe(_to16k(audio, sr), language="ko", beam_size=1, condition_on_previous_text=False)
            scored.append((round(cer(text, " ".join(s.text for s in segs)), 3), take, audio))
            if scored[-1][0] == 0.0:
                break
        pick = min(scored, key=lambda x: (x[0], x[1]))
        return pick[2], [x[0] for x in scored]

    results = []
    for item in job["items"]:
        sentences = item["sentences"]
        item_speed = float(item.get("speed") or speed)
        if item.get("whole"):
            joined, scores = best(" ".join(sentences), item_speed)
            spans = sentence_spans(joined, sr, sentences)
        else:
            pieces, spans, scores, t = [], [], [], 0.0
            for k, sentence in enumerate(sentences):
                if k:
                    pieces.append(np.zeros(int(round(gap * sr)), dtype=np.float32))
                    t += len(pieces[-1]) / sr
                audio, sc = best(sentence, item_speed)
                scores += sc
                spans.append({"start": round(t, 4), "end": round(t + len(audio) / sr, 4)})
                pieces.append(audio)
                t += len(audio) / sr
            joined = np.concatenate(pieces)
        tts.save_audio(joined.reshape(1, -1), item["out"])
        results.append({"out": item["out"], "sample_rate": sr, "duration": round(len(joined) / sr, 4),
                        "sentences": spans, "takes": scores})
    sys.stdout.write(json.dumps({"items": results}))


if __name__ == "__main__":
    main()
