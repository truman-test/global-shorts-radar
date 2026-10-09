import json
import re
from pathlib import Path

from radar.production.script import load_script, validate
from radar.production.themes import (ROTATION, THEMES, pick_theme, resolve_theme, rotation_theme,
                                     topic_candidates)

ROOT = Path(__file__).resolve().parents[1]


def _script(name="2026-10-08-family-password"):
    return load_script(ROOT / "content" / "scripts" / f"{name}.json")


def test_python_and_remotion_theme_names_match():
    ts = (ROOT / "video" / "src" / "themes.ts").read_text(encoding="utf-8")
    union = re.search(r"export type ThemeName = ([^;]+);", ts).group(1)
    assert set(re.findall(r'"(\w+)"', union)) == set(THEMES)
    assert set(ROTATION) == set(THEMES) - {"classic"} and len(ROTATION) >= 6


def test_theme_field_loads_and_unknown_names_are_errors(tmp_path):
    data = json.loads((ROOT / "content" / "scripts" / "2026-10-08-family-password.json").read_text(encoding="utf-8-sig"))
    data["theme"] = "aurora"
    path = tmp_path / "s.json"
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    s = load_script(path)
    assert s.theme == "aurora" and not any("theme" in e for e in validate(s)[0])
    s.theme = "neon"
    assert any("unknown theme 'neon'" in e for e in validate(s)[0])
    assert _script().theme == ""


def test_topic_defaults():
    assert pick_theme(_script("2026-10-08-family-password")) == "pulse"            # voice scam
    assert pick_theme(_script("2026-10-09-voice-clone-3-seconds")) == "pulse"
    assert pick_theme(_script("2026-10-08-deepfake-cfo")) == "aurora"              # deepfake video call
    assert pick_theme(_script("2026-10-09-ai-crocodile-hoax")) == "aurora"         # AI image
    assert pick_theme(_script("2026-10-08-zero-click")) == "circuit"               # hacking
    assert pick_theme(_script("2026-10-09-discord-bot-breach")) == "circuit"       # data leak
    assert pick_theme(_script("2026-10-09-kid-password")) == "notebook"            # kids
    assert pick_theme(_script("2026-10-09-kid-tap-payment")) == "notebook"
    assert pick_theme(_script("2026-10-09-deepfake-invest-ad")) == "contour"       # investment
    assert pick_theme(_script("2026-10-09-fake-map-number")) == "scan"             # fake number in search


def test_explicit_theme_wins_and_previous_day_is_avoided():
    s = _script("2026-10-08-zero-click")
    assert pick_theme(s, previous="circuit") == topic_candidates(s)[1] == "scan"
    s.theme = "dots"
    assert pick_theme(s, previous="dots") == "dots"


def test_rotation_is_deterministic_and_skips_previous():
    s = _script()
    s.title, s.tags = "아무 주제 없는 제목", []
    assert topic_candidates(s) == ()
    first = pick_theme(s)
    assert first == pick_theme(s) == rotation_theme(s.id) and first in ROTATION
    assert pick_theme(s, previous=first) != first


def test_scheduled_days_never_repeat_a_theme(tmp_path):
    schedule = json.loads((ROOT / "content" / "schedule.json").read_text(encoding="utf-8"))
    ids = [e["script"] for e in sorted(schedule["entries"], key=lambda e: e["date"])
           if (ROOT / "content" / "scripts" / f"{e['script']}.json").is_file()]
    themes = [resolve_theme(_script(i)) for i in ids]
    assert len(themes) >= 5
    assert all(a != b for a, b in zip(themes, themes[1:])), list(zip(ids, themes))
    assert len(set(themes)) >= 5
    # two hacking stories back to back: the second takes the topic's alternate
    path = tmp_path / "schedule.json"
    path.write_text(json.dumps({"entries": [{"date": "2026-01-01", "script": "2026-10-08-zero-click"},
                                            {"date": "2026-01-02", "script": "2026-10-09-discord-bot-breach"}]}),
                    encoding="utf-8")
    assert resolve_theme(_script("2026-10-09-discord-bot-breach"), schedule_path=path) == "scan"
    # not scheduled: plain topic pick
    assert resolve_theme(_script("2026-10-09-discord-bot-breach"), schedule_path=tmp_path / "none.json") == "circuit"
