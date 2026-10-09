"""Remotion engine: Python prepares per-scene audio, word timings and props; the React project in
video/ renders the frames (animated scenes, phone-call mockup, word-synced captions, SFX).

Sound effects are synthesized here with ffmpeg (no downloaded assets, no third-party license).
"""
from __future__ import annotations

import asyncio
import json
import shutil
import subprocess
import time
from pathlib import Path

from radar.config import PROJECT_ROOT
from radar.production.assemble import (TRIM, ProductionError, ProductionResult, ffmpeg_exe, media_info, run_ffmpeg,
                                       write_meta)
from radar.production.script import Script, caption_chunks
from radar.production.textnorm import speakable_length, split_sentences
from radar.production.themes import resolve_theme
from radar.production.tts import TTSError

VIDEO_DIR = PROJECT_ROOT / "video"
TAIL_GAP = 0.25          # seconds after each scene's speech
CALL_LEAD_IN = 0.9       # the phone rings before the first line
LEAD_IN = {"call": CALL_LEAD_IN, "alert": 0.5}   # alert: the banner lands (ding) before the narration
FIRST_SCENE_MAX_LEAD_IN = 0.4   # the voice must start almost at once in the opening scene (swipe decision)
POSTER_TAIL_MS = 500     # the last 0.5 s returns to the opening poster: seamless loop + the frame to pick as thumbnail
CAPTION_MAX_CHARS = 11
PAGE_HOLD = 0.35         # keep the last page on screen a moment after the last word

# name -> ffmpeg lavfi source (all generated, mono 44.1 kHz)
SFX = {
    "ring": "aevalsrc=exprs='0.32*(sin(2*PI*1318*t)+0.6*sin(2*PI*1760*t))*lt(mod(t,0.16),0.08)*lt(mod(t,1.2),0.8)'"
            ":s=44100:d=2.4",
    "vibrate": "aevalsrc=exprs='0.55*sin(2*PI*150*t)*(0.6+0.4*sin(2*PI*28*t))*lt(mod(t,1),0.55)':s=44100:d=2.4",
    "whoosh": "anoisesrc=d=0.45:c=pink:a=0.6:r=44100",
    "pop": "aevalsrc=exprs='0.7*sin(2*PI*(500+1400*t)*t)*exp(-t*26)':s=44100:d=0.2",
    "ding": "aevalsrc=exprs='0.4*(sin(2*PI*1318.5*t)+0.5*sin(2*PI*1975.5*t))*exp(-t*4.5)':s=44100:d=1.1",
}
SFX_FILTERS = {
    "ring": "afade=t=out:st=2.1:d=0.3",
    "vibrate": "lowpass=f=400,afade=t=out:st=2.1:d=0.3",
    "whoosh": "highpass=f=350,lowpass=f=5000,afade=t=in:d=0.2,afade=t=out:st=0.2:d=0.25",
    "pop": "afade=t=out:st=0.12:d=0.08",
    "ding": "afade=t=out:st=0.8:d=0.3",
}


def ensure_sfx(sfx_dir: Path | None = None) -> Path:
    sfx_dir = sfx_dir or VIDEO_DIR / "public" / "sfx"
    sfx_dir.mkdir(parents=True, exist_ok=True)
    for name, source in SFX.items():
        out = sfx_dir / f"{name}.wav"
        if not out.is_file():
            run_ffmpeg(["-f", "lavfi", "-i", source, "-af", SFX_FILTERS[name], "-ac", "1", out.name], cwd=sfx_dir)
    return sfx_dir


def edge_words(text: str, voice: str, rate: str, out_path: Path, retries: int = 3) -> list[tuple[float, float, str]]:
    """Synthesize with edge-tts and return word boundaries [(start_s, end_s, text)] (one per eojeol)."""
    import edge_tts

    async def run():
        marks = []
        with open(out_path, "wb") as fh:
            async for chunk in edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary").stream():
                if chunk["type"] == "audio":
                    fh.write(chunk["data"])
                elif chunk["type"] == "WordBoundary":
                    marks.append((chunk["offset"] / 1e7, (chunk["offset"] + chunk["duration"]) / 1e7, chunk["text"]))
        return marks

    last = None
    for attempt in range(retries):
        try:
            marks = asyncio.run(run())
            if out_path.is_file() and out_path.stat().st_size > 1000 and marks:
                return marks
            last = "empty audio or no word boundaries"
        except Exception as exc:  # network / 403 / token rotation
            last = exc
        time.sleep(2 * (attempt + 1))
    raise TTSError(f"edge-tts failed after {retries} attempts: {last}")


def word_timings(display: list[str], marks: list[tuple[float, float, str]] | None, start: float, end: float
                 ) -> list[tuple[str, float, float]]:
    """Map display words (captions keep digits like '340억') to spoken times.

    One TTS boundary per display word -> exact times. Otherwise (no boundaries from this voice, or a
    count mismatch) spread the words over [start, end] by character weight.
    """
    if marks and len(marks) == len(display):
        return [(w, a, b) for w, (a, b, _) in zip(display, marks)]
    weights = [max(1, speakable_length(w)) for w in display]
    total, t, out = sum(weights), start, []
    for w, k in zip(display, weights):
        span = (end - start) * k / total
        out.append((w, t, t + span))
        t += span
    return out


