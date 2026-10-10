"""Supertonic 3 worker: runs in the separate Python 3.12 venv (.venv-tts), called by
radar.production.tts.SupertonicTTS through a subprocess.

stdin (JSON): {"voice": "F1", "speed": 1.12, "steps": 16, "gap": 0.12,
               "items": [{"sentences": ["...", "..."], "out": "C:/.../s0.wav"}]}
stdout (JSON): {"items": [{"out": "...", "sample_rate": 44100, "duration": 7.9,
                           "sentences": [{"start": 0.0, "end": 3.1}, ...]}]}

Each sentence is synthesized separately so its exact start/end inside the clip is known; the
pipeline uses that for caption timing (Supertonic has no word timestamps).

Supertonic 3 weights: OpenRAIL-M (commercial use allowed; outputs must be disclosed as AI-generated;
no impersonation). https://huggingface.co/Supertone/supertonic-3
"""
import json
import sys

import numpy as np


def main() -> None:
    job = json.loads(sys.stdin.buffer.read().decode("utf-8"))   # UTF-8 whatever the console code page is
    from supertonic import TTS  # imported late so `--help`-style failures are cheap

    tts = TTS(model="supertonic-3", auto_download=True)
    style = tts.get_voice_style(voice_name=job.get("voice", "F1"))
    speed, steps, gap = float(job.get("speed", 1.12)), int(job.get("steps", 16)), float(job.get("gap", 0.12))
    results = []
    for item in job["items"]:
        pieces, spans, t, sr = [], [], 0.0, None
        for sentence in item["sentences"]:
            wav, _ = tts.synthesize(sentence, voice_style=style, lang="ko", total_steps=steps, speed=speed)
            audio = np.asarray(wav, dtype=np.float32).reshape(-1)
            sr = sr or int(getattr(tts, "sample_rate", 0) or 44100)
            start = t
            t += len(audio) / sr
            spans.append({"start": round(start, 4), "end": round(t, 4)})
            pieces.append(audio)
            silence = np.zeros(int(gap * sr), dtype=np.float32)
            pieces.append(silence)
            t += gap
        joined = np.concatenate(pieces[:-1]) if len(pieces) > 1 else pieces[0]
        tts.save_audio(joined.reshape(1, -1) if np.ndim(wav) == 2 else joined, item["out"])
        results.append({"out": item["out"], "sample_rate": sr, "duration": round(len(joined) / sr, 4),
                        "sentences": spans})
    sys.stdout.write(json.dumps({"items": results}))


if __name__ == "__main__":
    main()
