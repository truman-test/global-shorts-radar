"""Stages (background family + theme) and topic categories for the Remotion engine.

video/src/tokens.json holds the colours; video/src/themes.ts draws them. The brand layer is fixed on every episode
(the white note card, captions, 위험/주의/안전 tones, type scale, brand line, disclaimer, continuity transition);
what changes per episode is the stage and the category colour:

- families: "alert" (다크 경보: the dark themes) and "paper" (종이 노트: cream paper, the channel's signature);
- category (topic): ai (AI·딥페이크), security (폰 보안·설정), smishing (스미싱·문자), voice (보이스피싱·전화).

Choice, deterministic (no randomness; the same script always gets the same stage):
1. the script's own "theme" (its family follows) and "category" fields win;
2. category = the topic with the most keyword hits in title + tags (ties: earlier rule);
3. preferred family = paper for how-to/settings topics, else the category's default;
4. rules over the schedule (walked in date order): never the same family three days running, at most 3 dark (alert)
   days in any 7; a choice that would make a later day impossible is avoided (look-ahead);
5. theme: alert -> the category's dark theme, never the previous dark day's; paper -> alternates paper/graph.
Episodes already recorded in content/style_log.json keep their recorded stage in the walk.
"""
from __future__ import annotations

import json
import zlib
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from radar.config import PROJECT_ROOT

# name -> one-line description (keep in sync with video/src/tokens.json "stages")
THEMES = {
    "pulse": "다크 경보: dark teal, concentric rings slowly expanding with a faint radar sweep",
    "circuit": "다크 경보: neutral charcoal, faint circuit traces with a few signals running along them",
    "scan": "다크 경보: indigo ink, fine diagonal hatching sliding slowly and a soft scan band",
    "aurora": "다크 경보: dark plum, slow aurora ribbons and silk lines",
    "dots": "다크 경보: wine graphite, a fine dot matrix that a slow light wave passes over",
    "paper": "종이 노트: cream ruled notebook page, red margin, punched holes, paper grain",
    "graph": "종이 노트: cream graph-paper page (모눈), paper grain",
    "contour": "on hold (explicit only): deep forest ink, topographic contour lines",
    "notebook": "on hold (explicit only): the old dark ruled notebook (superseded by the paper family)",
    "classic": "re-renders only: the original navy with a drifting square grid",
}
FAMILIES = {"alert": ("pulse", "circuit", "scan", "aurora", "dots"), "paper": ("paper", "graph")}
FAMILY_LABELS = {"alert": "다크 경보", "paper": "종이 노트"}
FAMILY_OF = {t: f for f, ts in FAMILIES.items() for t in ts} | {"contour": "alert", "notebook": "alert",
                                                                   "classic": "alert"}
ROTATION = FAMILIES["alert"] + FAMILIES["paper"]   # every automatically picked theme

CATEGORIES = {"ai": "AI·딥페이크", "security": "폰 보안·설정", "smishing": "스미싱·문자", "voice": "보이스피싱·전화"}

# (category, default family, dark themes in order of preference, keywords) — most distinct hits in title + tags wins
TOPICS = (
    ("voice", "alert", ("pulse", "dots"), ("보이스피싱", "딥보이스", "목소리", "음성", "전화", "통화", "고객센터", "번호")),
    ("ai", "alert", ("aurora", "scan"), ("딥페이크", "AI 이미지", "AI 사진", "가짜 사진", "조작 사진", "사진", "영상",
                                         "가짜뉴스", "합성")),
    ("security", "alert", ("circuit", "scan"), ("해킹", "유출", "스파이웨어", "악성", "랜섬", "제로클릭", "계정",
                                                "개인정보", "보안", "업데이트", "비밀번호", "인증", "결제", "설정",
                                                "자녀", "아이")),
    ("smishing", "paper", ("scan", "dots"), ("피싱", "스미싱", "문자", "링크", "택배", "큐알", "QR", "광고")),
)
DEFAULT_CATEGORY = "security"
# how-to / settings / checklist-led topics go on paper (설정법, 대응 절차)
PAPER_WORDS = ("설정", "켜세요", "켜기", "비밀번호", "자녀", "부모", "체크리스트", "방법")

