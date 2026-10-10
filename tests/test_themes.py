import json
import re
from datetime import datetime, timezone
from pathlib import Path

import pytest

from radar.production.script import load_script, validate
from radar.production.themes import (CANDIDATES, CATEGORIES, FAMILIES, FAMILY_OF, MAX_DARK_IN_7, MAX_GROUP_IN_7,
                                     ROTATION, STAGES, THEMES, Style, choose_family, layout_repeat_warning,
                                     load_style_log, migrate_entry, pick_style, pick_style_report, preferred_family,
                                     record_style, resolve_schedule, resolve_style, resolve_style_report,
                                     resolve_theme, rotation_theme, style_of, topic_category, violations)

ROOT = Path(__file__).resolve().parents[1]


def _script(name="2026-10-08-family-password"):
    return load_script(ROOT / "content" / "scripts" / f"{name}.json")


def _no_log(tmp_path):
    return tmp_path / "no_log.json"


def check_rules(styles: list[Style]):
    """Every rule of radar.production.themes over a finished sequence (oldest first)."""
    for i, s in enumerate(styles):
        if i >= 2:
            run = styles[i - 2:i + 1]
            assert len({(x.family, x.luminance) for x in run}) > 1, ("3-day family rule", i, run)
        win = styles[max(0, i - 6):i + 1]
        assert sum(x.luminance == "dark" for x in win) <= MAX_DARK_IN_7, ("dark days", i)
        assert sum(x.theme == s.theme for x in win) == 1, ("theme twice in 7", i, s.theme)
        if s.family == "notebook":
            assert sum(x.family == "notebook" and x.visual_group == s.visual_group for x in win) <= MAX_GROUP_IN_7, (
                "visual group", i, s.visual_group)
    dochi = [s for s in styles if s.mascot]
    assert all(a.theme != b.theme for a, b in zip(dochi, dochi[1:])), "adjacent 도치 episodes share a theme"


def test_python_and_remotion_theme_names_match():
    ts = (ROOT / "video" / "src" / "themes.ts").read_text(encoding="utf-8")
    names = re.search(r"export const THEME_NAMES = \[([^\]]+)\]", ts).group(1)
    assert set(re.findall(r'"([\w-]+)"', names)) == set(THEMES)
    cats = re.search(r"export type CategoryName = ([^;]+);", ts).group(1)
    assert set(re.findall(r'"(\w+)"', cats)) == set(CATEGORIES)
    assert set(ROTATION) == set(FAMILIES["alert"]) | set(FAMILIES["notebook"])
    # contour (on hold), notebook (the old dark page) and classic are never picked automatically
    assert not {"contour", "notebook", "classic"} & set(ROTATION)
    assert {"night-lamp", "kraft-board", "desk-spread", "mood-sky"} <= set(FAMILIES["notebook"])


def test_candidates_per_category():
    assert CANDIDATES["ai"] == ("night-lamp", "mood-sky", "aurora", "scan")      # blueprint is deferred
    assert CANDIDATES["security"] == ("desk-spread", "paper", "graph")
    assert CANDIDATES["smishing"] == ("kraft-board", "paper", "scan", "dots")
    assert CANDIDATES["voice"] == ("night-lamp", "kraft-board", "mood-sky", "pulse", "dots")
    assert all(t in STAGES for ts in CANDIDATES.values() for t in ts)


def test_stage_specs():
    assert (STAGES["night-lamp"].family, STAGES["night-lamp"].luminance, STAGES["night-lamp"].mascot) == (
        "notebook", "dark", True)
    assert STAGES["pulse"].mascot is False and STAGES["paper"].mascot is True
    assert STAGES["kraft-board"].visual_group == "evidence" and STAGES["mood-sky"].visual_group == "sky"
    assert STAGES["desk-spread"].visual_group == STAGES["night-lamp"].visual_group == "desk"
    s = style_of("night-lamp", "ai")
    assert (s.luminance, s.mascot, s.visual_group) == ("dark", True, "desk")


def test_theme_and_category_fields_load_and_unknown_names_are_errors(tmp_path):
    data = json.loads((ROOT / "content" / "scripts" / "2026-10-08-family-password.json").read_text(encoding="utf-8-sig"))
    data["theme"] = "kraft-board"
    data["category"] = "smishing"
    path = tmp_path / "s.json"
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    s = load_script(path)
    assert (s.theme, s.category) == ("kraft-board", "smishing") and validate(s)[0] == []
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


def test_explicit_theme_wins_and_warns_when_it_breaks_a_rule():
    s = _script("2026-10-09-kid-tap-payment")
    assert preferred_family(s) == "notebook"                       # 설정 / 자녀 / 부모
    assert preferred_family(_script("2026-10-08-zero-click")) == "alert"
    s.theme = "circuit"
    assert preferred_family(s) == "alert"
    history = [style_of("circuit", "security")] * 2
    style, warnings = pick_style_report(s, history)
    assert style.theme == "circuit" and warnings and any("in a row" in w for w in warnings)
    assert pick_style(s, history).theme == "circuit"
    assert pick_style_report(s, [])[1] == []


