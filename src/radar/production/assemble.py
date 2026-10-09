"""Assemble a vertical Short with ffmpeg: per-scene TTS audio, scene cards, word-group captions
burned in (ASS), and a thin progress bar. Captions are timed from each scene's real audio
length (weighted by characters), so any TTS backend works without word-boundary events.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from PIL import ImageFont

from radar.production.render import H, W, render_scene
from radar.production.script import SCENE_GAP, Script, build_description, caption_chunks

_DURATION_RE = re.compile(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)")
_SIZE_RE = re.compile(r"Video:.*?\b(\d{2,5})x(\d{2,5})\b")
MAX_SECONDS = 60.0


class ProductionError(RuntimeError):
    pass


def ffmpeg_exe() -> str:
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        exe = shutil.which("ffmpeg")
        if exe:
            return exe
    raise ProductionError("ffmpeg not found: pip install imageio-ffmpeg (or install ffmpeg on PATH)")


def run_ffmpeg(args: list[str], cwd: str | Path) -> None:
    proc = subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", *args], cwd=str(cwd),
                          capture_output=True, text=True, encoding="utf-8", errors="replace")
    if proc.returncode != 0:
        raise ProductionError(f"ffmpeg failed ({proc.returncode}): {proc.stderr.strip()[-1500:]}")


def media_info(path: str | Path) -> tuple[float, str]:
    """(duration seconds, 'WxH' or '') parsed from ffmpeg's probe output."""
    proc = subprocess.run([ffmpeg_exe(), "-hide_banner", "-i", str(path)], capture_output=True, text=True,
                          encoding="utf-8", errors="replace")
    m = _DURATION_RE.search(proc.stderr)
    duration = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3)) if m else 0.0
    s = _SIZE_RE.search(proc.stderr)
    return duration, (f"{s.group(1)}x{s.group(2)}" if s else "")


