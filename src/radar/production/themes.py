"""Stages (family, luminance, visual group, mascot) and topic categories for the Remotion engine.

video/src/tokens.json holds every stage (colours and its spec: family, luminance, mascotDefault, surface); this module
reads the spec from there, so Python and the renderer can never disagree. The brand layer is fixed on every episode
(white note card, captions, 위험/주의/안전 tones, type scale, brand line, disclaimer, continuity transition); what
changes per episode is the stage and the category colour:

- family: "alert" (다크 경보: dark field, 도치 off) or "notebook" (종이 노트: 도치's paper world);
- luminance: "light" or "dark", independent of the family (night-lamp is a dark notebook stage);
- visual group (tokens "surface"): ruled | cards | desk | evidence | blueprint (deferred) | sky;
- category (topic): ai (AI·딥페이크), security (폰 보안·설정), smishing (스미싱·문자), voice (보이스피싱·전화).

Choice, deterministic (no randomness; the same schedule always gives the same stages):
1. the script's own "theme" wins (a warning is reported when it breaks a rule below); its "category" too;
2. category = the topic with the most keyword hits in title + tags (ties: earlier rule);
3. candidates = the category's StageSpec list (CANDIDATES); the feasible ones are those that keep every rule now and
   leave a rule-abiding continuation for the next days (look-ahead over all automatic stages); the pick among them is
   CRC32(script id) mod their count. If none is feasible the category's dark fallbacks and then every automatic stage
   are tried the same way, then the rules without look-ahead, then the first candidate;
4. rules over the schedule, walked in date order:
   - never the same family three days running, where a run is the same family *and* luminance: a dark notebook day
     (night-lamp) breaks a run of light pages. Read strictly (family only), the dark-day cap below leaves no room for
     a dark notebook stage at all: no-three-in-a-row forces an alert (dark) day at least every third day, so every
     day sits in some 7-day window that already has 3 dark days (tests/test_themes.py proves it by brute force);
   - at most 3 dark-luminance days in any 7;
   - the same theme at most once in any 7 days;
   - the same notebook visual group at most twice in any 7 days (the dark 다크 경보 stages share "cards" and are
     kept apart by the family and dark-day rules instead: two "cards" per 7 days cannot coexist with the family rule);
   - two 도치 episodes in a row (with no other 도치 episode between them) never share a theme.
Episodes already recorded in content/style_log.json keep their recorded stage in the walk, except when the script now
sets its own "theme" (an explicit override replaces the logged entry). Old log entries are migrated on load:
stage "paper" -> family "notebook" with 도치 on, "alert" -> 도치 off; luminance and visual group from the theme.
"""
from __future__ import annotations

import json
import zlib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

from radar.config import PROJECT_ROOT

TOKENS_PATH = PROJECT_ROOT / "video" / "src" / "tokens.json"
_TOKENS = json.loads(TOKENS_PATH.read_text(encoding="utf-8"))

# name -> one-line description (the names must match video/src/tokens.json "stages"; tests check it)
THEMES = {
    "pulse": "다크 경보: dark teal, concentric rings slowly expanding with a faint radar sweep",
    "circuit": "다크 경보: neutral charcoal, faint circuit traces with a few signals running along them",
    "scan": "다크 경보: indigo ink, fine diagonal hatching sliding slowly and a soft scan band",
    "aurora": "다크 경보: dark plum, slow aurora ribbons and silk lines",
    "dots": "다크 경보: wine graphite, a fine dot matrix that a slow light wave passes over",
    "paper": "종이 노트: cream ruled notebook page, red margin, punched holes, paper grain",
    "graph": "종이 노트: cream graph-paper page (모눈), paper grain",
    "night-lamp": "종이 노트 (dark): a lamp-lit cream page on a dark brown-navy desk; 도치 with a rim light",
    "kraft-board": "종이 노트: kraft evidence board, pins, twine and one category-colour string, paper scraps",
    "desk-spread": "종이 노트: an open notebook spread on a slate desk in 2.5D, clip, tabs and a pen",
    "mood-sky": "종이 노트: a paper-cut sky over the page; night/rain for danger, clouds, day for safe and the end",
    "contour": "on hold (explicit only): deep forest ink, topographic contour lines",
    "notebook": "on hold (explicit only): the old dark ruled notebook (superseded by the notebook family)",
    "classic": "re-renders only: the original navy with a drifting square grid",
}
FAMILIES = {f: tuple(v["auto"]) for f, v in _TOKENS["families"].items()}
FAMILY_LABELS = {f: v["label"] for f, v in _TOKENS["families"].items()}
VISUAL_GROUPS = tuple(k for k in _TOKENS["surfaces"] if not k.startswith("_"))
ROTATION = tuple(t for ts in FAMILIES.values() for t in ts)   # every automatically picked stage

