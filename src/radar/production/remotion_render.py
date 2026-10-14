"""Remotion engine: Python prepares per-scene audio, word timings and props; the React project in
video/ renders the frames (animated scenes, phone-call mockup, word-synced captions, SFX).

Sound effects are synthesized here with ffmpeg (no downloaded assets, no third-party license).
"""
from __future__ import annotations

import asyncio
import json
import re
import shutil
import subprocess
import time
import zlib
from pathlib import Path

from radar.config import PROJECT_ROOT
from radar.production.assemble import (TRIM, ProductionError, ProductionResult, ffmpeg_exe, media_info, run_ffmpeg,
                                       write_meta)
from radar.production.script import (CAST_STYLES, COLD_OPEN_LABEL, COLD_OPEN_REWIND, DEFAULT_VILLAIN_SET, LAYOUT_LEAD_IN,
                                     LINE_GAP, costume_of, villain_set_of,
                                     TWIST_DELAY, TWIST_HOLD, Scene, Script, cast_of, caption_chunks, cold_open_hold,
                                     cold_open_line, cold_open_stamp, default_staging, hook_title_lines, is_drama,
                                     line_gap, line_voice, mockup_side, scene_lead_in, score_of, series_chip, twist_scene_index)
from radar.production.textnorm import speakable_length, split_sentences
from radar.production.themes import episode_number, record_style, resolve_style_report
from radar.production.tts import TTSError