def test_family_rules():
    # never three of a kind in a row (family-only helper)
    assert choose_family(["alert", "alert"], "alert") == "notebook"
    assert choose_family(["notebook", "notebook"], "notebook") == "alert"
    # the full rule set
    paper, graph = style_of("paper", "security"), style_of("graph", "security")
    assert violations([paper, graph], style_of("desk-spread", "security"))           # third light notebook day
    assert not violations([paper, graph], style_of("night-lamp", "ai"))             # a dark notebook day breaks it
    assert violations([style_of("pulse", "voice"), style_of("dots", "voice")], style_of("scan", "ai"))
    dark = [style_of("pulse", "voice"), paper, style_of("night-lamp", "ai"), graph, style_of("aurora", "ai"),
            style_of("kraft-board", "voice")]
    assert any("dark days" in v for v in violations(dark, style_of("scan", "ai")))   # a 4th dark day in 7
    assert any("within 7 days" in v for v in violations([paper], style_of("paper", "smishing")))
    ruled = [paper, style_of("pulse", "voice"), graph, style_of("mood-sky", "ai")]
    group = violations(ruled + [style_of("dots", "voice")], style_of("paper", "security"))
    assert any("visual group 'ruled'" in v for v in group)
    # 도치 adjacency: the previous 도치 episode (alert ones in between do not count)
    long_ago = [style_of("kraft-board", "voice")] + [style_of(t, "ai") for t in ("pulse", "circuit", "scan",
                                                                              "aurora", "dots", "pulse", "scan")]
    assert any("previous 도치" in v for v in violations(long_ago, style_of("kraft-board", "voice")))


def test_scheduled_days_follow_the_stage_rules(tmp_path):
    """Dry run with no style log: every scheduled day is picked by the rules (the deepfake-cfo script sets its own
    theme, night-lamp) and the whole sequence keeps every rule."""
    walk = resolve_schedule(log_path=_no_log(tmp_path))
    styles = [s for _sid, s, _w, _src in walk]
    assert len(styles) >= 10
    assert all(not w for _sid, _s, w, _src in walk), [w for *_x, w, _src in walk if w]
    check_rules(styles)
    assert all(FAMILY_OF[s.theme] == s.family for s in styles)
    assert {s.theme for s in styles} & {"kraft-board", "desk-spread", "mood-sky"}
    assert dict((sid, s.theme) for sid, s, _w, _src in walk)["2026-10-08-deepfake-cfo"] == "night-lamp"
    # deterministic
    assert walk == resolve_schedule(log_path=_no_log(tmp_path))


def test_synthetic_months_never_break_the_rules():
    """60 days of rotating topics, several orders: every rule holds and every new notebook stage shows up."""
    class S:
        def __init__(self, i, cat):
            self.id, self.title, self.tags, self.scenes, self.theme, self.category = f"day-{i:03d}", "", [], [], "", cat

    seen = set()
    for order in (("ai", "voice", "security", "smishing"), ("security", "security", "voice", "ai", "smishing"),
                  ("voice", "ai", "ai", "security")):
        history: list[Style] = []
        for i in range(60):
            history.append(pick_style_report(S(i, order[i % len(order)]), history)[0])
        check_rules(history)
        seen |= {s.theme for s in history}
    assert {"night-lamp", "kraft-board", "desk-spread", "mood-sky"} <= seen


def test_unscheduled_script_and_rotation(tmp_path):
    s = _script("2026-10-09-discord-bot-breach")
    alone = resolve_style(s, schedule_path=tmp_path / "none.json", log_path=_no_log(tmp_path))
    assert alone.theme in CANDIDATES["security"] and alone.category == "security"
    assert alone == resolve_style(s, schedule_path=tmp_path / "none.json", log_path=_no_log(tmp_path))
    assert rotation_theme("x", "notebook") in FAMILIES["notebook"]
    assert rotation_theme("x", "notebook", avoid=rotation_theme("x", "notebook")) != rotation_theme("x", "notebook")
    assert resolve_theme(s, schedule_path=tmp_path / "none.json", log_path=_no_log(tmp_path)) == alone.theme


def _sched(tmp_path, ids):
    sched = tmp_path / "schedule.json"
    sched.write_text(json.dumps({"entries": [{"date": f"2026-01-{k + 1:02d}", "script": i} for k, i in enumerate(ids)]}),
                     encoding="utf-8")
    return sched