CATEGORIES = {"ai": "AI·딥페이크", "security": "폰 보안·설정", "smishing": "스미싱·문자", "voice": "보이스피싱·전화"}


@dataclass(frozen=True)
class StageSpec:
    theme: str
    family: str          # alert | notebook
    luminance: str       # light | dark
    mascot: bool         # 도치 on by default
    visual_group: str    # ruled | cards | desk | evidence | blueprint | sky


STAGES = {name: StageSpec(name, s["family"], s["luminance"], bool(s["mascotDefault"]), s["surface"])
          for name, s in _TOKENS["stages"].items()}
FAMILY_OF = {name: s.family for name, s in STAGES.items()}

# category -> stage candidates in order (blueprint, the AI stage, is deferred)
CANDIDATES = {
    "ai": ("night-lamp", "mood-sky", "aurora", "scan"),
    "security": ("desk-spread", "paper", "graph"),
    "smishing": ("kraft-board", "paper", "scan", "dots"),
    "voice": ("night-lamp", "kraft-board", "mood-sky", "pulse", "dots"),
}

# (category, default family, dark fallbacks, keywords) — most distinct hits in title + tags wins
TOPICS = (
    ("voice", "alert", ("pulse", "dots"), ("보이스피싱", "딥보이스", "목소리", "음성", "전화", "통화", "고객센터", "번호")),
    ("ai", "alert", ("aurora", "scan"), ("딥페이크", "AI 이미지", "AI 사진", "가짜 사진", "조작 사진", "사진", "영상",
                                         "가짜뉴스", "합성")),
    ("security", "alert", ("circuit", "scan"), ("해킹", "유출", "스파이웨어", "악성", "랜섬", "제로클릭", "계정",
                                                "개인정보", "보안", "업데이트", "비밀번호", "인증", "결제", "설정",
                                                "자녀", "아이")),
    ("smishing", "notebook", ("scan", "dots"), ("피싱", "스미싱", "문자", "링크", "택배", "큐알", "QR", "광고")),
)
DEFAULT_CATEGORY = "security"
# how-to / settings / checklist-led topics read best on a notebook stage (설정법, 대응 절차)
PAPER_WORDS = ("설정", "켜세요", "켜기", "비밀번호", "자녀", "부모", "체크리스트", "방법")

MAX_RUN = 2            # never the same family (and luminance) three days running
MAX_DARK_IN_7 = 3      # dark-luminance days in any 7
MAX_THEME_IN_7 = 1     # the same theme at most once in any 7 days
MAX_GROUP_IN_7 = 2     # the same notebook visual group at most twice in any 7 days
WINDOW = 7
LOOKAHEAD = 6

SCHEDULE = PROJECT_ROOT / "content" / "schedule.json"
SCRIPTS_DIR = PROJECT_ROOT / "content" / "scripts"
STYLE_LOG = PROJECT_ROOT / "content" / "style_log.json"


@dataclass(frozen=True)
class Style:
    """One episode's stage. Equality is (family, theme, category); the rest is derived from the theme's spec (the
    mascot flag may also come from the script's per-scene overrides or the style log)."""
    family: str
    theme: str
    category: str
    luminance: str = field(default="", compare=False)
    mascot: bool | None = field(default=None, compare=False)
    visual_group: str = field(default="", compare=False)

    def __post_init__(self):
        spec = STAGES.get(self.theme)
        if not self.luminance:
            object.__setattr__(self, "luminance", spec.luminance if spec else
                               ("light" if self.family == "notebook" else "dark"))
        if self.mascot is None:
            object.__setattr__(self, "mascot", spec.mascot if spec else self.family == "notebook")
        if not self.visual_group:
            object.__setattr__(self, "visual_group", spec.visual_group if spec else "cards")