VIDEO_DIR = PROJECT_ROOT / "video"
TAIL_GAP = 0.25          # seconds after each scene's speech (a twist scene ends on its freeze-frame instead)
CALL_LEAD_IN = LAYOUT_LEAD_IN["call"]   # the phone rings before the first line (explainers)
LEAD_IN = LAYOUT_LEAD_IN   # call rings, alert: the banner lands (ding) before the narration (script.scene_lead_in)
# FIRST_SCENE_MAX_LEAD_IN (script.py): the voice must start almost at once in the opening scene (swipe decision);
# a drama's dialogue starts at 0.0 s (script.scene_lead_in)
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
    # 도치's 가시 감지기 ("삐빅"): two short high beeps, the second a step higher
    "spike": "aevalsrc=exprs='0.32*(sin(2*PI*2093*t)*lt(t,0.07)+sin(2*PI*2637*t)*gte(t,0.1)*lt(t,0.19))':s=44100:d=0.24",
}
SFX_FILTERS = {
    "ring": "afade=t=out:st=2.1:d=0.3",
    "vibrate": "lowpass=f=400,afade=t=out:st=2.1:d=0.3",
    "whoosh": "highpass=f=350,lowpass=f=5000,afade=t=in:d=0.2,afade=t=out:st=0.2:d=0.25",
    "pop": "afade=t=out:st=0.12:d=0.08",
    "stamp": "lowpass=f=3200,afade=t=out:st=0.24:d=0.1",
    "ding": "afade=t=out:st=0.8:d=0.3",
    "spike": "afade=t=out:st=0.19:d=0.05",
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
    base = float(getattr(tts, "speed", 1.0) or 1.0)
    for voice, items in by_voice.items():
        raws = [work / f"raw{i}_{k}{tts.ext}" for i, k, _ in items]
        # each line is one synthesis call (whole=True): one intonation across "엄마, 나야. 사고 났어."
        spans = tts.synthesize_batch([(line.tts_text(), raw) for (_, _, line), raw in zip(items, raws)], voice=voice,
                                     whole=True, speeds=[base * line.speed if line.speed else None
                                                         for _, _, line in items])
        for (i, k, _), raw, sp in zip(items, raws, spans):
            out[(i, k)] = (raw, sp)
    return out


UNCLEAR_CER = 0.4   # a line whose best take still loses this share of its characters in the ASR check is flagged


def line_voice_check(pre: dict, scores: dict) -> dict[str, float]:
    """{"scene-line" (1-based): character error rate of the take that was kept} for the lines whose takes were
    checked by ASR (Supertonic with takes > 1). Natural sound changes (암호 heard as 아모) cost a little, so only a
    high rate means a swallowed word."""
    out = {}
    for (i, k), (raw, _) in sorted(pre.items()):
        got = scores.get(str(raw))
        if got:
            out[f"{i + 1}-{k + 1}"] = round(min(got), 3)
    return out


def join_wavs(parts: list[Path], gap: float | list[float], out: Path) -> list[tuple[float, float]]:
    """Concatenate same-format wavs with `gap` seconds of silence between them (sample exact; a list gives the
    silence before each part after the first). Returns each part's (start_s, end_s) inside `out`."""
    import wave

    gaps = list(gap) if isinstance(gap, (list, tuple)) else [gap] * max(0, len(parts) - 1)
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
            silence = int(round(gaps[k - 1] * params.framerate))
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
    """Synthesize a dialogue scene line by line (each in its speaker's voice) and join the clips with LINE_GAP (or
    a line's own "pause").
    Returns (wav, speech seconds, word timings per line, (start, end) per line), all relative to the wav."""
    clips = []
    for k, line in enumerate(scene.lines):
        if (i, k) in pre:
            raw, spans = pre[(i, k)]
            clips.append(_timed_clip(raw, work / f"s{i}_{k}.wav", line.text, spans, work))
        else:
            clips.append(_speech_text(line.text, line.tts_text(), f"{i}_{k}", tts, work))
    wav = work / f"s{i}.wav"
    gaps = [line_gap(line, prev) for prev, line in zip(scene.lines, scene.lines[1:])]   # a line's own beat
    spans = join_wavs([c[0] for c in clips], gaps, wav)
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
        notes = {k: getattr(line, k) for k in ("face", "gesture", "bubble", "spike") if getattr(line, k, "")}
        out.append({"speaker": line.speaker, "text": line.text, "startMs": round(a * 1000), "endMs": round(b * 1000),
                    **({"side": side} if side else {}), **notes})
    return out


def cast_props(script: Script) -> dict:
    """{speaker: {label, role, side}} for every speaker who has a line (the caption chip and the mockup side)."""
    cast = cast_of(script)
    used = [line.speaker for scene in script.scenes for line in scene.lines]
    return {s: {"label": cast[s].get("label", ""), "role": cast[s]["role"],
                **({"side": mockup_side(cast[s]["role"])} if mockup_side(cast[s]["role"]) else {}),
                **({"character": cast[s]["character"]} if cast[s].get("character") else {}),
                **({"costume": costume_of(cast, s)} if costume_of(cast, s) else {})}
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


LOUDNESS_TARGET, PEAK_CEILING = -14.0, -2.0   # LUFS (Shorts plays at ~-14); limiter ceiling dBFS (~-1.4 dBTP after AAC)
_LUFS_RE = re.compile(r"I:\s+(-?\d+(?:\.\d+)?) LUFS")


def measure_loudness(path: Path, seconds: float | None = None) -> float | None:
    """Integrated loudness (LUFS) of a file's audio (its first `seconds`), from ffmpeg's ebur128 summary; None when
    it cannot be read."""
    limit = ["-t", f"{seconds:g}"] if seconds else []
    proc = subprocess.run([ffmpeg_exe(), "-hide_banner", "-nostats", *limit, "-i", str(path), "-vn", "-af", "ebur128",
                           "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    found = _LUFS_RE.findall(proc.stderr or "")
    return float(found[-1]) if found else None


def loudness_filter(path: Path) -> str:
    """One static gain to LOUDNESS_TARGET plus a fast peak limiter. Single-pass loudnorm is dynamic: it rides the
    gain over ~3 s windows (measured +7.0..+8.8 dB across one pilot), so the bed breathes between lines; a static
    gain keeps the mix exactly as rendered. Falls back to loudnorm when the loudness cannot be measured."""
    measured = measure_loudness(path)
    if measured is None or measured < -70:
        return "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000"
    gain = max(-20.0, min(20.0, LOUDNESS_TARGET - measured))
    ceiling = 10 ** (PEAK_CEILING / 20)
    return (f"aresample=48000,volume={gain:.2f}dB,"
            f"alimiter=limit={ceiling:.4f}:attack=3:release=60:level=0,aresample=48000")


def _npx() -> str:
    exe = shutil.which("npx") or shutil.which("npx.cmd")
    if not exe:
        raise ProductionError("npx not found: install Node.js 20+ and run `npm install` in video/")
    return exe


MUSIC_VOLUME, MUSIC_DUCK = 0.22, 0.09   # ~ -13 dB / -21 dB relative to the track; voice stays on top
MUSIC_REF_LUFS, MUSIC_MEASURE_SECONDS = -23.0, 40   # every bed is first levelled to the quietest track (suspense)


def music_props(script: Script) -> tuple[dict | None, dict | None]:
    """(props entry for the music bed, manifest item) or (None, None) when the script has no music."""
    if not script.music:
        return None, None
    from radar.production.assets import music_for
    item = music_for(script.music)
    if item is None:
        raise ProductionError(f"music '{script.music}' is not downloaded: run `radar assets fetch`")
    src = item["file"].split("public/", 1)[1]
    scale = music_scale(PROJECT_ROOT / item["file"])
    return {"src": src, "volume": round(MUSIC_VOLUME * scale, 4), "duckVolume": round(MUSIC_DUCK * scale, 4)}, item


def music_scale(path: Path) -> float:
    """Gain (<= 1) that brings a track's opening MUSIC_MEASURE_SECONDS to MUSIC_REF_LUFS. The library spans -7 to
    -23 LUFS (2026-10-11), so one fixed volume put "tense" 6.6 dB over "suspense": ducked, it sat only ~6 dB under
    the voice in the mom-wins pilot and masked the words. 1.0 when the file cannot be measured."""
    if not path.is_file():
        return 1.0
    lufs = measure_loudness(path, seconds=MUSIC_MEASURE_SECONDS)
    if lufs is None or lufs < -70:
        return 1.0
    return min(1.0, 10 ** ((MUSIC_REF_LUFS - lufs) / 20))


VOICE_LABEL = "AI 음성"   # every narration is synthetic; OpenRAIL-M (Supertonic) requires an explicit disclaimer
# Growth lines, visual only (no narration, no extra time; see reports/구독자 1천명 외부 성장 전략.md (a) 3 and 6):
SHARE_LINE = "부모님께도 보내 주세요"   # handwritten under the closing checklist (family-chat sharing)
VALUE_CTA = "매일 1장, 생존노트"        # a small chip with a bell in the last ~1.2 s, gone before the poster tail
DRAMA_DISCLOSURE = "재연 · AI 음성"     # drama packaging: the one small disclosure chip (re-enactment + synthetic voice)


def episode_seed(script_id: str) -> int:
    """Deterministic per-episode seed for the stage's variants (scrap layout, sky clouds, prop drift): CRC32 of the
    script id, so a re-render draws the same picture and nothing is random at render time."""
    return zlib.crc32(script_id.encode("utf-8"))


def cold_open_props(script: Script, audio: str, speech: float, pages: list[dict], lines: list[dict]) -> dict | None:
    """The flash-forward (video/src/ColdOpen.tsx): the twist scene `scene` frozen with `stamp` on, the exclamation's
    audio from 0.0 s; holdMs = the frozen shot (>= the line + COLD_OPEN_PAD, so the rewind's sound never covers it),
    durationMs = hold + the 8-frame rewind; the story starts after it. None without a cold open."""
    k = twist_scene_index(script)
    if cold_open_line(script) is None or k is None:
        return None
    hold = cold_open_hold(script, speech)
    return {"audio": audio, "speechMs": round(speech * 1000), "holdMs": round(hold * 1000),
            "durationMs": round((hold + COLD_OPEN_REWIND) * 1000), "pages": pages, "lines": lines, "scene": k,
            "speaker": script.cold_open.get("speaker", ""), "stamp": cold_open_stamp(script),
            "label": script.cold_open.get("label") or COLD_OPEN_LABEL}


def _cold_open_speech(script: Script, tts, work: Path, public_job: Path) -> dict | None:
    """Synthesize the cold open's exclamation like any dialogue line (the speaker's voice) -> its props."""
    line = cold_open_line(script)
    if line is None or twist_scene_index(script) is None:
        return None
    scene = Scene(narration=line.text, headline="", lines=[line])
    pre = {}
    if tts.name == "supertonic":   # the cast's voices: one worker call for this voice (as presynth_lines does)
        raw = work / f"rawc_0{tts.ext}"
        pre[("c", 0)] = (raw, tts.synthesize_batch([(line.tts_text(), raw)],
                                                   voice=line_voice(script, line.speaker))[0])
    wav, speech, per_line, spans = _dialogue_speech(scene, "c", tts, work, pre)
    hold = cold_open_hold(script, speech)
    pages = dialogue_pages(scene, per_line, spans, hold)
    shutil.copy(wav, public_job / wav.name)
    return cold_open_props(script, f"jobs/{script.id}/{wav.name}", speech, pages,
                           lines_props(scene, spans, cast_of(script)))


def build_props(script: Script, scenes: list[dict], channel_name: str, sfx: bool = True,
                music: dict | None = None, voice_label: str | None = VOICE_LABEL,
                transition: str = "continuity", theme: str = "classic", category: str | None = None,
                episode_no: int | None = None, share_line: str | None = SHARE_LINE,
                cta: str | None = VALUE_CTA, cold_open: dict | None = None) -> dict:
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
        if any(c.get("character") for c in cast.values()):
            props["castStyle"] = cast_style_of(script)   # the skin of the rigged characters (Actor.tsx)
    if is_drama(script):
        # drama packaging (video/src/Packaging.tsx): an entertainment Short, not a notice. No series chip, share line,
        # CTA or on-screen source subs; the situation title and one "재연 · AI 음성" chip. The description keeps the
        # full disclaimer and the synthetic-voice line (build_description), the upload keeps "altered content: yes".
        for key in ("episodeNo", "shareLine", "cta"):
            props.pop(key, None)
        props.update(packaging="drama", hookTitle=hook_title_lines(script.hook_title), disclosure=DRAMA_DISCLOSURE,
                     scenes=[{**sc, "sub": "", **set_dressing(script, src)}
                             for sc, src in zip(scenes, list(script.scenes) + [None] * len(scenes))])
        # the series chip above the title, the closing scoreboard, the flash-forward (Packaging.tsx, ColdOpen.tsx)
        chip = series_chip(script)
        if chip:
            props["seriesChip"] = chip
        score = score_of(script)
        if score:
            props["score"] = score
        if cold_open:
            props["coldOpen"] = cold_open
    return props


def set_dressing(script: Script, scene: Scene | None) -> dict:
    """A drama scene's room ("set": the script's or its own, living by default), its poster prop and the caller's
    room (villainSet, the call centre by default)."""
    if scene is None:
        return {}
    home = scene.home_set or script.home_set
    villain = villain_set_of(script, scene)
    return {**({"set": home} if home and home != "living" else {}),
            **({"posterProp": scene.poster_prop} if scene.poster_prop else {}),
            **({"villainSet": villain} if villain != DEFAULT_VILLAIN_SET else {})}


def cast_style_of(script: Script) -> str:
    """The characters' skin: the script's cast_style, else human."""
    return script.cast_style if script.cast_style in CAST_STYLES else "human"


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
            **({"twist": {"text": scene.twist, "atMs": round((lead + speech + TWIST_DELAY) * 1000),
                          **({"on": scene.twist_on} if scene.twist_on else {}),
                          **({"face": scene.twist_face} if scene.twist_face else {})}}
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
        lead = scene_lead_in(script, i, scene)   # LEAD_IN by layout; 0.0 for a drama's dialogue
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
    cold = _cold_open_speech(script, tts, work, public_job)   # the flash-forward before the story (dramas only)
    if cold:
        total += cold["durationMs"] / 1000
    music, music_item = music_props(script)
    props_path = out_dir / "props.json"
    # own fields, else topic + the stage-family rules over the schedule (see themes.py)
    style, style_warnings = resolve_style_report(script)
    theme = style.theme
    episode_no = episode_number(script.id)   # position in content/schedule.json; None if not scheduled
    props = build_props(script, scenes, channel_name, sfx, music, transition=transition, theme=theme,
                        category=style.category, episode_no=episode_no, cold_open=cold)
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
    run_ffmpeg(["-i", raw_video.name, "-c:v", "copy", "-af", loudness_filter(raw_video),
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
    voice_check = line_voice_check(pre, getattr(tts, "take_scores", None) or {})
    unclear = [key for key, c in voice_check.items() if c >= UNCLEAR_CER]
    if unclear:
        warnings.append(f"lines {', '.join(unclear)} (scene-line) may sound garbled in every take (ASR check); listen, "
                        "or respell them in the line's tts")
    # thumbnail = frame 0, the poster (identical to the 0.5 s loop tail), so the file matches the frame the owner
    # can pick in the app and can be uploaded as-is where custom Shorts thumbnails are allowed
    subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y",
                    "-i", str(video), "-frames:v", "1", str(out_dir / "thumb.png")], capture_output=True)
    record_style(script, style)   # content/style_log.json: stage, theme, layouts (next episodes' constraints)
    extra = meta_extra(style, transition, render_seconds, None if is_drama(script) else episode_no, music_item)
    extra["packaging"] = props.get("packaging", "explainer")
    if props.get("seriesChip"):
        extra["series"] = {"name": script.series, "ep": script.ep, "chip": props["seriesChip"]}
    if props.get("score"):
        extra["score"] = props["score"]
    if props.get("coldOpen"):
        extra["cold_open"] = {"line": script.cold_open.get("line"), "stamp": props["coldOpen"]["stamp"],
                              "seconds": round(props["coldOpen"]["durationMs"] / 1000, 2)}
    if any(scene.lines for scene in script.scenes):
        extra["cast"] = {s: {"voice": line_voice(script, s), **c} for s, c in cast_props(script).items()}
        if "castStyle" in props:
            extra["cast_style"] = props["castStyle"]
    if voice_check:
        extra["voice_check"] = voice_check
    meta = write_meta(out_dir, script, duration, size, tts, warnings, extra=extra)
    return ProductionResult(video, out_dir / "thumb.png", meta, round(duration, 2), size, bool(tts.publishable), warnings)

