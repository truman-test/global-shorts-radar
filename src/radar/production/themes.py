"""Visual themes for the Remotion engine (video/src/themes.ts draws them).

Every video gets its own look (background pattern, base colours, accent palette, headline treatment, icon-chip
shape) so a run of daily Shorts never reads as one template. The brand stays fixed: channel name + "AI 음성"
badge, Pretendard, caption style, disclaimer, layouts and the continuity transition.

Choice, in order:
1. the script's own "theme" field;
2. the topic (keywords in title + tags) -> a preferred theme and an alternate;
3. otherwise a deterministic rotation by script id.
When the script is in content/schedule.json, the previous day's theme is avoided (topic alternate, then the
rotation), so consecutive uploads always look different.
"""
from __future__ import annotations

import json
import zlib
from pathlib import Path

from radar.config import PROJECT_ROOT

# name -> one-line description (keep in sync with video/src/themes.ts)
THEMES = {
    "pulse": "dark teal, concentric rings slowly expanding with a faint radar sweep",
    "circuit": "neutral charcoal, faint circuit traces with a few signals running along them",
    "scan": "indigo ink, fine diagonal hatching sliding slowly and a soft scan band",
    "aurora": "dark plum, slow aurora ribbons and silk lines",
    "contour": "deep forest ink, topographic contour lines drifting slowly",
    "notebook": "warm near-black, faint ruled notebook lines and paper grain",
    "dots": "wine graphite, a fine dot matrix that a slow light wave passes over",
    "classic": "the original navy with a drifting square grid (re-renders only, never picked automatically)",
}
ROTATION = ("pulse", "circuit", "scan", "aurora", "contour", "notebook", "dots")

# (topic, (preferred, alternate), keywords) — the topic with the most distinct keywords found in title + tags
# wins, ties go to the earlier rule.
TOPICS = (
    ("voice/call scam", ("pulse", "dots"), ("보이스피싱", "딥보이스", "목소리", "음성", "전화", "통화", "보이스")),
    ("ai image/deepfake", ("aurora", "scan"), ("딥페이크", "AI 이미지", "AI 사진", "가짜 사진", "조작 사진", "사진",
                                               "영상", "가짜뉴스", "합성")),
    ("hacking/data leak", ("circuit", "scan"), ("해킹", "유출", "스파이웨어", "악성", "랜섬", "제로클릭", "계정 정보",
                                               "개인정보", "봇", "보안 업데이트")),
    ("kids/family", ("notebook", "dots"), ("자녀", "아이 ", "아이가", "아이의", "부모", "가족", "미성년", "어린이",
                                           "청소년", "학생")),
    ("investment/money", ("contour", "notebook"), ("투자", "주식", "코인", "리딩방", "수익", "송금", "대출", "환불",
                                                  "결제", "금융", "억 원")),
    ("phishing/link/search", ("scan", "dots"), ("피싱", "스미싱", "문자", "링크", "고객센터", "검색", "광고", "택배",
                                               "지도", "큐알", "QR")),
)

SCHEDULE = PROJECT_ROOT / "content" / "schedule.json"
SCRIPTS_DIR = PROJECT_ROOT / "content" / "scripts"


def topic_candidates(script) -> tuple[str, ...]:
    """(preferred, alternate) themes for the script's topic, or () when no topic keyword matches."""
    text = " ".join([script.title, *script.tags])
    best, best_hits = (), 0
    for _topic, themes, words in TOPICS:
        hits = sum(1 for w in words if w in text)
        if hits > best_hits:
            best, best_hits = themes, hits
    return best


def rotation_theme(script_id: str, avoid: str | None = None) -> str:
    """Deterministic pick from ROTATION by script id, skipping `avoid`."""
    k = zlib.crc32(script_id.encode("utf-8")) % len(ROTATION)
    pick = ROTATION[k]
    return ROTATION[(k + 1) % len(ROTATION)] if pick == avoid else pick


def pick_theme(script, previous: str | None = None) -> str:
    """The script's theme: explicit field, else topic (avoiding `previous`), else rotation (avoiding `previous`)."""
    if getattr(script, "theme", ""):
        return script.theme
    for name in topic_candidates(script):
        if name != previous:
            return name
    return rotation_theme(script.id, avoid=previous)


def resolve_theme(script, schedule_path: str | Path | None = None, scripts_dir: str | Path | None = None) -> str:
    """pick_theme with the previous scheduled upload's theme avoided (walks the schedule in date order)."""
    if getattr(script, "theme", ""):
        return script.theme
    from radar.production.script import ScriptError, load_script

    path = Path(schedule_path or SCHEDULE)
    sdir = Path(scripts_dir or SCRIPTS_DIR)
    try:
        entries = json.loads(path.read_text(encoding="utf-8")).get("entries", [])
    except (OSError, ValueError):
        entries = []
    entries = sorted((e for e in entries if e.get("script")), key=lambda e: str(e.get("date", "")))
    previous = None
    for entry in entries:
        if entry["script"] == script.id:
            return pick_theme(script, previous)
        try:
            other = load_script(sdir / f"{entry['script']}.json")
        except ScriptError:
            previous = None
            continue
        previous = pick_theme(other, previous)
    return pick_theme(script, None)
