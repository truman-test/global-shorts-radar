import json
import re
from pathlib import Path

from radar.production.script import load_script, validate
from radar.production.themes import (CATEGORIES, FAMILIES, FAMILY_OF, ROTATION, THEMES, Style, choose_family,
                                     layout_repeat_warning, load_style_log, pick_style, preferred_family,
                                     record_style, resolve_style, resolve_theme, rotation_theme, topic_category)

ROOT = Path(__file__).resolve().parents[1]


def _script(name="2026-10-08-family-password"):
    return load_script(ROOT / "content" / "scripts" / f"{name}.json")


def _no_log(tmp_path):
    return tmp_path / "no_log.json"


def test_python_and_remotion_theme_names_match():
    ts = (ROOT / "video" / "src" / "themes.ts").read_text(encoding="utf-8")
    union = re.search(r"export type ThemeName = ([^;]+);", ts).group(1)
    assert set(re.findall(r'"(\w+)"', union)) == set(THEMES)
    cats = re.search(r"export type CategoryName = ([^;]+);", ts).group(1)
    assert set(re.findall(r'"(\w+)"', cats)) == set(CATEGORIES)
    assert set(ROTATION) == set(FAMILIES["alert"]) | set(FAMILIES["paper"])
    # contour (on hold), notebook (superseded by paper) and classic are never picked automatically
    assert not {"contour", "notebook", "classic"} & set(ROTATION)


def test_theme_and_category_fields_load_and_unknown_names_are_errors(tmp_path):
    data = json.loads((ROOT / "content" / "scripts" / "2026-10-08-family-password.json").read_text(encoding="utf-8-sig"))
    data["theme"] = "paper"
    data["category"] = "smishing"
    path = tmp_path / "s.json"
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    s = load_script(path)
    assert (s.theme, s.category) == ("paper", "smishing") and validate(s)[0] == []
    s.theme, s.category = "neon", "crypto"
    errs = validate(s)[0]
    assert any("unknown theme 'neon'" in e for e in errs) and any("unknown category 'crypto'" in e for e in errs)
    assert _script().theme == "" and _script().category == ""


def test_topic_categories():
    assert topic_category(_script("2026-10-08-family-password")) == "voice"
    assert topic_category(_script("2026-10-09-voice-clone-3-seconds")) == "voice"
    assert topic_category(_script("2026-10-09-fake-map-number")) == "voice"
    assert topic_category(_script("2026-10-08-deepfake-cfo")) == "ai"
    assert topic_category(_script("2026-10-09-ai-crocodile-hoax")) == "ai"
    assert topic_category(_script("2026-10-09-deepfake-invest-ad")) == "ai"
    assert topic_category(_script("2026-10-09-airbnb-fake-damage-photo")) == "ai"
    assert topic_category(_script("2026-10-08-zero-click")) == "security"
    assert topic_category(_script("2026-10-09-discord-bot-breach")) == "security"
    assert topic_category(_script("2026-10-09-kid-tap-payment")) == "security"
    assert topic_category(_script("2026-10-09-kid-password")) == "security"


def test_how_to_topics_prefer_paper_and_urgent_ones_dark():
    assert preferred_family(_script("2026-10-09-kid-tap-payment")) == "paper"     # 설정 / 자녀 / 부모
    assert preferred_family(_script("2026-10-09-kid-password")) == "paper"
    assert preferred_family(_script("2026-10-08-deepfake-cfo")) == "alert"
    assert preferred_family(_script("2026-10-08-zero-click")) == "alert"
    s = _script("2026-10-09-kid-tap-payment")
    s.theme = "circuit"
    assert preferred_family(s) == "alert" and pick_style(s, [Style("alert", "circuit", "security")] * 2).theme == "circuit"


def test_family_rules():
    # never three of a kind in a row
    assert choose_family(["alert", "alert"], "alert") == "paper"
    assert choose_family(["paper", "paper"], "paper") == "alert"
    # at most 3 dark days in any 7
    assert choose_family(["alert", "paper", "alert", "paper", "alert", "paper"], "alert") == "paper"
    # look-ahead: dark now would force three paper days later
    assert choose_family(["alert", "alert", "paper"], "alert") == "paper"


def _check_sequence(fams):
    for i in range(len(fams)):
        assert not (i >= 2 and fams[i] == fams[i - 1] == fams[i - 2]), fams
        assert fams[max(0, i - 6):i + 1].count("alert") <= 3, fams


