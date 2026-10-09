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
  "author": "llm:<model> | manual",
  "theme": "aurora",                              # optional stage theme (radar.production.themes); default:
                                                  # picked by topic + the stage-family rules over the schedule
  "category": "voice"                             # optional topic category (ai | security | smishing | voice)
}

Scene layouts ("layout"; every layout keeps headline/sub/icon/accent):
  card       explainer card (default)
  call       incoming-call mockup: caller, caller_sub, call_label
  chat       invented messenger thread: chat_title, messages=[{"from": "them"|"me", "text": "..."}]
  sms        invented text message: sender, sms_text (links masked like "http://●●●●.kr/…")
  alert      push banner over a dimmed phone: app_label (generic, e.g. "은행 앱"), alert_text
  stat       one big counting number: stat_value ("6,581억 원"), stat_label
  timeline   2-4 dated steps: steps=[{"when": "1일차", "text": "..."}]
  checklist  2-4 action items ticked one by one: items=["...", "..."]
  compare    진짜 vs 가짜 split: real={"label": "진짜", "title": "...", "points": ["..."]}, fake={... "label": "가짜"}
  toggle     settings flow: path=["보안", "결제 인증"] (1-3 menu steps), setting="...", toggle_to="on"|"off"
  flow       hand-drawn decision chart: nodes=[{"text": "...", "yes": "side box"} | {"text", "no"} | {"text"}] (3-5)
  dots       seeded dot simulation: total=1000, stages=[{"label": "링크 클릭", "count": 120}, ...] (2-4, a funnel:
             each count <= the previous; every number must come from the script's sources), unit="명"
Every scene may set "mark": the headline's key phrase (a substring) that gets the highlighter / underline.
Mockup text never contains real phone numbers, real-looking links or brand names.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from radar.production.render import ACCENTS, ICONS
from radar.production.textnorm import normalize_for_tts, speakable_length, tts_problems

SYLLABLES_PER_SECOND = 5.4   # Supertonic F1 at speed 1.2: measured 5.16 spoken chars/s at 1.15 over 40 scenes (2026-10-09)
SCENE_GAP = 0.25             # seconds of silence after each scene (remotion_render.TAIL_GAP)
LAYOUT_LEAD_IN = {"call": 0.9, "alert": 0.5}   # time before the narration starts (first scene capped at 0.4 s)
POSTER_TAIL = 0.5            # the loop-back poster at the end
MIN_SECONDS, MAX_SECONDS = 12.0, 50.0
TARGET_SECONDS = (20.0, 36.0)   # final video length; Shorts research 2026-10-09: 30-35 s for this channel
LAYOUTS = ("card", "call", "chat", "sms", "alert", "stat", "timeline", "checklist", "compare", "toggle", "flow", "dots")
MASK = "●"
# Real apps, banks, platforms and people that must never appear in an invented mockup.
BRANDS = ("카카오", "카톡", "토스", "네이버", "구글", "애플", "삼성", "갤럭시", "아이폰", "유튜브", "인스타", "페이스북",
          "쿠팡", "배민", "국민은행", "신한", "우리은행", "하나은행", "농협", "기업은행", "케이뱅크", "새마을금고",
          "우체국", "SKT", "KT", "LG유플러스", "kakao", "toss", "naver", "google", "apple", "samsung", "galaxy",
          "iphone", "youtube", "instagram", "facebook", "whatsapp", "telegram", "coupang", "paypal", "amazon",
          "netflix", "microsoft", "openai", "chatgpt")
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
    chat_title: str = ""        # chat: name in the thread header, e.g. "엄마"
    messages: list[dict] = field(default_factory=list)   # chat: [{"from": "them"|"me", "text": "..."}]
    sender: str = ""            # sms: sender label, e.g. "택배 안내" or "010-●●●●-●●●●"
    sms_text: str = ""          # sms: body; links masked like "http://●●●●.kr/…"
    app_label: str = ""         # alert: generic app name, e.g. "은행 앱"
    alert_text: str = ""        # alert: notification body
    stat_value: str = ""        # stat: e.g. "6,581억 원" (the numeric part counts up)
    stat_label: str = ""        # stat: what the number is
    steps: list[dict] = field(default_factory=list)      # timeline: [{"when": "1일차", "text": "..."}]
    items: list[str] = field(default_factory=list)       # checklist: ["...", "..."]
    mark: str = ""              # any layout: the headline's key phrase (substring) to highlight
    real: dict = field(default_factory=dict)             # compare: {"label", "title", "points"}
    fake: dict = field(default_factory=dict)             # compare: {"label", "title", "points"}
    path: list[str] = field(default_factory=list)        # toggle: menu steps tapped through
    setting: str = ""           # toggle: the switch's row label
    toggle_to: str = "on"       # toggle: "on" | "off"
    nodes: list[dict] = field(default_factory=list)      # flow: [{"text", "yes"?, "no"?}]
    total: int = 0              # dots: people the grid stands for
    stages: list[dict] = field(default_factory=list)     # dots: [{"label", "count"}]
    unit: str = "명"            # dots: counter unit

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
    theme: str = ""             # stage theme (radar.production.themes.THEMES); "" = by topic + family rules
    category: str = ""          # topic category (radar.production.themes.CATEGORIES); "" = by topic
    path: str = ""
    extra: dict = field(default_factory=dict)


def _int(v) -> int:
    """Whole numbers only ("1,000" is accepted); anything else becomes -1 so validation reports it."""
    if isinstance(v, bool):
        return -1
    if isinstance(v, int):
        return v
    try:
        f = float(str(v).replace(",", ""))
    except ValueError:
        return -1
    return int(f) if f.is_integer() else -1


def _side(v, label: str) -> dict:
    if not isinstance(v, dict):
        return {}
    return {"label": str(v.get("label", label)).strip() or label, "title": str(v.get("title", "")).strip(),
            "points": [str(p).strip() for p in v.get("points", [])]}


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
                        call_label=str(s.get("call_label", "")).strip(),
                        chat_title=str(s.get("chat_title", "")).strip(),
                        messages=[{"from": str(m.get("from", "them")).strip(), "text": str(m.get("text", "")).strip()}
                                  for m in s.get("messages", [])],
                        sender=str(s.get("sender", "")).strip(), sms_text=str(s.get("sms_text", "")).strip(),
                        app_label=str(s.get("app_label", "")).strip(), alert_text=str(s.get("alert_text", "")).strip(),
                        stat_value=str(s.get("stat_value", "")).strip(), stat_label=str(s.get("stat_label", "")).strip(),
                        steps=[{"when": str(t.get("when", "")).strip(), "text": str(t.get("text", "")).strip()}
                               for t in s.get("steps", [])],
                        items=[str(t).strip() for t in s.get("items", [])],
                        mark=str(s.get("mark", "")).strip(), real=_side(s.get("real"), "진짜"),
                        fake=_side(s.get("fake"), "가짜"), path=[str(t).strip() for t in s.get("path", [])],
                        setting=str(s.get("setting", "")).strip(),
                        toggle_to=str(s.get("toggle_to", "on")).strip().lower(),
                        nodes=[{k: str(n[k]).strip() for k in ("text", "yes", "no") if str(n.get(k, "")).strip()}
                               for n in s.get("nodes", [])],
                        total=_int(s.get("total", 0)),
                        stages=[{"label": str(t.get("label", "")).strip(), "count": _int(t.get("count", 0))}
                                for t in s.get("stages", [])],
                        unit=str(s.get("unit", "명")).strip() or "명")
                  for s in data["scenes"]]
        return Script(id=str(data["id"]), source_video_id=str(data["source_video_id"]), title=str(data["title"]).strip(),
                      description=str(data.get("description", "")).strip(), tags=[str(t) for t in data.get("tags", [])],
                      disclaimer=str(data.get("disclaimer", "")).strip(), scenes=scenes,
                      sources=[dict(s) for s in data.get("sources", [])], author=str(data.get("author", "")),
                      music=str(data.get("music", "")).strip(), theme=str(data.get("theme", "")).strip(),
                      category=str(data.get("category", "")).strip(), path=str(path))
    except (KeyError, TypeError, AttributeError) as exc:
        raise ScriptError(f"{path}: missing or malformed field {exc}") from exc