def style_of(theme: str, category: str, mascot: bool | None = None) -> Style:
    return Style(FAMILY_OF.get(theme, "alert"), theme, category, mascot=mascot)


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
    """The family the topic leans to (informational: the candidates decide; how-to topics lean to notebook)."""
    if getattr(script, "theme", ""):
        return FAMILY_OF.get(script.theme, "alert")
    if any(w in _text(script) for w in PAPER_WORDS):
        return "notebook"
    cat = topic_category(script)
    return next(f for c, f, _t, _w in TOPICS if c == cat)


def script_mascot(script, theme: str) -> bool:
    """Is 도치 in this episode at all? Per-scene `mascot` overrides, else the stage's default."""
    default = STAGES[theme].mascot if theme in STAGES else False
    return any((sc.mascot if isinstance(getattr(sc, "mascot", None), bool) else default) for sc in script.scenes)


# ------------------------------------------------------------------ rules

def violations(history: list[Style], new: Style) -> list[str]:
    """The rules `new` would break after `history` (oldest first). Empty = allowed."""
    seq = history + [new]
    out = []
    if len(seq) > MAX_RUN and len({(s.family, s.luminance) for s in seq[-(MAX_RUN + 1):]}) == 1:
        out.append(f"third {new.luminance} {FAMILY_LABELS.get(new.family, new.family)} day in a row")
    win = seq[-WINDOW:]
    if sum(s.luminance == "dark" for s in win) > MAX_DARK_IN_7:
        out.append(f"more than {MAX_DARK_IN_7} dark days in 7")
    if sum(s.theme == new.theme for s in win) > MAX_THEME_IN_7:
        out.append(f"'{new.theme}' used again within 7 days")
    if new.family == "notebook" and sum(s.family == "notebook" and s.visual_group == new.visual_group
                                        for s in win) > MAX_GROUP_IN_7:
        out.append(f"visual group '{new.visual_group}' more than {MAX_GROUP_IN_7} times in 7 days")
    if new.mascot:
        prev = next((s for s in reversed(history) if s.mascot), None)
        if prev is not None and prev.theme == new.theme:
            out.append(f"the previous 도치 episode was on '{new.theme}' too")
    return out


def _allowed(history: list[Style], new: Style) -> bool:
    return not violations(history, new)


_AUTO = tuple(style_of(t, "") for t in ROTATION)


@lru_cache(maxsize=200_000)
def _feasible_key(key: tuple, depth: int) -> bool:
    if depth == 0:
        return True
    hist = [Style(f, t, "", luminance=l, mascot=m, visual_group=g) for f, t, l, m, g in key]
    for s in _AUTO:
        if _allowed(hist, s):
            # the window the rules look at (the 도치 adjacency check is approximate beyond it: another theme is
            # always available, so the look-ahead can treat it as free)
            nxt = (key + ((s.family, s.theme, s.luminance, s.mascot, s.visual_group),))[-(WINDOW - 1):]
            if _feasible_key(nxt, depth - 1):
                return True
    return False


def feasible(history: list[Style], depth: int = LOOKAHEAD) -> bool:
    """Can the schedule continue for `depth` more days without breaking a rule (over all automatic stages)?"""
    key = tuple((s.family, s.theme, s.luminance, bool(s.mascot), s.visual_group) for s in history[-(WINDOW - 1):])
    return _feasible_key(key, depth)