def _ts(seconds: float) -> str:
    cs = int(round(max(seconds, 0) * 100))
    h, rem = divmod(cs, 360000)
    m, rem = divmod(rem, 6000)
    s, cs = divmod(rem, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


TRIM = ("silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03,areverse,"
        "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03,areverse,aresample=44100")


def write_ass(events: list[tuple[float, float, str]], path: str | Path, font_name: str, font_size: int = 84,
              margin_v: int = 470) -> Path:
    """Shorts-style captions: bold white with a thick outline, centered in the 66-78% height band."""
    header = (
        "[Script Info]\nScriptType: v4.00+\n"
        f"PlayResX: {W}\nPlayResY: {H}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, "
        "Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, "
        "MarginR, MarginV, Encoding\n"
        f"Style: Cap,{font_name},{font_size},&H00FFFFFF,&H000000FF,&H00000000,&H78000000,-1,0,0,0,100,100,0,0,1,6,2,2,"
        f"100,160,{margin_v},1\n\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    lines = [f"Dialogue: 0,{_ts(a)},{_ts(b)},Cap,,0,0,0,,{text.replace('{', '(').replace('}', ')')}"
             for a, b, text in events]
    path = Path(path)
    path.write_text(header + "\n".join(lines) + "\n", encoding="utf-8")
    return path


@dataclass
class ProductionResult:
    video: Path
    thumbnail: Path
    meta: Path
    duration: float
    size: str
    publishable: bool
    warnings: list[str] = field(default_factory=list)


def produce(script: Script, out_root: str | Path, *, tts, channel_name: str, font_path: str,
            gap: float = SCENE_GAP) -> ProductionResult:
    out_dir = Path(out_root).resolve() / script.id
    work = out_dir / "work"
    if work.exists():
        shutil.rmtree(work)  # our own scratch folder for this script only
    (work / "fonts").mkdir(parents=True)
    shutil.copy(font_path, work / "fonts" / Path(font_path).name)
    font_name = ImageFont.truetype(font_path, 20).getname()[0]

    durations: list[float] = []
    for i, scene in enumerate(script.scenes):
        raw = work / f"raw{i}{tts.ext}"
        tts.synthesize(scene.tts_text(), raw)
        # TTS engines pad each clip with silence; trimming both ends keeps the Short tight
        run_ffmpeg(["-i", raw.name, "-af", TRIM, "-ac", "1", f"s{i}.wav"], cwd=work)
        seconds, _ = media_info(work / f"s{i}.wav")
        if seconds < 0.3:
            raise ProductionError(f"scene {i + 1}: TTS produced no usable audio")
        durations.append(seconds)
        render_scene(scene, work / f"s{i}.png", channel_name=channel_name, disclaimer=script.disclaimer,
                     font_path=font_path, show_disclaimer=(i == 0))

    events, start = [], 0.0
    for scene, seconds in zip(script.scenes, durations):
        chunks = caption_chunks(scene.narration)
        weights = [max(1, len(c.replace(" ", ""))) for c in chunks]
        t = start
        for chunk, weight in zip(chunks, weights):
            span = seconds * weight / sum(weights)
            events.append((t, t + span, chunk))
            t += span
        start += seconds + gap
    total = start
    write_ass(events, work / "captions.ass", font_name)

    n = len(durations)
    inputs = [arg for i in range(n) for arg in ("-i", f"s{i}.wav")]
    graph = ";".join(f"[{i}:a]aresample=44100,apad=pad_dur={gap}[a{i}]" for i in range(n))
    graph += ";" + "".join(f"[a{i}]" for i in range(n)) + \
        f"concat=n={n}:v=0:a=1,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100[out]"
    run_ffmpeg([*inputs, "-filter_complex", graph, "-map", "[out]", "-ac", "2", "audio.wav"], cwd=work)

    listing = []
    for i, seconds in enumerate(durations):
        listing += [f"file 's{i}.png'", f"duration {seconds + gap:.3f}"]
    listing.append(f"file 's{n - 1}.png'")  # concat demuxer needs the last frame repeated
    (work / "images.txt").write_text("\n".join(listing) + "\n", encoding="utf-8")

    video = out_dir / "video.mp4"
    vgraph = (f"[0:v]fps=30,scale={W}:{H},format=yuv420p,subtitles=captions.ass:fontsdir=fonts[v0];"
              f"color=c=0xFFD200:s={W}x14:r=30[bar];"
              f"[v0][bar]overlay=x='-w+w*t/{total:.3f}':y=0:shortest=1,format=yuv420p[v]")
    run_ffmpeg(["-f", "concat", "-safe", "0", "-i", "images.txt", "-i", "audio.wav", "-filter_complex", vgraph,
                "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", str(video)], cwd=work)

    duration, size = media_info(video)
    if size != f"{W}x{H}":
        raise ProductionError(f"output is {size or 'unknown size'}, expected {W}x{H}")
    if abs(duration - total) > 0.8:
        raise ProductionError(f"output length {duration:.2f}s differs from the planned {total:.2f}s")
    if duration > MAX_SECONDS:
        raise ProductionError(f"output length {duration:.1f}s exceeds {MAX_SECONDS:.0f}s")
    warnings = [] if 15 <= duration <= 45 else [f"length {duration:.1f}s outside the 15-45s target"]
    if not tts.publishable:
        warnings.append(f"voice backend '{tts.name}' is for local preview only; re-produce with --backend google to publish")

    thumb = out_dir / "thumb.png"
    shutil.copy(work / "s0.png", thumb)
    meta = write_meta(out_dir, script, duration, size, tts, warnings, extra={"engine": "ffmpeg"})
    return ProductionResult(video, thumb, meta, round(duration, 2), size, bool(tts.publishable), warnings)


def write_meta(out_dir: Path, script: Script, duration: float, size: str, tts, warnings: list[str],
               extra: dict | None = None) -> Path:
    """meta.json next to the video: everything an uploader needs, plus provenance.

    contains_synthetic_media is always True: the narration is machine generated and the scenes are
    realistic reenactments, which YouTube asks creators to disclose (the "altered or synthetic content" box).
    """
    meta = out_dir / "meta.json"
    meta.write_text(json.dumps({
        "script_id": script.id, "source_video_id": script.source_video_id, "script_path": script.path,
        "title": script.title, "description": build_description(script), "tags": script.tags,
        "duration_seconds": round(duration, 2), "size": size, "tts_backend": tts.name,
        "voice": getattr(tts, "voice", None), "publishable": bool(tts.publishable),
        "contains_synthetic_media": True, "made_for_kids": False, "category_id": "27",
        "default_language": "ko", "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "warnings": warnings, **(extra or {}),
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    return meta