def estimate_seconds(script: Script) -> float:
    total = POSTER_TAIL
    for i, s in enumerate(script.scenes):
        lead = LAYOUT_LEAD_IN.get(s.layout, 0.0)
        total += speakable_length(s.tts_text()) / SYLLABLES_PER_SECOND + SCENE_GAP + (min(lead, 0.4) if i == 0 else lead)
    return total


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


BRAND_HASHTAG = "#디지털생존노트"


def build_description(script: Script, voice_note: str = "AI 합성 음성 (실제 인물의 목소리가 아닙니다)") -> str:
    lines = [script.description, "", script.disclaimer, f"음성: {voice_note}", "", "출처:"]
    lines += [f"- {s.get('title') or s['url']}: {s['url']}" for s in script.sources]
    # #Shorts is not needed (any vertical video up to 3 min is a Short); lead with the channel tag, 3 hashtags total
    hashtags = [BRAND_HASHTAG] + ["#" + t.replace(" ", "") for t in script.tags[:2]]
    lines += ["", " ".join(hashtags)]
    return "\n".join(lines).strip()


_LINKISH_RE = re.compile(r"(?i)://|www\.|\.[a-z]{2,6}(?:/|$)")
_MASKED_LINK_RE = re.compile(r"^(?:https?://)?●+(?:\.●+)*\.[a-z]{2,6}(?:/[●…./]*)?[가-힣]*$")
_PHONE_RE = re.compile(
    r"(?<!\d)(?:\+?82[-. ]?)?0\d{1,2}[-. )]?\d{3,4}[-. ]?\d{4}(?!\d)"    # 010-1234-5678, 02-123-4567
    r"|(?<!\d)1[5-9]\d{2}[-. ]?\d{4}(?!\d)"                              # 1588-0000
    r"|\+\d{1,3}[ -]?\d{2,4}[ -]?\d{3,4}[ -]?\d{3,4}"                    # +1 202 555 0100
    r"|\d{7,}")                                                          # account-like digit runs
