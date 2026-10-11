"""TTS backends. Each writes one audio file per scene.

- google: Google Cloud Text-to-Speech (REST + API key). Commercial use is covered by Google's
  terms; the free tier (1M Neural2 characters/month) covers ~1 Short/day. PUBLISHABLE.
- edge:   Microsoft Edge's unofficial endpoint via edge-tts. Microsoft has never licensed it for
  commercial use, and it rate-limits; LOCAL PREVIEW ONLY. Videos made with it are marked
  unpublishable.
- supertonic: Supertonic 3 (Supertone), a local open-weights model run on the CPU in a separate
  Python 3.12 venv (.venv-tts). Weights under OpenRAIL-M: commercial use allowed, outputs must be
  disclosed as AI-generated (the description already says "AI 합성 음성"), no impersonation.
  PUBLISHABLE, free, no account. Returns per-sentence timings.
- tone:   a sine tone sized like speech; for tests and layout checks without any network.
"""
from __future__ import annotations

import base64
import json
import subprocess
import time
from pathlib import Path

import requests

from radar.config import PROJECT_ROOT
from radar.production.textnorm import speakable_length, split_sentences


class TTSError(RuntimeError):
    pass


def _mask(text: str, secret: str | None) -> str:
    return text.replace(secret, "***") if secret else text


class GoogleTTS:
    name, ext, publishable = "google", ".mp3", True
    URL = "https://texttospeech.googleapis.com/v1/text:synthesize"

    def __init__(self, api_key: str, voice: str = "ko-KR-Neural2-A", speaking_rate: float = 1.08, session=None):
        if not api_key:
            raise TTSError("GOOGLE_TTS_API_KEY is not set (env or .env)")
        self.api_key, self.voice, self.rate = api_key, voice, speaking_rate
        self.session = session or requests.Session()

    def __repr__(self) -> str:  # never print the key
        return f"GoogleTTS(voice={self.voice!r})"

    def synthesize(self, text: str, out_path: str | Path) -> None:
        body = {"input": {"text": text},
                "voice": {"languageCode": "ko-KR", "name": self.voice},
                "audioConfig": {"audioEncoding": "MP3", "speakingRate": self.rate, "sampleRateHertz": 44100}}
        try:
            resp = self.session.post(self.URL, params={"key": self.api_key}, json=body, timeout=30)
        except requests.RequestException as exc:
            raise TTSError(f"Google TTS request failed: {_mask(str(exc), self.api_key)}") from None
        if resp.status_code != 200:
            raise TTSError(f"Google TTS HTTP {resp.status_code}: {_mask(resp.text[:300], self.api_key)}")
        try:
            audio = base64.b64decode(resp.json()["audioContent"])
        except (KeyError, ValueError) as exc:
            raise TTSError(f"Google TTS returned no audio: {exc}") from None
        Path(out_path).write_bytes(audio)


class EdgeTTS:
    name, ext, publishable = "edge", ".mp3", False

    def __init__(self, voice: str = "ko-KR-SunHiNeural", rate: str = "+8%", retries: int = 3):
        self.voice, self.rate, self.retries = voice, rate, retries

    def synthesize(self, text: str, out_path: str | Path) -> None:
        import asyncio

        import edge_tts

        last = None
        for attempt in range(self.retries):
            try:
                asyncio.run(edge_tts.Communicate(text, self.voice, rate=self.rate).save(str(out_path)))
                if Path(out_path).is_file() and Path(out_path).stat().st_size > 1000:
                    return
                last = "empty audio"
            except Exception as exc:  # network / 403 / token rotation
                last = exc
            time.sleep(2 * (attempt + 1))
        raise TTSError(f"edge-tts failed after {self.retries} attempts: {last}")


class ToneTTS:
    """No network: a quiet tone whose length matches the text, for tests and layout previews."""
    name, ext, publishable = "tone", ".wav", False

    def __init__(self, syllables_per_second: float = 6.3):
        self.sps = syllables_per_second

    def synthesize(self, text: str, out_path: str | Path) -> None:
        from radar.production.assemble import run_ffmpeg

        seconds = max(0.6, speakable_length(text) / self.sps)
        out_path = Path(out_path)
        run_ffmpeg(["-f", "lavfi", "-i", f"sine=frequency=330:duration={seconds:.2f}", "-af", "volume=0.2",
                    "-ar", "44100", out_path.name], cwd=out_path.parent)