def choose_family(history: list[str], preferred: str) -> str:
    """Family-only helper (kept for the family rule tests): the preferred family if allowed now and later."""
    fams = list(FAMILIES)

    def ok(seq):
        return not (len(seq) > MAX_RUN and len(set(seq[-(MAX_RUN + 1):])) == 1)

    def later(seq, d=LOOKAHEAD):
        return d == 0 or any(ok(seq + [f]) and later(seq + [f], d - 1) for f in fams)

    for fam in (preferred, *(f for f in fams if f != preferred)):
        if ok(history + [fam]) and later(history + [fam]):
            return fam
    return preferred


def _crc(script_id: str) -> int:
    return zlib.crc32(script_id.encode("utf-8"))


def rotation_theme(script_id: str, family: str, avoid: str | None = None) -> str:
    """Deterministic pick from a family's automatic stages by script id, skipping `avoid`."""
    themes = FAMILIES[family]
    k = _crc(script_id) % len(themes)
    pick = themes[k]
    return themes[(k + 1) % len(themes)] if pick == avoid else pick


def candidates(category: str) -> list[StageSpec]:
    return [STAGES[t] for t in CANDIDATES.get(category, CANDIDATES[DEFAULT_CATEGORY])]


def pick_style(script, history: list[Style] | None = None) -> Style:
    """Stage + category for `script` given the earlier episodes (oldest first)."""
    return pick_style_report(script, history)[0]


def pick_style_report(script, history: list[Style] | None = None) -> tuple[Style, list[str]]:
    """(style, warnings): warnings list the rules an explicit script theme breaks."""
    history = history or []
    category = topic_category(script)
    own = getattr(script, "theme", "")
    if own:
        style = style_of(own, category, script_mascot(script, own) if own in STAGES else None)
        return style, [f"theme '{own}' (set in the script) breaks a stage rule: {v}" for v in violations(history, style)]
    k = _crc(script.id)
    primary = [s.theme for s in candidates(category)]
    dark = next((t for c, _f, t, _w in TOPICS if c == category), ())
    tiers = [primary, [t for t in (*dark, *ROTATION) if t not in primary]]

    def as_style(t: str) -> Style:
        return style_of(t, category, script_mascot(script, t))

    for tier in tiers:
        ok = [t for t in tier if _allowed(history, as_style(t)) and feasible(history + [as_style(t)])]
        if ok:
            return as_style(ok[k % len(ok)]), []
    for tier in tiers:
        ok = [t for t in tier if _allowed(history, as_style(t))]
        if ok:
            return as_style(ok[k % len(ok)]), []
    style = as_style(primary[k % len(primary)])
    return style, [f"no stage keeps every rule; using '{style.theme}': {v}" for v in violations(history, style)]


# ------------------------------------------------------------------ style log

def migrate_entry(rec: dict) -> dict:
    """An old log entry in the current shape: family "notebook" for "paper", luminance / mascot / visual group."""
    rec = dict(rec)
    stage = rec.get("stage", "")
    theme = rec.get("theme", "")
    spec = STAGES.get(theme)
    if stage == "paper":
        rec["stage"] = "notebook"
    elif not stage:
        rec["stage"] = spec.family if spec else "alert"
    if "mascot" not in rec:   # logged before 도치 was recorded: it was on exactly on the paper stages
        rec["mascot"] = stage == "paper" if stage in ("paper", "alert") else bool(spec and spec.mascot)
    if "luminance" not in rec:
        rec["luminance"] = spec.luminance if spec else ("light" if rec["stage"] == "notebook" else "dark")
    if "visual_group" not in rec:
        rec["visual_group"] = spec.visual_group if spec else "cards"
    return rec


def load_style_log(path: str | Path | None = None) -> dict:
    try:
        data = json.loads(Path(path or STYLE_LOG).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"episodes": {}}
    data["episodes"] = {k: migrate_entry(v) for k, v in data.get("episodes", {}).items()}
    return data


def logged_style(rec: dict) -> Style:
    return Style(FAMILY_OF.get(rec["theme"], rec.get("stage", "alert")), rec["theme"],
                 rec.get("category", DEFAULT_CATEGORY), luminance=rec.get("luminance", ""),
                 mascot=rec.get("mascot"), visual_group=rec.get("visual_group", ""))


