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
import zlib
from pathlib import Path

from radar.config import PROJECT_ROOT
from radar.production.assemble import (TRIM, ProductionError, ProductionResult, ffmpeg_exe, media_info, run_ffmpeg,
                                       write_meta)
from radar.production.script import (LINE_GAP, TWIST_DELAY, TWIST_HOLD, Script, cast_of, caption_chunks,
                                     default_staging, line_voice, mockup_side)
from radar.production.textnorm import speakable_length, split_sentences
from radar.production.themes import episode_number, record_style, resolve_style_report
from radar.production.tts import TTSError

VIDEO_DIR = PROJECT_ROOT / "video"
TAIL_GAP = 0.25          # seconds after each scene's speech (a twist scene ends on its freeze-frame instead)
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
    # the twist stamp: a low thud (falling pitch) with a short paper slap on top
    "stamp": "aevalsrc=exprs='0.85*sin(2*PI*(70+90*exp(-t*28))*t)*exp(-t*16)+0.35*(random(0)*2-1)*exp(-t*90)'"
             ":s=44100:d=0.35",
    "ding": "aevalsrc=exprs='0.4*(sin(2*PI*1318.5*t)+0.5*sin(2*PI*1975.5*t))*exp(-t*4.5)':s=44100:d=1.1",
}
SFX_FILTERS = {
    "ring": "afade=t=out:st=2.1:d=0.3",
    "vibrate": "lowpass=f=400,afade=t=out:st=2.1:d=0.3",
    "whoosh": "highpass=f=350,lowpass=f=5000,afade=t=in:d=0.2,afade=t=out:st=0.2:d=0.25",
    "pop": "afade=t=out:st=0.12:d=0.08",
    "stamp": "lowpass=f=3200,afade=t=out:st=0.24:d=0.1",
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
    return _speech_text(scene.narration, scene.tts_text(), str(i), tts, work)


def _speech_text(narration: str, spoken: str, tag: str, tts, work: Path
                 ) -> tuple[Path, float, list[tuple[str, float, float]]]:
    """Synthesize one caption text (`spoken` is its TTS form) into work/s<tag>.wav (44.1 kHz mono)."""
    display = narration.split()
    raw = work / f"raw{tag}{tts.ext}"
    wav = work / f"s{tag}.wav"
    if tts.name == "edge":
        marks = edge_words(spoken, tts.voice, tts.rate, raw)
        duration, _ = media_info(raw)
        cut_a = max(0.0, marks[0][0] - 0.05)
        cut_b = min(duration, marks[-1][1] + 0.12)
        run_ffmpeg(["-i", raw.name, "-ss", f"{cut_a:.3f}", "-to", f"{cut_b:.3f}", "-ar", "44100", "-ac", "1", wav.name], cwd=work)
        shifted = [(a - cut_a, b - cut_a, t) for a, b, t in marks]
        seconds, _ = media_info(wav)
        return wav, seconds, word_timings(display, shifted, 0.0, seconds)
    if tts.name == "supertonic":
        spans = tts.synthesize_sentences(spoken, raw)
        return _timed_clip(raw, wav, narration, spans, work)
    tts.synthesize(spoken, raw)
    run_ffmpeg(["-i", raw.name, "-af", TRIM, "-ar", "44100", "-ac", "1", wav.name], cwd=work)
    seconds, _ = media_info(wav)
    return wav, seconds, word_timings(display, None, 0.0, seconds)


def _timed_clip(raw: Path, wav: Path, narration: str, spans: list[tuple[float, float, str]], work: Path
                ) -> tuple[Path, float, list[tuple[str, float, float]]]:
    """A Supertonic clip with its sentence spans -> 44.1 kHz mono wav + word timings."""
    run_ffmpeg(["-i", raw.name, "-ar", "44100", "-ac", "1", wav.name], cwd=work)
    seconds, _ = media_info(wav)
    return wav, seconds, sentence_word_timings(narration, spans, seconds)


# ------------------------------------------------------------------ dialogue (드라마형): one voice per speaker

def presynth_lines(script: Script, tts, work: Path) -> dict[tuple[int, int], tuple[Path, list]]:
    """Supertonic: every dialogue line of the script, one worker call per voice of the cast.
    Returns {(scene index, line index): (raw clip, sentence spans)}; {} for the other backends."""
    if tts.name != "supertonic":
        return {}
    by_voice: dict[str, list] = {}
    for i, scene in enumerate(script.scenes):
        for k, line in enumerate(scene.lines):
            by_voice.setdefault(line_voice(script, line.speaker), []).append((i, k, line))
    out = {}
    for voice, items in by_voice.items():
        raws = [work / f"raw{i}_{k}{tts.ext}" for i, k, _ in items]
        spans = tts.synthesize_batch([(line.tts_text(), raw) for (_, _, line), raw in zip(items, raws)], voice=voice)
        for (i, k, _), raw, sp in zip(items, raws, spans):
            out[(i, k)] = (raw, sp)
    return out


def join_wavs(parts: list[Path], gap: float, out: Path) -> list[tuple[float, float]]:
    """Concatenate same-format wavs with `gap` seconds of silence between them (sample exact).
    Returns each part's (start_s, end_s) inside `out`."""
    import wave

    spans, chunks, pos, params = [], [], 0, None
    for k, part in enumerate(parts):
        with wave.open(str(part), "rb") as w:
            p = w.getparams()
            if params is None:
                params = p
            elif (p.nchannels, p.sampwidth, p.framerate) != (params.nchannels, params.sampwidth, params.framerate):
                raise ProductionError(f"dialogue clip {part.name} has a different audio format")
            data = w.readframes(p.nframes)
        if k:
            silence = int(round(gap * params.framerate))
            chunks.append(b"\0" * silence * params.sampwidth * params.nchannels)
            pos += silence
        spans.append((pos / params.framerate, (pos + p.nframes) / params.framerate))
        chunks.append(data)
        pos += p.nframes
    with wave.open(str(out), "wb") as w:
        w.setnchannels(params.nchannels)
        w.setsampwidth(params.sampwidth)
        w.setframerate(params.framerate)
        w.writeframes(b"".join(chunks))
    return spans


def _dialogue_speech(scene, i: int, tts, work: Path, pre: dict
                     ) -> tuple[Path, float, list[list[tuple[str, float, float]]], list[tuple[float, float]]]:
    """Synthesize a dialogue scene line by line (each in its speaker's voice) and join the clips with LINE_GAP.
    Returns (wav, speech seconds, word timings per line, (start, end) per line), all relative to the wav."""
    clips = []
    for k, line in enumerate(scene.lines):
        if (i, k) in pre:
            raw, spans = pre[(i, k)]
            clips.append(_timed_clip(raw, work / f"s{i}_{k}.wav", line.text, spans, work))
        else:
            clips.append(_speech_text(line.text, line.tts_text(), f"{i}_{k}", tts, work))
    wav = work / f"s{i}.wav"
    spans = join_wavs([c[0] for c in clips], LINE_GAP, wav)
    words = [[(w, a + s0, b + s0) for w, a, b in clip[2]] for clip, (s0, _) in zip(clips, spans)]
    return wav, spans[-1][1], words, spans


def dialogue_pages(scene, words: list[list[tuple[str, float, float]]], spans: list[tuple[float, float]],
                   scene_end: float) -> list[dict]:
    """Caption pages line by line (a page never mixes two speakers), each tagged with its speaker and line index.
    A line's last page stays up until the next line starts (no blank flash in the short gap between speakers)."""
    pages = []
    for k, (line, timed) in enumerate(zip(scene.lines, words)):
        nxt = spans[k + 1][0] if k + 1 < len(spans) else scene_end
        own = caption_pages(line.text, timed, nxt)
        if own and k + 1 < len(spans):
            own[-1]["endMs"] = round(nxt * 1000)
        for page in own:
            page["speaker"] = line.speaker
            page["line"] = k
        pages += own
    return pages


def lines_props(scene, spans: list[tuple[float, float]], cast: dict) -> list[dict]:
    """[{speaker, text, startMs, endMs, side?}]: side "me" (the phone's owner) / "them" places the line in a
    call/chat/sms mockup; voice-over lines (narrator, 도치) have none."""
    out = []
    for line, (a, b) in zip(scene.lines, spans):
        side = mockup_side(cast.get(line.speaker, {}).get("role", "neutral"))
        notes = {k: getattr(line, k) for k in ("face", "gesture", "bubble") if getattr(line, k, "")}
        out.append({"speaker": line.speaker, "text": line.text, "startMs": round(a * 1000), "endMs": round(b * 1000),
                    **({"side": side} if side else {}), **notes})
    return out


def cast_props(script: Script) -> dict:
    """{speaker: {label, role, side}} for every speaker who has a line (the caption chip and the mockup side)."""
    cast = cast_of(script)
    used = [line.speaker for scene in script.scenes for line in scene.lines]
    return {s: {"label": cast[s].get("label", ""), "role": cast[s]["role"],
                **({"side": mockup_side(cast[s]["role"])} if mockup_side(cast[s]["role"]) else {}),
                **({"character": cast[s]["character"]} if cast[s].get("character") else {})}
            for s in dict.fromkeys(used) if s in cast}


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
# Growth lines, visual only (no narration, no extra time; see reports/구독자 1천명 외부 성장 전략.md (a) 3 and 6):
SHARE_LINE = "부모님께도 보내 주세요"   # handwritten under the closing checklist (family-chat sharing)
VALUE_CTA = "매일 1장, 생존노트"        # a small chip with a bell in the last ~1.2 s, gone before the poster tail


def episode_seed(script_id: str) -> int:
    """Deterministic per-episode seed for the stage's variants (scrap layout, sky clouds, prop drift): CRC32 of the
    script id, so a re-render draws the same picture and nothing is random at render time."""
    return zlib.crc32(script_id.encode("utf-8"))


def build_props(script: Script, scenes: list[dict], channel_name: str, sfx: bool = True,
                music: dict | None = None, voice_label: str | None = VOICE_LABEL,
                transition: str = "continuity", theme: str = "classic", category: str | None = None,
                episode_no: int | None = None, share_line: str | None = SHARE_LINE,
                cta: str | None = VALUE_CTA) -> dict:
    """Props for video/src/Short.tsx. `episode` stays the script id (seed fallback); the series number shown on the
    poster is `episodeNo` (only for scheduled scripts, see themes.episode_number)."""
    props = {"channel": channel_name, "voiceLabel": voice_label, "disclaimer": script.disclaimer, "sfx": sfx,
             "music": music, "transition": transition, "posterTailMs": POSTER_TAIL_MS, "theme": theme,
             "episode": script.id, "seed": episode_seed(script.id), "scenes": scenes}
    if category:
        props["category"] = category
    if isinstance(episode_no, int) and not isinstance(episode_no, bool) and episode_no > 0:
        props["episodeNo"] = episode_no
    if share_line:
        props["shareLine"] = share_line
    if cta:
        props["cta"] = cta
    cast = cast_props(script)
    if cast:
        props["cast"] = cast
    return props


def meta_extra(style, transition: str, render_seconds: float, episode_no: int | None,
               music_item: dict | None = None) -> dict:
    """Engine-specific fields of meta.json: the stage, the series number ("생존노트 #N", None when unscheduled) and
    the music's licence record."""
    extra = {"engine": "remotion", "render_seconds": round(render_seconds, 1), "transition": transition,
             "theme": style.theme, "stage": style.family, "category": style.category, "luminance": style.luminance,
             "mascot": bool(style.mascot), "visual_group": style.visual_group, "episode": episode_no}
    if music_item:
        extra["music"] = {k: music_item[k] for k in ("id", "title", "artist", "license", "license_url",
                                                       "attribution_required", "sha256")}
    return extra


def layout_props(scene) -> dict:
    """Layout-specific fields for the React scene components (camelCase, only what the layout uses)."""
    if scene.layout == "call":
        return {"caller": scene.caller, "callerSub": scene.caller_sub or "휴대전화",
                "callLabel": scene.call_label or "수신 전화"}
    if scene.layout == "chat":
        # a dialogue chat without its own messages: the bubbles come from the lines (ChatScene times them to speech)
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
    if scene.layout == "compare":
        return {"real": dict(scene.real), "fake": dict(scene.fake)}
    if scene.layout == "toggle":
        return {"path": list(scene.path), "setting": scene.setting, "toggleTo": scene.toggle_to}
    if scene.layout == "flow":
        return {"nodes": [dict(n) for n in scene.nodes]}
    if scene.layout == "dots":
        return {"total": scene.total, "stages": [dict(s) for s in scene.stages], "unit": scene.unit}
    return {}


def scene_props(scene, audio: str, lead: float, speech: float, length: float, pages: list[dict],
                lines: list[dict] | None = None, staging: str | None = None) -> dict:
    """Props of one scene. Dialogue: `lines` = [{speaker, text, startMs, endMs}] (scene time, lead-in included);
    a twist scene gets {text, atMs}: the frame freezes and the stamp lands at atMs."""
    return {"layout": scene.layout, "audio": audio, "leadInMs": round(lead * 1000), "speechMs": round(speech * 1000),
            "durationMs": round(length * 1000), "pages": pages, "headline": scene.headline, "sub": scene.sub,
            "icon": scene.icon, "accent": scene.accent, **({"mark": scene.mark} if scene.mark else {}),
            **({"mascot": scene.mascot} if isinstance(scene.mascot, bool) else {}),
            **({"lines": lines} if lines else {}),
            **({"staging": staging} if staging else {}),
            **({"twist": {"text": scene.twist, "atMs": round((lead + speech + TWIST_DELAY) * 1000)}}
               if scene.twist else {}),
            **layout_props(scene)}


def scene_length(scene, lead: float, speech: float) -> float:
    """Lead-in + speech + the tail gap, or + the freeze-frame under the stamp for a twist scene."""
    return lead + speech + (TWIST_DELAY + TWIST_HOLD if scene.twist else TAIL_GAP)


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
    pre = presynth_lines(script, tts, work)   # dialogue: one Supertonic call per voice of the cast
    for i, scene in enumerate(script.scenes):
        lead = LEAD_IN.get(scene.layout, 0.0)
        if not scenes:
            lead = min(lead, FIRST_SCENE_MAX_LEAD_IN)
        if scene.lines:
            wav, speech, per_line, spans = _dialogue_speech(scene, i, tts, work, pre)
            length = scene_length(scene, lead, speech)
            shifted = [(a + lead, b + lead) for a, b in spans]
            pages = dialogue_pages(scene, [[(w, a + lead, b + lead) for w, a, b in ws] for ws in per_line], shifted,
                                   length)
            lines = lines_props(scene, shifted, cast_of(script))
        else:
            wav, speech, words = _speech(scene, i, tts, work)
            length = scene_length(scene, lead, speech)
            pages = caption_pages(scene.narration, [(w, a + lead, b + lead) for w, a, b in words], length)
            lines = None
        if speech < 0.3:
            raise ProductionError(f"scene {i + 1}: TTS produced no usable audio")
        shutil.copy(wav, public_job / wav.name)
        scenes.append(scene_props(scene, f"jobs/{script.id}/{wav.name}", lead, speech, length, pages, lines,
                                  default_staging(scene, cast_of(script))))
        total += round(length * 1000) / 1000
    music, music_item = music_props(script)
    props_path = out_dir / "props.json"
    # own fields, else topic + the stage-family rules over the schedule (see themes.py)
    style, style_warnings = resolve_style_report(script)
    theme = style.theme
    episode_no = episode_number(script.id)   # position in content/schedule.json; None if not scheduled
    props = build_props(script, scenes, channel_name, sfx, music, transition=transition, theme=theme,
                        category=style.category, episode_no=episode_no)
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
    total += POSTER_TAIL_MS / 1000   # the composition ends with the poster tail (Root.calculateMetadata)
    if abs(duration - total) > 0.6:
        raise ProductionError(f"output length {duration:.2f}s differs from the planned {total:.2f}s")
    warnings = [] if 15 <= duration <= 45 else [f"length {duration:.1f}s outside the 15-45s target"]
    warnings += style_warnings
    if not tts.publishable:
        warnings.append(f"voice backend '{tts.name}' is for local preview only; re-produce with --backend google to publish")
    if pre == {} and any(scene.lines for scene in script.scenes):
        warnings.append(f"voice backend '{tts.name}' has one voice: every dialogue line used it (the cast's voices need "
                        "--backend supertonic)")
    # thumbnail = frame 0, the poster (identical to the 0.5 s loop tail), so the file matches the frame the owner
    # can pick in the app and can be uploaded as-is where custom Shorts thumbnails are allowed
    subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y",
                    "-i", str(video), "-frames:v", "1", str(out_dir / "thumb.png")], capture_output=True)
    record_style(script, style)   # content/style_log.json: stage, theme, layouts (next episodes' constraints)
    extra = meta_extra(style, transition, render_seconds, episode_no, music_item)
    if any(scene.lines for scene in script.scenes):
        extra["cast"] = {s: {"voice": line_voice(script, s), **c} for s, c in cast_props(script).items()}
    meta = write_meta(out_dir, script, duration, size, tts, warnings, extra=extra)
    return ProductionResult(video, out_dir / "thumb.png", meta, round(duration, 2), size, bool(tts.publishable), warnings)