def test_style_log_records_and_overrides_history(tmp_path):
    log = tmp_path / "style_log.json"
    sched = _sched(tmp_path, ["2026-10-09-kid-password", "2026-10-08-zero-click", "2026-10-09-discord-bot-breach"])
    kid = _script("2026-10-09-kid-password")
    record_style(kid, style_of("paper", "security"), path=log)
    rec = load_style_log(log)["episodes"]["2026-10-09-kid-password"]
    assert (rec["stage"], rec["theme"], rec["luminance"], rec["mascot"], rec["visual_group"]) == (
        "notebook", "paper", "light", True, "ruled")
    assert rec["middle"] == [s.layout for s in kid.scenes[1:-1]]
    # the logged stage is history now
    walk = resolve_schedule(sched, log_path=log)
    assert walk[0][1].theme == "paper" and walk[0][3] == "log"
    assert walk[1][1].theme != "paper"


def test_script_theme_replaces_a_logged_entry(tmp_path):
    log = tmp_path / "style_log.json"
    cfo = _script("2026-10-08-deepfake-cfo")
    assert cfo.theme == "night-lamp"
    record_style(cfo, style_of("aurora", "ai", False), path=log)
    sched = _sched(tmp_path, ["2026-10-08-deepfake-cfo"])
    style, _w = resolve_style_report(cfo, schedule_path=sched, log_path=log)
    assert style.theme == "night-lamp"
    cfo.theme = ""
    assert resolve_style(cfo, schedule_path=sched, log_path=log).theme == "aurora"   # no override: the log wins


def test_style_log_reproducibility(tmp_path):
    """Recording is deterministic, and every logged episode resolves to its logged stage (unless its script now
    sets a different theme)."""
    now = datetime(2026, 10, 10, tzinfo=timezone.utc)
    a, b = tmp_path / "a.json", tmp_path / "b.json"
    for p in (a, b):
        record_style(_script("2026-10-09-kid-password"), style_of("graph", "security"), path=p, now=now)
    assert a.read_bytes() == b.read_bytes()
    logged = load_style_log()["episodes"]
    assert logged
    for sid, rec in logged.items():
        path = ROOT / "content" / "scripts" / f"{sid}.json"
        if not path.is_file():
            continue
        script = load_script(path)
        expected = script.theme if script.theme and script.theme != rec["theme"] else rec["theme"]
        assert resolve_style(script).theme == expected, sid


def test_old_log_entries_migrate(tmp_path):
    old = {"episodes": {
        "a": {"stage": "paper", "theme": "graph", "category": "security", "layouts": [], "middle": []},
        "b": {"stage": "alert", "theme": "pulse", "category": "voice", "layouts": [], "middle": []}}}
    log = tmp_path / "old.json"
    log.write_text(json.dumps(old), encoding="utf-8")
    eps = load_style_log(log)["episodes"]
    assert (eps["a"]["stage"], eps["a"]["mascot"], eps["a"]["luminance"], eps["a"]["visual_group"]) == (
        "notebook", True, "light", "ruled")
    assert (eps["b"]["stage"], eps["b"]["mascot"], eps["b"]["luminance"], eps["b"]["visual_group"]) == (
        "alert", False, "dark", "cards")
    assert migrate_entry(eps["a"]) == eps["a"]                                     # idempotent
    # the real log is already in the new shape
    for rec in json.loads((ROOT / "content" / "style_log.json").read_text(encoding="utf-8"))["episodes"].values():
        assert rec["stage"] in ("alert", "notebook") and isinstance(rec["mascot"], bool)


def test_layout_repeat_warning(tmp_path):
    log = tmp_path / "style_log.json"
    sched = _sched(tmp_path, ["2026-10-09-discord-bot-breach", "2026-10-08-zero-click"])
    zero = _script("2026-10-08-zero-click")
    # both are card-card-card in the middle -> warning (from the previous script file)
    assert "repeat" in layout_repeat_warning(zero, schedule_path=sched, log_path=log)
    # the log wins over the script file
    record_style(_script("2026-10-09-discord-bot-breach"), style_of("paper", "security"), path=log)
    data = json.loads(log.read_text(encoding="utf-8"))
    data["episodes"]["2026-10-09-discord-bot-breach"]["middle"] = ["compare", "toggle", "flow"]
    log.write_text(json.dumps(data), encoding="utf-8")
    assert layout_repeat_warning(zero, schedule_path=sched, log_path=log) is None
    # first episode: nothing to compare with
    assert layout_repeat_warning(_script("2026-10-09-discord-bot-breach"), schedule_path=sched, log_path=log) is None


@pytest.mark.parametrize("sid", ["2026-10-08-deepfake-cfo"])
def test_deepfake_cfo_closes_with_a_checklist_from_its_own_words(sid):
    s = _script(sid)
    last = s.scenes[-1]
    assert last.layout == "checklist" and s.theme == "night-lamp"
    said = " ".join([last.narration, last.headline, last.sub])
    for item in last.items:
        assert item in said, item
    assert validate(s)[0] == []