def _scheduled(schedule_path: Path) -> list[dict]:
    try:
        entries = json.loads(schedule_path.read_text(encoding="utf-8")).get("entries", [])
    except (OSError, ValueError):
        entries = []
    return sorted((e for e in entries if e.get("script")), key=lambda e: str(e.get("date", "")))


def resolve_schedule(schedule_path: str | Path | None = None, scripts_dir: str | Path | None = None,
                     log_path: str | Path | None = None, extra=None) -> list[tuple[str, Style, list[str], str]]:
    """The whole schedule walked in date order: [(script id, style, warnings, source)], source = "log" (kept as
    logged), "script" (explicit theme) or "auto". `extra`: a script that is not scheduled, placed at the end."""
    from radar.production.script import ScriptError, load_script

    sdir = Path(scripts_dir or SCRIPTS_DIR)
    logged = load_style_log(log_path)["episodes"]
    history: list[Style] = []
    out = []
    ids = [e["script"] for e in _scheduled(Path(schedule_path or SCHEDULE))]
    for sid in ids:
        script = extra if extra is not None and extra.id == sid else None
        if script is None:
            try:
                script = load_script(sdir / f"{sid}.json")
            except ScriptError:
                script = None
        rec = logged.get(sid)
        own = getattr(script, "theme", "") if script is not None else ""
        if rec and rec.get("theme") in THEMES and not (own and own != rec["theme"]):
            style, warnings, source = logged_style(rec), [], "log"
        elif script is not None:
            style, warnings = pick_style_report(script, history)
            source = "script" if own else "auto"
        else:
            continue
        out.append((sid, style, warnings, source))
        history.append(style)
    if extra is not None and extra.id not in ids:
        style, warnings = pick_style_report(extra, history)
        out.append((extra.id, style, warnings, "script" if getattr(extra, "theme", "") else "auto"))
    return out


def resolve_style_report(script, schedule_path: str | Path | None = None, scripts_dir: str | Path | None = None,
                         log_path: str | Path | None = None) -> tuple[Style, list[str]]:
    walk = resolve_schedule(schedule_path, scripts_dir, log_path, extra=script)
    for sid, style, warnings, _src in walk:
        if sid == script.id:
            return style, warnings
    return pick_style_report(script, [s for _i, s, _w, _src in walk])


def resolve_style(script, schedule_path: str | Path | None = None, scripts_dir: str | Path | None = None,
                  log_path: str | Path | None = None) -> Style:
    """pick_style with the schedule walked in date order as history (logged episodes keep their logged stage unless
    the script now sets its own theme). A script that is not scheduled is placed after the whole schedule."""
    return resolve_style_report(script, schedule_path, scripts_dir, log_path)[0]


def resolve_theme(script, schedule_path: str | Path | None = None, scripts_dir: str | Path | None = None,
                  log_path: str | Path | None = None) -> str:
    return resolve_style(script, schedule_path, scripts_dir, log_path).theme


def middle_layouts(script) -> list[str]:
    """Layouts of the middle scenes (everything between the opening poster and the closing scene)."""
    return [s.layout for s in script.scenes[1:-1]]


def record_style(script, style: Style, path: str | Path | None = None, now: datetime | None = None) -> Path:
    """Write the episode's stage (family), theme, category, luminance, 도치, visual group and layouts to
    content/style_log.json (one entry per script; old entries are migrated on the way)."""
    path = Path(path or STYLE_LOG)
    data = load_style_log(path)
    data["_doc"] = ("Visual style of every produced episode, written by `radar produce` (Remotion engine). "
                    "stage = family (alert | notebook), luminance (light | dark), mascot (도치 on), visual_group "
                    "(ruled | cards | desk | evidence | blueprint | sky). themes.resolve_style keeps logged stages in "
                    "the schedule walk (a script's own theme replaces its entry); `radar script-check` warns when "
                    "the middle scenes repeat the previous episode's layout sequence.")
    data["episodes"][script.id] = {
        "stage": style.family, "theme": style.theme, "category": style.category,
        "luminance": style.luminance, "mascot": bool(style.mascot), "visual_group": style.visual_group,
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