_BRAND_RES = [(b, re.compile(rf"(?<![A-Za-z]){re.escape(b)}(?![A-Za-z])", re.I) if b.isascii()
               else re.compile(re.escape(b) + ("(?!트)" if b == "토스" else ""))) for b in BRANDS]


def mockup_text_problems(text: str) -> list[str]:
    """Problems with text shown inside an invented phone mockup: real-looking links, real phone or
    account numbers, real brand names. Links must be masked with ● in host and path ("http://●●●●.kr/…"),
    numbers like "010-●●●●-●●●●"."""
    problems = []
    for token in text.split():
        token = token.strip(".,!?)(\"'“”‘’[]<>")
        if token and _LINKISH_RE.search(token):
            if not _MASKED_LINK_RE.match(token):
                problems.append(f"unmasked link '{token}' (mask it like http://{MASK * 4}.kr/…)")
            elif len(token) > 24:
                problems.append(f"masked link '{token}' is longer than 24 characters (it must fit one line)")
    problems += [f"real-looking number '{m.group(0).strip()}' (mask digits with {MASK})" for m in _PHONE_RE.finditer(text)]
    problems += [f"real brand '{b}' (use a generic name like '은행 앱')" for b, rx in _BRAND_RES if rx.search(text)]
    return problems


# layout -> (required fields, fields shown inside a mockup, max characters per field)
_LAYOUT_RULES = {
    "call": (("caller",), ("caller", "caller_sub"), {"caller": 8, "caller_sub": 14}),
    "chat": (("messages",), ("chat_title",), {"chat_title": 12}),
    "sms": (("sender", "sms_text"), ("sender", "sms_text"), {"sender": 20, "sms_text": 100}),
    "alert": (("app_label", "alert_text"), ("app_label", "alert_text"), {"app_label": 12, "alert_text": 70}),
    "stat": (("stat_value", "stat_label"), (), {"stat_value": 12, "stat_label": 28}),
    "timeline": (("steps",), (), {}),
    "checklist": (("items",), (), {}),
    "compare": (("real", "fake"), (), {}),
    "toggle": (("path", "setting"), ("setting",), {"setting": 14}),
    "flow": (("nodes",), (), {}),
    "dots": (("total", "stages"), (), {"unit": 2}),
}


def _new_layout_errors(i: int, sc: Scene) -> tuple[list[str], list[str]]:
    """(errors, mockup texts) for compare / toggle / flow / dots."""
    errors, texts = [], []
    if sc.layout == "compare":
        for name, side in (("real", sc.real), ("fake", sc.fake)):
            if not side:
                continue
            if not 1 <= len(side.get("label", "")) <= 4:
                errors.append(f"scene {i}: {name}.label must be 1-4 characters (e.g. 진짜 / 가짜)")
            if not 1 <= len(side.get("title", "")) <= 20:
                errors.append(f"scene {i}: {name}.title needs 1-20 characters (the sender, number or address shown)")
            if len(side.get("points", [])) > 3 or any(not 1 <= len(p) <= 14 for p in side.get("points", [])):
                errors.append(f"scene {i}: {name}.points takes 0-3 lines of 1-14 characters")
            texts += [side.get("title", ""), *side.get("points", [])]
    elif sc.layout == "toggle":
        if sc.path and (len(sc.path) > 3 or any(not 1 <= len(p) <= 10 for p in sc.path)):
            errors.append(f"scene {i}: toggle path takes 1-3 menu steps of 1-10 characters")
        if sc.toggle_to not in ("on", "off"):
            errors.append(f"scene {i}: toggle_to must be 'on' or 'off'")
        texts += list(sc.path)
    elif sc.layout == "flow":
        if sc.nodes and not 3 <= len(sc.nodes) <= 5:
            errors.append(f"scene {i}: flow needs 3-5 nodes")
        for k, n in enumerate(sc.nodes, start=1):
            if not 1 <= len(n.get("text", "")) <= 16:
                errors.append(f"scene {i}: node {k} needs text of 1-16 characters")
            if "yes" in n and "no" in n:
                errors.append(f"scene {i}: node {k} may branch on 'yes' or 'no', not both "
                              "(the chain continues down with the other answer)")
            for key in ("yes", "no"):
                if key in n and len(n[key]) > 10:
                    errors.append(f"scene {i}: node {k} '{key}' branch is longer than 10 characters")
            texts += [n.get("text", ""), n.get("yes", ""), n.get("no", "")]
    elif sc.layout == "dots":
        if sc.total and not 10 <= sc.total <= 1_000_000:
            errors.append(f"scene {i}: dots total must be a whole number of 10-1,000,000")
        if sc.stages and not 2 <= len(sc.stages) <= 4:
            errors.append(f"scene {i}: dots needs 2-4 stages")
        prev = sc.total
        for k, st in enumerate(sc.stages, start=1):
            if not 1 <= len(st.get("label", "")) <= 10:
                errors.append(f"scene {i}: stage {k} needs a label of 1-10 characters")
            n = st.get("count", -1)
            if not isinstance(n, int) or n < 1 or (prev > 0 and n > prev):
                errors.append(f"scene {i}: stage {k} count must be a whole number from 1 to the previous stage's "
                              f"({prev}): the stages are a funnel, and every number must come from the sources")
            else:
                prev = n
    return errors, texts