# Supertonic clips are trimmed to their speech (the model pads every call with ~0.3-0.6 s of silence at both ends)
# plus this much (before, after): room for a soft onset and the decay of a final "요", nothing more.
CLIP_PAD = (0.06, 0.12)
SENTENCE_GAP = 0.3   # narration: silence between two trimmed sentences (with CLIP_PAD a ~0.5 s pause)


class SupertonicTTS:
    name, ext, publishable = "supertonic", ".wav", True
    WORKER = PROJECT_ROOT / "tools" / "supertonic_worker.py"

    def __init__(self, python: str | Path, voice: str = "F1", speed: float = 1.12, steps: int = 16,
                 gap: float = SENTENCE_GAP, takes: int = 1, runner=None):
        self.python, self.voice, self.speed, self.steps, self.gap = Path(python), voice, speed, steps, gap
        self.takes = max(1, int(takes))
        self.take_scores: dict[str, list[float]] = {}   # clip path -> ASR character error rate of each take
        self.runner = runner or subprocess.run

    def synthesize_sentences(self, text: str, out_path: str | Path) -> list[tuple[float, float, str]]:
        """Write out_path; return [(start_s, end_s, sentence)] for each sentence of `text`."""
        return self.synthesize_batch([(text, out_path)])[0]

    def synthesize_batch(self, jobs: list[tuple[str, str | Path]], voice: str | None = None, whole: bool = False,
                         speeds: list[float | None] | None = None) -> list[list[tuple[float, float, str]]]:
        """One worker call (one model load) for several clips in one voice (default: this backend's voice).

        jobs = [(text, out_path)]; returns, per job, [(start_s, end_s, sentence)] inside its own clip. Dialogue
        scenes use it once per voice of the cast with whole=True: each line is ONE synthesis call (one intonation,
        the model's own pause at "나야." instead of two clips joined by dead air); spans are still per sentence.
        speeds: a speaking speed per job (None = the backend's speed)."""
        if not jobs:
            return []
        if not self.python.is_file():
            raise TTSError(f"Supertonic venv not found at {self.python} (see README: .venv-tts)")
        split = [split_sentences(text) or [text] for text, _ in jobs]
        speeds = speeds or [None] * len(jobs)
        job = {"voice": voice or self.voice, "speed": self.speed, "steps": self.steps, "gap": self.gap,
               "pad": list(CLIP_PAD), "takes": self.takes,
               "items": [{"sentences": s, "out": str(out), **({"whole": True} if whole else {}),
                          **({"speed": round(sp, 3)} if sp else {})}
                         for s, (_, out), sp in zip(split, jobs, speeds)]}
        proc = self.runner([str(self.python), str(self.WORKER)], input=json.dumps(job, ensure_ascii=False),
                           capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=1800)
        if proc.returncode != 0:
            raise TTSError(f"supertonic worker failed: {(proc.stderr or '').strip()[-800:]}")
        try:
            items = json.loads(proc.stdout)["items"]
            spans = [items[k]["sentences"] for k in range(len(jobs))]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise TTSError(f"supertonic worker returned no timings: {exc}") from None
        out = []
        for got, sentences in zip(spans, split):
            if len(got) != len(sentences):
                raise TTSError("supertonic worker returned a different number of sentences")
            out.append([(s["start"], s["end"], t) for s, t in zip(got, sentences)])
        for k, (_, path) in enumerate(jobs):   # the ASR check of each clip's takes (empty when not compared)
            scores = items[k].get("takes") if isinstance(items[k], dict) else None
            if scores:
                self.take_scores[str(path)] = [float(x) for x in scores]
        return out

    def synthesize(self, text: str, out_path: str | Path) -> None:
        self.synthesize_sentences(text, out_path)


def make_backend(name: str, cfg) -> object:
    if name == "google":
        return GoogleTTS(cfg.google_api_key, cfg.google_voice, cfg.google_rate)
    if name == "edge":
        return EdgeTTS(cfg.edge_voice, cfg.edge_rate)
    if name == "tone":
        return ToneTTS()
    if name == "supertonic":
        return SupertonicTTS(PROJECT_ROOT / cfg.tts_python, cfg.supertonic_voice, cfg.supertonic_speed,
                             cfg.supertonic_steps, takes=cfg.supertonic_takes)
    raise TTSError(f"unknown TTS backend '{name}' (supertonic | google | edge | tone)")