MAX_DARK_IN_7 = 3
MAX_RUN = 2

SCHEDULE = PROJECT_ROOT / "content" / "schedule.json"
SCRIPTS_DIR = PROJECT_ROOT / "content" / "scripts"
STYLE_LOG = PROJECT_ROOT / "content" / "style_log.json"


@dataclass(frozen=True)
class Style:
    family: str
    theme: str
    category: str


def _text(script) -> str:
    return " ".join([script.title, *script.tags])


def topic_category(script) -> str:
    """The script's category: its own "category" field, else the topic with the most keyword hits."""
    own = getattr(script, "category", "")
    if own:
        return own
    text = _text(script)
    best, best_hits = DEFAULT_CATEGORY, 0
    for cat, _family, _themes, words in TOPICS:
        hits = sum(1 for w in words if w in text)
        if hits > best_hits:
            best, best_hits = cat, hits
    return best


def preferred_family(script) -> str:
    if getattr(script, "theme", ""):
        return FAMILY_OF.get(script.theme, "alert")
    if any(w in _text(script) for w in PAPER_WORDS):
        return "paper"
    cat = topic_category(script)
    return next(f for c, f, _t, _w in TOPICS if c == cat)


def _allowed(history: list[str], family: str) -> bool:
    seq = history + [family]
    if len(seq) > MAX_RUN and len(set(seq[-(MAX_RUN + 1):])) == 1:
        return False
    return seq[-7:].count("alert") <= MAX_DARK_IN_7


def _feasible(history: list[str], depth: int = 6) -> bool:
    if depth == 0:
        return True
    return any(_allowed(history, f) and _feasible(history + [f], depth - 1) for f in FAMILIES)


def choose_family(history: list[str], preferred: str) -> str:
    """The preferred family if the rules allow it now and later; else the other one (preferred as a last resort)."""
    for fam in (preferred, *(f for f in FAMILIES if f != preferred)):
        if _allowed(history, fam) and _feasible(history + [fam]):
            return fam
    for fam in (preferred, *(f for f in FAMILIES if f != preferred)):
        if _allowed(history, fam):
            return fam
    return preferred


def rotation_theme(script_id: str, family: str, avoid: str | None = None) -> str:
    """Deterministic pick from a family's themes by script id, skipping `avoid`."""
    themes = FAMILIES[family]
    k = zlib.crc32(script_id.encode("utf-8")) % len(themes)
    pick = themes[k]
    return themes[(k + 1) % len(themes)] if pick == avoid else pick


def pick_style(script, history: list[Style] | None = None) -> Style:
    """Stage + category for `script` given the earlier episodes (oldest first)."""
    history = history or []
    category = topic_category(script)
    if getattr(script, "theme", ""):
        return Style(FAMILY_OF.get(script.theme, "alert"), script.theme, category)
    family = choose_family([h.family for h in history], preferred_family(script))
    last = next((h.theme for h in reversed(history) if h.family == family), None)
    if family == "paper":
        theme = rotation_theme(script.id, "paper", avoid=last) if last is None else \
            next(t for t in FAMILIES["paper"] if t != last)
    else:
        cat_themes = next(t for c, _f, t, _w in TOPICS if c == category)
        theme = next((t for t in cat_themes if t != last), rotation_theme(script.id, "alert", avoid=last))
    return Style(family, theme, category)


def load_style_log(path: str | Path | None = None) -> dict:
    try:
        data = json.loads(Path(path or STYLE_LOG).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"episodes": {}}
    data.setdefault("episodes", {})
    return data


def _scheduled(schedule_path: Path) -> list[dict]:
    try:
        entries = json.loads(schedule_path.read_text(encoding="utf-8")).get("entries", [])
    except (OSError, ValueError):
        entries = []
    return sorted((e for e in entries if e.get("script")), key=lambda e: str(e.get("date", "")))