def caption_pages(narration: str, words: list[tuple[str, float, float]], scene_end: float) -> list[dict]:
    """Group timed words into on-screen pages using the same chunking rules as the ffmpeg engine."""
    pages, i = [], 0
    for chunk in caption_chunks(narration, max_chars=CAPTION_MAX_CHARS):
        n = len(chunk.split())
        group = words[i:i + n]
        i += n
        if group:
            pages.append({"startMs": round(group[0][1] * 1000), "endMs": 0,
                          "words": [{"text": w, "startMs": round(a * 1000), "endMs": round(b * 1000)} for w, a, b in group]})
    for k, page in enumerate(pages):
        nxt = pages[k + 1]["startMs"] if k + 1 < len(pages) else None
        last_end = page["words"][-1]["endMs"]
        page["endMs"] = nxt if nxt is not None else min(round(scene_end * 1000), last_end + round(PAGE_HOLD * 1000))
    return pages


def _speech(scene, i: int, tts, work: Path) -> tuple[Path, float, list[tuple[str, float, float]]]:
    """Synthesize one scene; return (wav path, speech seconds, word timings relative to the wav)."""
    display = scene.narration.split()
    raw = work / f"raw{i}{tts.ext}"
    wav = work / f"s{i}.wav"
    if tts.name == "edge":
        marks = edge_words(scene.tts_text(), tts.voice, tts.rate, raw)
        duration, _ = media_info(raw)
        cut_a = max(0.0, marks[0][0] - 0.05)
        cut_b = min(duration, marks[-1][1] + 0.12)
        run_ffmpeg(["-i", raw.name, "-ss", f"{cut_a:.3f}", "-to", f"{cut_b:.3f}", "-ar", "44100", "-ac", "1", wav.name], cwd=work)
        shifted = [(a - cut_a, b - cut_a, t) for a, b, t in marks]
        seconds, _ = media_info(wav)
        return wav, seconds, word_timings(display, shifted, 0.0, seconds)
    if tts.name == "supertonic":
        spans = tts.synthesize_sentences(scene.tts_text(), raw)
        run_ffmpeg(["-i", raw.name, "-ar", "44100", "-ac", "1", wav.name], cwd=work)
        seconds, _ = media_info(wav)
        return wav, seconds, sentence_word_timings(scene.narration, spans, seconds)
    tts.synthesize(scene.tts_text(), raw)
    run_ffmpeg(["-i", raw.name, "-af", TRIM, "-ac", "1", wav.name], cwd=work)
    seconds, _ = media_info(wav)
    return wav, seconds, word_timings(display, None, 0.0, seconds)


def sentence_word_timings(narration: str, spans: list[tuple[float, float, str]], total: float
                          ) -> list[tuple[str, float, float]]:
    """Exact sentence boundaries from the voice, character-weighted word timing inside each sentence."""
    display_sentences = split_sentences(narration)
    if len(display_sentences) != len(spans):
        return word_timings(narration.split(), None, 0.0, total)
    out = []
    for sentence, (a, b, _) in zip(display_sentences, spans):
        out += word_timings(sentence.split(), None, a, b)
    return out


def _npx() -> str:
    exe = shutil.which("npx") or shutil.which("npx.cmd")
    if not exe:
        raise ProductionError("npx not found: install Node.js 20+ and run `npm install` in video/")
    return exe


MUSIC_VOLUME, MUSIC_DUCK = 0.22, 0.09   # ~ -13 dB / -21 dB relative to the track; voice stays on top


def music_props(script: Script) -> tuple[dict | None, dict | None]:
    """(props entry for the music bed, manifest item) or (None, None) when the script has no music."""
    if not script.music:
        return None, None
    from radar.production.assets import music_for
    item = music_for(script.music)
    if item is None:
        raise ProductionError(f"music '{script.music}' is not downloaded: run `radar assets fetch`")
    src = item["file"].split("public/", 1)[1]
    return {"src": src, "volume": MUSIC_VOLUME, "duckVolume": MUSIC_DUCK}, item


VOICE_LABEL = "AI 음성"   # every narration is synthetic; OpenRAIL-M (Supertonic) requires an explicit disclaimer


def build_props(script: Script, scenes: list[dict], channel_name: str, sfx: bool = True,
                music: dict | None = None, voice_label: str | None = VOICE_LABEL,
                transition: str = "continuity", theme: str = "classic") -> dict:
    return {"channel": channel_name, "voiceLabel": voice_label, "disclaimer": script.disclaimer, "sfx": sfx,
            "music": music, "transition": transition, "posterTailMs": POSTER_TAIL_MS, "theme": theme,
            "scenes": scenes}


