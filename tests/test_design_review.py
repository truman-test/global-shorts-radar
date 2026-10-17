"""The 2026-10-17 design re-review fixes (reports/재검토_디자인.md, the orchestrator's accepted list): the fox's
defeat faces rotate by episode and show one panic symbol set; no blush / sparkle on grown-ups; the lower frame of a
bust shot is a room (desk front with a floor gradient and one small prop); chips >= 26 px and never more than two at
once; the bank_suit disguise hides something that leaks and the family mask shows the ears; 도치 never appears inside
the villain set; the variety gate and the 10-character hook_title warning in script-check."""
import json
import re
from pathlib import Path

import pytest

from radar.production.remotion_render import build_props, scene_props
from radar.production.script import (DEFEAT_FACES, EXPRESSIONS, HOOK_TITLE_LINE_TARGET, INNER_LABEL, VARIETY_AXES,
                                     Line, Scene, cast_of, default_staging, fox_costume_of, load_script, twist_face_of,
                                     validate, variety_signature)
from radar.production.themes import previous_episodes, variety_warning
from tests.test_villain_looks import DISCLAIMER, _drama, _write

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "video" / "src"
COMP = json.loads((SRC / "composition.json").read_text(encoding="utf-8"))
FRAME, PACK = COMP["frame"], COMP["packaging"]
TYPES = (SRC / "types.ts").read_text(encoding="utf-8")
RIG = (SRC / "rig.ts").read_text(encoding="utf-8")
CAST_SCENE = (SRC / "CastScene.tsx").read_text(encoding="utf-8")
ANIMAL = (SRC / "Animal.tsx").read_text(encoding="utf-8")
CHARACTER = (SRC / "Character.tsx").read_text(encoding="utf-8")
SPECIES = (SRC / "Species.tsx").read_text(encoding="utf-8")
SETS = (SRC / "Sets.tsx").read_text(encoding="utf-8")
DISGUISE = (SRC / "Disguise.tsx").read_text(encoding="utf-8")
DIALOGUE = (SRC / "dialogue.tsx").read_text(encoding="utf-8")
PACKAGING = (SRC / "Packaging.tsx").read_text(encoding="utf-8")
SHORT = (SRC / "Short.tsx").read_text(encoding="utf-8")


def _ts_union(name: str) -> list[str]:
    m = re.search(rf"export type {name} =([^;]+);", TYPES)
    assert m, name
    return re.findall(r'"([A-Za-z_]+)"', m.group(1))


# ------------------------------------------------------------------ 2. the fox's defeat faces

def test_defeat_faces_are_one_vocabulary():
    assert list(EXPRESSIONS) == COMP["expressions"] == _ts_union("Expression")
    assert {"deflated", "caught"} <= set(EXPRESSIONS)
    assert list(DEFEAT_FACES) == COMP["defeatFaces"] and set(DEFEAT_FACES) <= set(EXPRESSIONS)
    assert len(DEFEAT_FACES) >= 4 and {"deflated", "caught", "panicked"} <= set(DEFEAT_FACES)
    assert "export const defeatFaceOf" in RIG and "DEFEAT_FACES[Math.abs(Math.round(seed)) % DEFEAT_FACES.length]" in RIG
    assert 'isCallerId ? defeatFaceOf(c.seed) : "shocked"' in CAST_SCENE


def test_the_new_faces_are_drawn_on_both_skins():
    # deflated: ears down, half-closed eyes, a flat mouth; caught: the wide stare, the mouth zipped
    assert 'e === "deflated" && (sp === "dog" || sp === "fox" || sp === "cat")' in ANIMAL      # the ears droop
    assert 'e === "deflated" ? -ry * 0.1' in ANIMAL                                             # the lid half down
    assert 'if (e === "shocked" || e === "caught")' in ANIMAL and 'if (e === "caught") blink = 0;' in ANIMAL
    assert 'e === "caught" ? (' in ANIMAL and "<ZippedMouth" in ANIMAL
    assert "export const ZippedMouth" in CHARACTER and 'case "deflated": return line("M -22 2 L 22 2");' in CHARACTER
    assert 'case "caught": return <ZippedMouth' in CHARACTER and 'if (e === "deflated")' in CHARACTER
    assert 'case "deflated": return [[-240, -262], [-240, -262]];' in CHARACTER


