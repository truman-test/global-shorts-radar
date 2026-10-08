"""Script format and the QA gate every script must pass before production.

A script is our ORIGINAL story built from a Story DNA and verified independent sources. It
never contains the source video's narration. JSON shape:

{
  "id": "2026-10-08-family-password",            # [a-z0-9-], used as the output folder
  "source_video_id": "Pqap_P3rFJc",              # the radar signal (idea source), must be verified
  "title": "...", "description": "...", "tags": ["..."],
  "disclaimer": "※ 실제 수법을 바탕으로 한 재연입니다",
  "scenes": [{"narration": "...", "headline": "...", "sub": "...", "icon": "phone", "accent": "red",
              "tts": "(optional spoken override)"}],
  "sources": [{"title": "...", "url": "https://..."}],
  "author": "llm:<model> | manual"
}
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from radar.production.render import ACCENTS, ICONS
from radar.production.textnorm import normalize_for_tts, speakable_length, tts_problems

SYLLABLES_PER_SECOND = 6.0   # measured 6.01 chars/s on edge-tts SunHi at +15% after silence trimming (2026-10-08)
SCENE_GAP = 0.2              # seconds of silence after each scene
MIN_SECONDS, MAX_SECONDS = 12.0, 50.0
TARGET_SECONDS = (15.0, 45.0)
LAYOUTS = ("card", "call")
_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{2,80}$")


class ScriptError(ValueError):
    pass


@dataclass
class Scene:
    narration: str
    headline: str
    icon: str = "warning"
    sub: str = ""
    accent: str = "yellow"
    tts: str = ""
    layout: str = "card"        # card | call (incoming-call mockup; needs caller)
    caller: str = ""
    caller_sub: str = ""
    call_label: str = ""        # call layout: "수신 전화" (default) or e.g. "영상통화"

    def tts_text(self) -> str:
        return self.tts.strip() or normalize_for_tts(self.narration)


@dataclass
class Script:
    id: str
    source_video_id: str
    title: str
    description: str
    tags: list[str]
    disclaimer: str
    scenes: list[Scene]
    sources: list[dict]
    author: str = ""
    music: str = ""             # mood key from assets/manifest.json (tense, explainer, uplifting, tech, suspense)
    path: str = ""
    extra: dict = field(default_factory=dict)


def load_script(path: str | Path) -> Script:
    path = Path(path)
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ScriptError(f"{path}: {exc}") from exc
    try:
        scenes = [Scene(narration=str(s["narration"]).strip(), headline=str(s["headline"]).strip(),
                        icon=str(s.get("icon", "warning")), sub=str(s.get("sub", "")).strip(),
                        accent=str(s.get("accent", "yellow")), tts=str(s.get("tts", "")),
                        layout=str(s.get("layout", "card")), caller=str(s.get("caller", "")).strip(),
                        caller_sub=str(s.get("caller_sub", "")).strip(),
                        call_label=str(s.get("call_label", "")).strip())
                  for s in data["scenes"]]
        return Script(id=str(data["id"]), source_video_id=str(data["source_video_id"]), title=str(data["title"]).strip(),
                      description=str(data.get("description", "")).strip(), tags=[str(t) for t in data.get("tags", [])],
                      disclaimer=str(data.get("disclaimer", "")).strip(), scenes=scenes,
                      sources=[dict(s) for s in data.get("sources", [])], author=str(data.get("author", "")),
                      music=str(data.get("music", "")).strip(),
                      path=str(path))
    except (KeyError, TypeError, AttributeError) as exc:
        raise ScriptError(f"{path}: missing or malformed field {exc}") from exc


def estimate_seconds(script: Script) -> float:
    return sum(speakable_length(s.tts_text()) / SYLLABLES_PER_SECOND + SCENE_GAP for s in script.scenes)


def caption_chunks(text: str, max_chars: int = 10) -> list[str]:
    """Split a narration line into caption chunks of <= max_chars characters (one line at 84px in the
    820px caption box), breaking after sentence ends and after commas once a chunk has 5+ characters."""
    chunks, cur = [], ""
    for word in text.split():
        cand = f"{cur} {word}".strip()
        letters = len(cur.replace(" ", ""))
        if cur and (len(cand.replace(" ", "")) > max_chars or cur[-1] in ".?!…" or (cur[-1] == "," and letters >= 5)):
            chunks.append(cur)
            cur = word
        else:
            cur = cand
    if cur:
        chunks.append(cur)
    return chunks


def _hangul_ratio(text: str) -> float:
    letters = [c for c in text if c.isalpha()]
    return sum(1 for c in letters if "가" <= c <= "힣") / len(letters) if letters else 0.0


def build_description(script: Script, voice_note: str = "AI 합성 음성") -> str:
    lines = [script.description, "", script.disclaimer, f"음성: {voice_note}", "", "출처:"]
    lines += [f"- {s.get('title') or s['url']}: {s['url']}" for s in script.sources]
    hashtags = ["#Shorts"] + ["#" + t.replace(" ", "") for t in script.tags[:2]]
    lines += ["", " ".join(hashtags)]
    return "\n".join(lines).strip()


def validate(script: Script, db=None, allow_unverified: bool = False) -> tuple[list[str], list[str]]:
    """QA gate. Returns (errors, warnings); production refuses to run with any error."""
    errors, warnings = [], []
    if not _ID_RE.match(script.id):
        errors.append(f"id '{script.id}' must match [a-z0-9-] (3-81 chars)")
    if not 5 <= len(script.title) <= 95 or "<" in script.title or ">" in script.title:
        errors.append("title must be 5-95 characters without < or >")
    if not script.disclaimer:
        errors.append("disclaimer is required (every story is a re-enactment or explanation, never the original)")
    if not 3 <= len(script.scenes) <= 8:
        errors.append(f"{len(script.scenes)} scenes; use 3-8")
    good_sources = [s for s in script.sources if str(s.get("url", "")).startswith(("http://", "https://"))]
    if not good_sources:
        errors.append("at least one independent source URL is required")
    for i, sc in enumerate(script.scenes, start=1):
        if not sc.narration or not sc.headline:
            errors.append(f"scene {i}: narration and headline are required")
        if sc.icon not in ICONS:
            errors.append(f"scene {i}: unknown icon '{sc.icon}' (use {', '.join(ICONS)})")
        if sc.layout not in LAYOUTS:
            errors.append(f"scene {i}: unknown layout '{sc.layout}' (use {', '.join(LAYOUTS)})")
        elif sc.layout == "call" and not sc.caller:
            errors.append(f"scene {i}: layout 'call' needs a caller name")
        if sc.accent not in ACCENTS:
            errors.append(f"scene {i}: unknown accent '{sc.accent}' (use {', '.join(ACCENTS)})")
        if re.search(r"https?://|www\.", sc.narration + sc.headline + sc.sub):
            errors.append(f"scene {i}: no URLs on screen or in narration (put sources in the description)")
        bad = tts_problems(sc.tts_text())
        if bad:
            errors.append(f"scene {i}: TTS would misread {bad}; spell them in Hangul or add an acronym/tts override")
        if _hangul_ratio(sc.narration) < 0.6:
            errors.append(f"scene {i}: narration is not mostly Korean")
    seconds = estimate_seconds(script)
    if not MIN_SECONDS <= seconds <= MAX_SECONDS:
        errors.append(f"estimated length {seconds:.1f}s outside {MIN_SECONDS:.0f}-{MAX_SECONDS:.0f}s")
    elif not TARGET_SECONDS[0] <= seconds <= TARGET_SECONDS[1]:
        warnings.append(f"estimated length {seconds:.1f}s outside the {TARGET_SECONDS[0]:.0f}-{TARGET_SECONDS[1]:.0f}s target")
    if script.music:
        from radar.production.assets import moods
        known = moods()
        if known and script.music not in known:
            errors.append(f"music mood '{script.music}' not in assets/manifest.json ({', '.join(known)})")
    if len(", ".join(script.tags)) > 450:
        errors.append("tags exceed YouTube's ~500 character limit")
    if len(build_description(script)) > 4800:
        errors.append("description exceeds YouTube's 5,000 character limit")
    if db is not None:
        if db.video(script.source_video_id) is None:
            errors.append(f"source_video_id '{script.source_video_id}' is not a known radar candidate")
        else:
            ver = db.verification(script.source_video_id)
            status = ver["status"] if ver else "unverified"
            if status == "false":
                errors.append("the source story was judged FALSE; do not produce it")
            elif status != "verified":
                (warnings if allow_unverified else errors).append(
                    f"source story is '{status}', not verified (run `radar verify` first)")
    return errors, warnings