def layout_props(scene) -> dict:
    """Layout-specific fields for the React scene components (camelCase, only what the layout uses)."""
    if scene.layout == "call":
        return {"caller": scene.caller, "callerSub": scene.caller_sub or "휴대전화",
                "callLabel": scene.call_label or "수신 전화"}
    if scene.layout == "chat":
        return {"chatTitle": scene.chat_title or "대화",
                "messages": [{"from": m["from"], "text": m["text"]} for m in scene.messages]}
    if scene.layout == "sms":
        return {"sender": scene.sender, "smsText": scene.sms_text}
    if scene.layout == "alert":
        return {"appLabel": scene.app_label, "alertText": scene.alert_text}
    if scene.layout == "stat":
        return {"statValue": scene.stat_value, "statLabel": scene.stat_label}
    if scene.layout == "timeline":
        return {"steps": [{"when": s["when"], "text": s["text"]} for s in scene.steps]}
    if scene.layout == "checklist":
        return {"items": list(scene.items)}
    return {}


def scene_props(scene, audio: str, lead: float, speech: float, length: float, pages: list[dict]) -> dict:
    return {"layout": scene.layout, "audio": audio, "leadInMs": round(lead * 1000), "speechMs": round(speech * 1000),
            "durationMs": round(length * 1000), "pages": pages, "headline": scene.headline, "sub": scene.sub,
            "icon": scene.icon, "accent": scene.accent, **layout_props(scene)}


def produce_remotion(script: Script, out_root: str | Path, *, tts, channel_name: str, sfx: bool = True,
                     timeout: int = 1800, transition: str = "continuity") -> ProductionResult:
    if not (VIDEO_DIR / "node_modules" / "remotion").is_dir():
        raise ProductionError("Remotion is not installed: run `npm install` and `node scripts/prepare-assets.mjs` in video/")
    out_dir = Path(out_root).resolve() / script.id
    work = out_dir / "work_remotion"
    if work.exists():
        shutil.rmtree(work)  # our own scratch folder for this script only
    work.mkdir(parents=True)
    public_job = VIDEO_DIR / "public" / "jobs" / script.id
    if public_job.exists():
        shutil.rmtree(public_job)
    public_job.mkdir(parents=True)
    if sfx:
        ensure_sfx()

    scenes, total = [], 0.0
    for i, scene in enumerate(script.scenes):
        wav, speech, words = _speech(scene, i, tts, work)
        if speech < 0.3:
            raise ProductionError(f"scene {i + 1}: TTS produced no usable audio")
        shutil.copy(wav, public_job / wav.name)
        lead = LEAD_IN.get(scene.layout, 0.0)
        if not scenes:
            lead = min(lead, FIRST_SCENE_MAX_LEAD_IN)
        length = lead + speech + TAIL_GAP
        timed = [(w, a + lead, b + lead) for w, a, b in words]
        scenes.append(scene_props(scene, f"jobs/{script.id}/{wav.name}", lead, speech, length,
                                  caption_pages(scene.narration, timed, length)))
        total += round(length * 1000) / 1000
    music, music_item = music_props(script)
    props_path = out_dir / "props.json"
    theme = resolve_theme(script)   # own field, else topic, never the same as the previous scheduled day
    props = build_props(script, scenes, channel_name, sfx, music, transition=transition, theme=theme)
    props_path.write_text(json.dumps(props, ensure_ascii=False, indent=1), encoding="utf-8")

    video = out_dir / "video.mp4"
    started = time.monotonic()
    proc = subprocess.run([_npx(), "remotion", "render", "src/index.ts", "Short", str(video), f"--props={props_path}",
                           "--log=error"], cwd=str(VIDEO_DIR), capture_output=True, text=True, encoding="utf-8",
                          errors="replace", timeout=timeout)
    render_seconds = time.monotonic() - started
    if proc.returncode != 0:
        raise ProductionError(f"remotion render failed ({proc.returncode}): {(proc.stderr or proc.stdout).strip()[-1500:]}")

    # one loudness pass on the final mix (voice + music + SFX), video stream copied untouched
    raw_video = out_dir / "video_raw.mp4"
    video.replace(raw_video)
    run_ffmpeg(["-i", raw_video.name, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000",
                "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", video.name], cwd=out_dir)
    raw_video.unlink()

    duration, size = media_info(video)
    if size != "1080x1920":
        raise ProductionError(f"output is {size or 'unknown size'}, expected 1080x1920")
    if abs(duration - total) > 0.6:
        raise ProductionError(f"output length {duration:.2f}s differs from the planned {total:.2f}s")
    warnings = [] if 15 <= duration <= 45 else [f"length {duration:.1f}s outside the 15-45s target"]
    if not tts.publishable:
        warnings.append(f"voice backend '{tts.name}' is for local preview only; re-produce with --backend google to publish")
    subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-ss", "1.2",
                    "-i", str(video), "-frames:v", "1", str(out_dir / "thumb.png")], capture_output=True)
    extra = {"engine": "remotion", "render_seconds": round(render_seconds, 1), "transition": transition,
             "theme": theme}
    if music_item:
        extra["music"] = {k: music_item[k] for k in ("id", "title", "artist", "license", "license_url",
                                                       "attribution_required", "sha256")}
    meta = write_meta(out_dir, script, duration, size, tts, warnings, extra=extra)
    return ProductionResult(video, out_dir / "thumb.png", meta, round(duration, 2), size, bool(tts.publishable), warnings)