def test_default_fox_face_rotates_by_episode_and_the_family_stays_shocked():
    s = _drama()
    twist = s.scenes[1]
    twist.twist_face = ""
    faces = []
    for ep in (1, 2, 3, 4, 5):
        s.series, s.ep = "영업비밀", ep
        faces.append(twist_face_of(s, twist))
    assert faces[:4] == list(DEFEAT_FACES) and faces[4] == faces[0]          # ep 1..4 differ, 5 wraps
    s.series, s.ep = "", None
    by_id = {twist_face_of(_drama(sid, ) if False else s, twist)}            # the hash fallback is deterministic
    assert by_id <= set(DEFEAT_FACES)
    other = _drama("2026-10-21-fox-other")
    other.scenes[1].twist_face = ""
    assert twist_face_of(other, other.scenes[1]) in DEFEAT_FACES
    twist.twist_face = "panicked"
    assert twist_face_of(s, twist) == "panicked"                              # the script's choice wins
    family = _drama()
    family.scenes[1].twist_on, family.scenes[1].twist_face = "father", ""
    assert twist_face_of(family, family.scenes[1]) == "shocked"


def test_props_carry_the_effective_twist_face():
    s = _drama()
    s.scenes[1].twist_face = ""
    s.series, s.ep = "영업비밀", 3
    cast = cast_of(s)
    scenes = [scene_props(sc, "", 0.0, 2.0, 2.3, [], None, default_staging(sc, cast)) for sc in s.scenes]
    assert "face" not in scenes[1]["twist"]
    props = build_props(s, scenes, "ch")
    assert props["scenes"][1]["twist"]["face"] == DEFEAT_FACES[2] == "deflated"
    assert props["scenes"][1]["twist"]["on"] == "fox" and "twist" not in props["scenes"][0]
    for sid in ("2026-10-12-fox-bank-income", "2026-10-15-ep2-compensation-sms"):
        script = load_script(ROOT / "content" / "scripts" / f"{sid}.json")
        tw = next(sc for sc in script.scenes if sc.twist)
        assert tw.twist_face and twist_face_of(script, tw) == tw.twist_face  # explicit faces are kept


def test_one_panic_symbol_set_at_a_time():
    body = CAST_SCENE[CAST_SCENE.index("export const exprFx"):CAST_SCENE.index("type PoseOpts")]
    sets = ("sweat", "shockLines", "gloom", "tears")
    for line in body.splitlines():
        if "return" not in line:
            continue
        for branch in re.findall(r"\[([^\]]*)\]", line):
            used = [k for k in sets if f'"{k}"' in branch]
            assert len(used) <= 1, line
        assert '"sparkle"' not in line
    assert '["shockLines", "sweat", "sweat2", "gloom"]' not in CAST_SCENE
    assert "exprFx(face, 99, isCallerId" in CAST_SCENE                        # the twist close-up uses the same rule


# ------------------------------------------------------------------ 3. no childish cues on grown-ups

def test_blush_and_sparkle_only_on_the_young():
    assert "export const blush = (sp: Species, young: boolean) => young && sp" in SPECIES
    assert "blush(sp, F.young)" in ANIMAL
    assert '!L.age && (p.id === "daughter" || p.id === "son")' in CHARACTER
    body = CAST_SCENE[CAST_SCENE.index("export const exprFx"):CAST_SCENE.index("type PoseOpts")]
    assert "sparkle" not in body and 'young ? ["blush"] : []' in body and "exprFx(expr, since, who, young)" in CAST_SCENE
    for cid in ("father", "mother", "cat_guard", "raccoon_neighbor", "bear_shopkeeper"):
        spec = json.loads((ROOT / "content" / "characters" / f"{cid}.json").read_text(encoding="utf-8"))
        assert not spec.get("age", {}).get("young")                           # the grown-ups get neither


# ------------------------------------------------------------------ 4. the lower 40%: a room, not a card

def test_bust_shots_get_a_desk_front_with_a_floor_gradient_and_one_small_prop():
    assert "<linearGradient id={grad}" in SETS and "const SmallPropView" in SETS and "export const smallPropOf" in SETS
    assert COMP["smallPropMaxTop"] <= FRAME["captionBand"][0] + 45              # a prop on an edge in the band: none
    assert "prop !== \"none\" ? <SmallPropView" in SETS
    for kind in ("cup", "phoneStand", "mail"):
        assert f'case "{kind}"' in SETS
    # the small prop stands at the left edge, clear of the right UI column, and under 도치's pop-in spot
    x = int(re.search(r"const SMALL_PROP_X = (\d+);", SETS).group(1))
    assert x + 60 < PACK["spike"]["x"] + 0.6 * PACK["spike"]["size"] and x < FRAME["rightColumn"]["x"]
    # the aside and the solo / caller / chat busts have their edge above the limit, so they get the prop (watch_ad's
    # face shot sits lower, inside the band: none there)
    for st, sh in (("solo", "victim"), ("solo", "caller"), ("over_shoulder_chat", "face"), ("pip_call", "caller")):
        assert COMP["stagings_spec"][st]["shots"][sh]["prop"]["top"] <= COMP["smallPropMaxTop"], (st, sh)
    assert COMP["aside"]["prop"]["top"] <= COMP["smallPropMaxTop"]
    assert COMP["stagings_spec"]["watch_ad"]["shots"]["face"]["prop"]["top"] > COMP["smallPropMaxTop"]
    assert "no cups or keyboards" not in SETS                                  # the old rule is gone