def _layout_errors(i: int, sc: Scene) -> list[str]:
    need, mock, limits = _LAYOUT_RULES.get(sc.layout, ((), (), {}))
    errors = []
    for name in need:
        if not getattr(sc, name):
            errors.append(f"scene {i}: layout '{sc.layout}' needs {'a caller name' if name == 'caller' else name}")
    for name, n in limits.items():
        if len(getattr(sc, name)) > n:
            errors.append(f"scene {i}: {name} is longer than {n} characters")
    texts = [getattr(sc, name) for name in mock]
    if sc.layout == "chat":
        texts += [m.get("text", "") for m in sc.messages]
        if len(sc.messages) > 5:
            errors.append(f"scene {i}: chat has {len(sc.messages)} messages; use at most 5")
        for k, m in enumerate(sc.messages, start=1):
            if m.get("from") not in ("them", "me"):
                errors.append(f"scene {i}: message {k} 'from' must be 'them' or 'me'")
            if not 1 <= len(m.get("text", "")) <= 40:
                errors.append(f"scene {i}: message {k} needs text of 1-40 characters")
    elif sc.layout == "stat" and sc.stat_value and not re.search(r"\d", sc.stat_value):
        errors.append(f"scene {i}: stat_value '{sc.stat_value}' has no number to count up")
    elif sc.layout == "timeline":
        if sc.steps and not 2 <= len(sc.steps) <= 4:
            errors.append(f"scene {i}: timeline needs 2-4 steps")
        for k, st in enumerate(sc.steps, start=1):
            if not st.get("when") or len(st["when"]) > 10 or not st.get("text") or len(st["text"]) > 26:
                errors.append(f"scene {i}: step {k} needs 'when' (<= 10 chars) and 'text' (<= 26 chars)")
    elif sc.layout == "checklist":
        if sc.items and not 2 <= len(sc.items) <= 4:
            errors.append(f"scene {i}: checklist needs 2-4 items")
        if any(not 1 <= len(t) <= 22 for t in sc.items):
            errors.append(f"scene {i}: checklist items must be 1-22 characters")
    if sc.layout in ("compare", "toggle", "flow", "dots"):
        more, extra = _new_layout_errors(i, sc)
        errors += more
        texts += extra
    if sc.mark and sc.mark not in sc.headline:
        errors.append(f"scene {i}: mark '{sc.mark}' is not part of the headline")
    for text in texts:
        errors += [f"scene {i}: {p}" for p in mockup_text_problems(text)]
    return errors


def validate(script: Script, db=None, allow_unverified: bool = False) -> tuple[list[str], list[str]]:
    """QA gate. Returns (errors, warnings); production refuses to run with any error."""
    errors, warnings = [], []
    if not _ID_RE.match(script.id):
        errors.append(f"id '{script.id}' must match [a-z0-9-] (3-81 chars)")
    if "#" in script.title:
        warnings.append("title contains a hashtag; keep hashtags in the description (#Shorts is not needed)")
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
        else:
            errors += _layout_errors(i, sc)
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
    if script.theme or script.category:
        from radar.production.themes import CATEGORIES, THEMES
        if script.theme and script.theme not in THEMES:
            errors.append(f"unknown theme '{script.theme}' (use {', '.join(THEMES)})")
        if script.category and script.category not in CATEGORIES:
            errors.append(f"unknown category '{script.category}' (use {', '.join(CATEGORIES)})")
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