def test_scheduled_days_follow_the_stage_rules(tmp_path):
    schedule = json.loads((ROOT / "content" / "schedule.json").read_text(encoding="utf-8"))
    ids = [e["script"] for e in sorted(schedule["entries"], key=lambda e: e["date"])
           if (ROOT / "content" / "scripts" / f"{e['script']}.json").is_file()]
    styles = [resolve_style(_script(i), log_path=_no_log(tmp_path)) for i in ids]
    assert len(styles) >= 7
    _check_sequence([s.family for s in styles])
    assert sum(s.family == "paper" for s in styles[:7]) >= 2
    # the same dark theme is never used on two dark days in a row, paper alternates its two pages
    dark = [s.theme for s in styles if s.family == "alert"]
    paper = [s.theme for s in styles if s.family == "paper"]
    assert all(a != b for a, b in zip(dark, dark[1:])) and all(a != b for a, b in zip(paper, paper[1:]))
    assert all(FAMILY_OF[s.theme] == s.family for s in styles)
    # deterministic
    assert styles == [resolve_style(_script(i), log_path=_no_log(tmp_path)) for i in ids]


def test_synthetic_month_never_breaks_the_rules():
    history: list[Style] = []
    pref = ["alert", "alert", "alert", "paper", "alert", "alert", "paper", "alert"] * 4
    for k, p in enumerate(pref):
        fam = choose_family([h.family for h in history], p)
        history.append(Style(fam, FAMILIES[fam][0], "ai"))
    _check_sequence([h.family for h in history])


def test_unscheduled_script_and_rotation(tmp_path):
    s = _script("2026-10-09-discord-bot-breach")
    alone = resolve_style(s, schedule_path=tmp_path / "none.json", log_path=_no_log(tmp_path))
    assert alone == Style("alert", "circuit", "security")
    assert rotation_theme("x", "paper") in FAMILIES["paper"]
    assert rotation_theme("x", "paper", avoid=rotation_theme("x", "paper")) != rotation_theme("x", "paper")
    assert resolve_theme(s, schedule_path=tmp_path / "none.json", log_path=_no_log(tmp_path)) == "circuit"


def test_style_log_records_and_overrides_history(tmp_path):
    log = tmp_path / "style_log.json"
    sched = tmp_path / "schedule.json"
    sched.write_text(json.dumps({"entries": [{"date": "2026-01-01", "script": "2026-10-08-deepfake-cfo"},
                                             {"date": "2026-01-02", "script": "2026-10-08-zero-click"},
                                             {"date": "2026-01-03", "script": "2026-10-09-discord-bot-breach"}]}),
                     encoding="utf-8")
    cfo = _script("2026-10-08-deepfake-cfo")
    record_style(cfo, Style("paper", "graph", "ai"), path=log)
    rec = load_style_log(log)["episodes"]["2026-10-08-deepfake-cfo"]
    assert rec["stage"] == "paper" and rec["theme"] == "graph" and rec["layouts"][0] == "call"
    assert rec["middle"] == [s.layout for s in cfo.scenes[1:-1]]
    # the logged stage (paper) is history now: zero-click (dark preferred) stays dark, discord too (no 3-run)
    z = resolve_style(_script("2026-10-08-zero-click"), schedule_path=sched, log_path=log)
    assert z.family == "alert"


def test_layout_repeat_warning(tmp_path):
    log = tmp_path / "style_log.json"
    sched = tmp_path / "schedule.json"
    sched.write_text(json.dumps({"entries": [{"date": "2026-01-01", "script": "2026-10-08-deepfake-cfo"},
                                             {"date": "2026-01-02", "script": "2026-10-08-zero-click"}]}),
                     encoding="utf-8")
    zero = _script("2026-10-08-zero-click")
    # both are card-card-card in the middle -> warning (from the previous script file)
    assert "repeat" in layout_repeat_warning(zero, schedule_path=sched, log_path=log)
    # the log wins over the script file
    record_style(_script("2026-10-08-deepfake-cfo"), Style("alert", "aurora", "ai"), path=log)
    data = json.loads(log.read_text(encoding="utf-8"))
    data["episodes"]["2026-10-08-deepfake-cfo"]["middle"] = ["compare", "toggle", "flow"]
    log.write_text(json.dumps(data), encoding="utf-8")
    assert layout_repeat_warning(zero, schedule_path=sched, log_path=log) is None
    # first episode: nothing to compare with
    assert layout_repeat_warning(_script("2026-10-08-deepfake-cfo"), schedule_path=sched, log_path=log) is None