# ------------------------------------------------------------------ 5. chips

def test_chips_are_readable_and_never_more_than_two():
    chip, se, sp = PACK["chip"], PACK["series"], PACK["speakerChip"]
    assert chip["font"] >= 26 and se["font"] >= 26 and sp["font"] >= 26
    assert sp["font"] >= 40 and se["font"] >= 36                               # ~11-12 px on a 390 px phone
    assert sp["maxChips"] == 2
    assert 0 < se["showFrames"] <= 90 and se["fade"] <= se["showFrames"]       # the series tab: the opening beat only
    assert "f >= end ? 1 : interpolate(f, [S.showFrames - S.fade, S.showFrames], [1, 0], clamp)" in PACKAGING
    assert "<SeriesTab chip={props.seriesChip} end={tail > 0 ? end : undefined} />" in SHORT
    # the speaker chip reads its size from the composition and stays above the captions
    assert "COMP.packaging.speakerChip.font" in DIALOGUE and "fontSize: SPEAKER_CHIP_FONT" in DIALOGUE
    assert sp["top"] + sp["font"] * 1.1 + 21 <= FRAME["captionBand"][0] + 6
    # the inner 속마음 tag only when the speaker chip does not already say 속마음
    assert "export const thoughtTagged" in RIG and '.includes("속마음")' in RIG
    assert "{tagged ? <ThoughtTag frame={c.frame} from={from} /> : null}" in CAST_SCENE


def test_inner_label_without_sokmaeum_warns():
    s = _drama()
    s.cast["fox_inner"]["label"] = "여우"
    assert any(f"label should say {INNER_LABEL}" in w for w in validate(s)[1])
    assert not any("label should say" in w for w in validate(_drama())[1])


# ------------------------------------------------------------------ 6. disguises that leak; 도치 on the family side

def test_bank_suit_hides_something_that_leaks_and_the_mask_shows_the_ears():
    head = DISGUISE[DISGUISE.index("export const DisguiseHead"):]
    bank = head[head.index('case "bank_suit"'):]
    bank = bank[:bank.index('case "investigator"')]
    assert "through(-350, [-1, 1], crown)" in bank and "moustache" in bank    # both ears out of the wig, the moustache
    mask = head[head.index('case "family_mask"'):]
    mask = mask[:mask.index("default:")]
    assert "-372 L" not in mask and "the cut-out ears and the face card" not in mask   # no card ears over the fox's own
    assert "rx={118} ry={116}" in mask                                         # a smaller card: the ears stand above it
    # in the call window the fox's ear tips rise well above the card's top (local units: tip -414, card top ~-302)
    tip, card_top = COMP["animal"]["earTip"], -302
    k = COMP["stagings_spec"]["pip_call"]["windowChar"]["k"] * COMP["stagings_spec"]["pip_call"]["shots"]["close"]["window"]["scale"]
    assert (card_top - tip) * k >= 50                                          # >= 50 px of ear above the mask


def test_dochi_never_pops_in_inside_the_villain_set():
    assert "export const spikeShownAt" in RIG and "const callerSideShot" in RIG
    assert SHORT.count("spikeShownAt(") == 2 and "spikeAtMs(" not in SHORT     # the alert and its beep
    assert 'l.spike ? "wide"' in RIG                                           # pip_call: the victim with the window
    assert "&& !l.spike ? \"caller\"" in RIG                                   # over_shoulder: no fox solo
    assert '(l.speaker === caller && l.spike && victim) ? "victim"' in RIG     # solo: the victim listening
    s = _drama()
    s.scenes[2].lines[0].spike = True                                          # on the fox's own aside
    assert any("spike on the fox's own aside" in w for w in validate(s)[1])
    assert not any("fox's own aside" in w for w in validate(_drama())[1])


# ------------------------------------------------------------------ 7. the variety gate, the 10-character title