def resolve_style(script, schedule_path: str | Path | None = None, scripts_dir: str | Path | None = None,
                  log_path: str | Path | None = None) -> Style:
    """pick_style with the schedule walked in date order as history (logged episodes keep their logged stage).
    A script that is not scheduled is placed after the whole schedule."""
    from radar.production.script import ScriptError, load_script

    sdir = Path(scripts_dir or SCRIPTS_DIR)
    logged = load_style_log(log_path)["episodes"]
    history: list[Style] = []
    for entry in _scheduled(Path(schedule_path or SCHEDULE)):
        sid = entry["script"]
        if sid == script.id:
            return pick_style(script, history)
        rec = logged.get(sid)
        if rec and rec.get("theme") in THEMES:
            history.append(Style(FAMILY_OF[rec["theme"]], rec["theme"], rec.get("category", DEFAULT_CATEGORY)))
            continue
        try:
            other = load_script(sdir / f"{sid}.json")
        except ScriptError:
            continue
        history.append(pick_style(other, history))
    return pick_style(script, history)


def resolve_theme(script, schedule_path: str | Path | None = None, scripts_dir: str | Path | None = None,
                  log_path: str | Path | None = None) -> str:
    return resolve_style(script, schedule_path, scripts_dir, log_path).theme


def middle_layouts(script) -> list[str]:
    """Layouts of the middle scenes (everything between the opening poster and the closing scene)."""
    return [s.layout for s in script.scenes[1:-1]]


def record_style(script, style: Style, path: str | Path | None = None, now: datetime | None = None) -> Path:
    """Write the episode's stage, theme, category and layouts to content/style_log.json (one entry per script)."""
    path = Path(path or STYLE_LOG)
    data = load_style_log(path)
    data["_doc"] = ("Visual style of every produced episode, written by `radar produce` (Remotion engine). "
                    "themes.resolve_style keeps logged stages in the schedule walk; `radar script-check` warns when "
                    "the middle scenes repeat the previous episode's layout sequence.")
    data["episodes"][script.id] = {
        "stage": style.family, "theme": style.theme, "category": style.category,
        "layouts": [s.layout for s in script.scenes], "middle": middle_layouts(script),
        "produced_at": (now or datetime.now(timezone.utc)).isoformat(timespec="seconds"),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return path


def previous_episode(script, schedule_path: str | Path | None = None, log_path: str | Path | None = None
                     ) -> str | None:
    """The episode before `script`: the previous scheduled entry, else the latest logged one (by produced_at)."""
    entries = _scheduled(Path(schedule_path or SCHEDULE))
    ids = [e["script"] for e in entries]
    if script.id in ids:
        k = ids.index(script.id)
        return ids[k - 1] if k else None
    if ids:
        return ids[-1]
    logged = load_style_log(log_path)["episodes"]
    others = sorted(((v.get("produced_at", ""), k) for k, v in logged.items() if k != script.id))
    return others[-1][1] if others else None


def layout_repeat_warning(script, schedule_path: str | Path | None = None, scripts_dir: str | Path | None = None,
                          log_path: str | Path | None = None) -> str | None:
    """A warning when the middle scenes use the same layout sequence as the previous episode (style log first,
    else that episode's script file)."""
    from radar.production.script import ScriptError, load_script

    prev = previous_episode(script, schedule_path, log_path)
    if not prev:
        return None
    rec = load_style_log(log_path)["episodes"].get(prev)
    if rec and "middle" in rec:
        theirs = list(rec["middle"])
    else:
        try:
            theirs = middle_layouts(load_script(Path(scripts_dir or SCRIPTS_DIR) / f"{prev}.json"))
        except ScriptError:
            return None
    mine = middle_layouts(script)
    if mine and mine == theirs:
        return (f"middle scenes repeat the previous episode's layout sequence ({prev}: {' → '.join(theirs)}); "
                "swap in another layout (compare, toggle, flow, dots, chat, sms, timeline, stat...)")
    return None