def test_variety_signature_reads_the_four_axes():
    s = _drama(villain_set="car")
    s.cast["fox"]["costume"] = "investigator"
    s.scenes[1].twist_face = "caught"
    assert list(VARIETY_AXES) == ["costume", "villain_set", "twist_face", "luminance"]
    assert variety_signature(s, "dark") == {"costume": "investigator", "villain_set": "car", "twist_face": "caught",
                                            "luminance": "dark"}
    assert fox_costume_of(_drama()) == "hoodie" and variety_signature(_drama())["villain_set"] == "callcentre"


def _schedule(tmp_path, ids):
    scripts = tmp_path / "scripts"
    scripts.mkdir(exist_ok=True)
    schedule = tmp_path / "schedule.json"
    schedule.write_text(json.dumps({"entries": [{"date": f"2026-10-{20 + i}", "script": sid}
                                                for i, sid in enumerate(ids)]}), encoding="utf-8")
    return scripts, schedule


def test_previous_episodes_looks_two_back(tmp_path):
    scripts, schedule = _schedule(tmp_path, ["a", "b", "c", "d"])
    assert previous_episodes(_drama("c"), 2, schedule) == ["b", "a"]
    assert previous_episodes(_drama("a"), 2, schedule) == []
    assert previous_episodes(_drama("z"), 2, schedule) == ["d", "c"]           # unscheduled: after the whole schedule


@pytest.mark.parametrize("prev_look,mine,warns", [
    (("bank_suit", "fake_office", "shocked"), ("bank_suit", "fake_office", "shocked"), True),   # three shared
    (("bank_suit", "fake_office", "shocked"), ("bank_suit", "car", "shocked"), True),           # two shared
    (("bank_suit", "fake_office", "shocked"), ("investigator", "car", "shocked"), False),       # one shared
    (("bank_suit", "fake_office", "shocked"), ("investigator", "car", "caught"), False),
])
def test_variety_gate_against_the_previous_two(tmp_path, prev_look, mine, warns):
    scripts, schedule = _schedule(tmp_path, ["2026-10-20-fox-a", "2026-10-21-fox-b", "2026-10-22-fox-c"])
    prev = _drama("2026-10-20-fox-a")
    prev.scenes[1].twist_face = prev_look[2]
    _write(scripts, prev, prev_look[0], prev_look[1])
    middle = _drama("2026-10-21-fox-b")                                        # the episode in between: another look
    middle.scenes[1].twist_face = "deflated"
    _write(scripts, middle, "courier", "lecture_room")
    me = _drama("2026-10-22-fox-c", villain_set=mine[1])
    me.cast["fox"]["costume"] = mine[0]
    me.scenes[1].twist_face = mine[2]
    w = variety_warning(me, schedule, scripts, tmp_path / "log.json")
    assert bool(w) == warns, w
    if w:
        assert "2026-10-20-fox-a" in w and "variety:" in w and "2026-10-21-fox-b" not in w


def test_variety_gate_counts_the_twist_face_rotation_and_the_luminance(tmp_path):
    scripts, schedule = _schedule(tmp_path, ["2026-10-20-fox-a", "2026-10-21-fox-b"])
    prev = _drama("2026-10-20-fox-a")
    prev.scenes[1].twist_face = ""
    _write(scripts, prev, "bank_suit", "fake_office")
    me = _drama("2026-10-21-fox-b", villain_set="fake_office")
    me.cast["fox"]["costume"] = "guru"
    me.scenes[1].twist_face = ""
    # two unscheduled-ep dramas with no twist_face fall back to the id hash: equal faces would make a second shared axis
    same_face = twist_face_of(prev, prev.scenes[1]) == twist_face_of(me, me.scenes[1])
    w = variety_warning(me, schedule, scripts, tmp_path / "log.json")
    assert bool(w) == same_face or "luminance" in (w or "")
    explainer = load_script(ROOT / "content" / "scripts" / "2026-10-08-zero-click.json")
    assert variety_warning(explainer, schedule, scripts, tmp_path / "log.json") is None


def test_hook_title_over_ten_characters_warns_even_without_a_series_chip():
    long = _drama()
    long.hook_title = "소득 맞히는 은행 전화\n앱부터 깔라고요"
    assert any(f"<= {HOOK_TITLE_LINE_TARGET}" in w for w in validate(long)[1])
    assert not any(f"<= {HOOK_TITLE_LINE_TARGET}" in w for w in validate(_drama())[1])
    data = json.loads((ROOT / "content" / "scripts" / "2026-10-17-ep3-invest-ad.json").read_text(encoding="utf-8"))
    assert all(len(t) <= HOOK_TITLE_LINE_TARGET for t in data["hook_title"].split("\n"))


def test_script_check_runs_the_variety_gate():
    cli = (ROOT / "src" / "radar" / "cli.py").read_text(encoding="utf-8")
    assert "variety_warning(script)" in cli
