"""Character system (드라마 등장인물): script fields (cast character, scene staging, line acting notes), their QA checks,
the default staging, the props the renderer reads, and the composition rules of every staging's shots
(video/src/composition.json, the single source the TS rig and stagings read)."""
import copy
import json
import re
from pathlib import Path

import pytest

from radar.production.remotion_render import cast_props, lines_props, scene_props
from radar.production.script import (KEYWORD_BUBBLE_MAX_CHARS, CALLERS, CHARACTERS, EXPRESSIONS, FAMILY, GESTURES,
                                     STAGING_LAYOUTS, STAGINGS, Line, Scene, Script, cast_of, default_staging,
                                     load_script, validate, victim_character)

ROOT = Path(__file__).resolve().parents[1]
COMP = json.loads((ROOT / "video" / "src" / "composition.json").read_text(encoding="utf-8"))
TYPES = (ROOT / "video" / "src" / "types.ts").read_text(encoding="utf-8")
DRAMAS = {name: ROOT / "content" / "scripts" / f"2026-10-11-drama-{name}.json"
          for name in ("bank-caller", "compensation-sms", "invest-ad")}
FRAME = COMP["frame"]
RIG = COMP["rig"]


# ------------------------------------------------------------------ one vocabulary in Python, JSON and TypeScript

def _ts_union(name: str) -> list[str]:
    m = re.search(rf"export type {name} =([^;]+);", TYPES)
    assert m, name
    return re.findall(r'"([A-Za-z_]+)"', m.group(1))


def test_vocabulary_is_the_same_in_python_json_and_typescript():
    assert list(CHARACTERS) == COMP["characters"] == _ts_union("CharacterId")
    assert list(STAGINGS) == COMP["stagings"] == _ts_union("Staging") == list(COMP["stagings_spec"])
    assert list(EXPRESSIONS) == COMP["expressions"] == _ts_union("Expression")
    assert list(GESTURES) == COMP["gestures"] == _ts_union("Gesture")
    assert list(FAMILY) == COMP["family"] and list(CALLERS) == COMP["callers"]
    assert KEYWORD_BUBBLE_MAX_CHARS == COMP["bubbleMaxChars"] == 8
    assert set(STAGING_LAYOUTS) == set(STAGINGS)
    # every gesture with hands has an elbow for each hand
    for g, hands in RIG["hands"].items():
        assert g in GESTURES or g == "back", g   # back: the over-the-shoulder phone hand
        assert set(hands) == set(RIG["elbows"].get(g, {})), g


# ------------------------------------------------------------------ parsing and the three drama scripts

def test_the_drama_scripts_carry_characters_and_stagings():
    bank, sms, ad = (load_script(p) for p in DRAMAS.values())
    assert bank.cast["victim"]["character"] == "father" and bank.cast["scammer"]["character"] == "fake_banker"
    assert [s.staging for s in bank.scenes] == ["pip_call", "dochi_explains", "dochi_explains", "dochi_explains"]
    assert bank.scenes[0].lines[0].bubble == "한도가 나왔어요"
    assert sms.cast["mom"]["character"] == "mother" and sms.cast["daughter"]["character"] == "daughter"
    assert [s.staging for s in sms.scenes] == ["over_shoulder_chat", "over_shoulder_chat", "dochi_explains", "",
                                              "dochi_explains"]
    daughter = sms.scenes[1].lines[1]
    assert (daughter.face, daughter.gesture, daughter.bubble) == ("shocked", "palmOut", "누르지 마!")
    assert ad.cast["ad"]["character"] == "ad" and ad.cast["leader"]["character"] == "scammer"
    assert ad.cast["father"]["character"] == "father" and "character" not in ad.cast["member"]
    assert ad.scenes[0].staging == "watch_ad"
    for script in (bank, sms, ad):
        errors, _ = validate(script, allow_unverified=True)
        assert errors == [], (script.id, errors)
        assert victim_character(cast_of(script)) in ("victim", "mom", "father")


def test_the_drama_scripts_keep_their_text():
    """Only acting fields were added: every line's speaker and text are what the reviewed scripts said."""
    for path in DRAMAS.values():
        data = json.loads(path.read_text(encoding="utf-8"))
        for scene in data["scenes"]:
            for line in scene.get("lines", []):
                assert set(line) <= {"speaker", "text", "tts", "face", "gesture", "bubble"}
                if "bubble" in line:
                    assert line["bubble"] in line["text"]


# ------------------------------------------------------------------ validation

def _script(**over) -> Script:
    s = load_script(DRAMAS["bank-caller"])
    s = copy.deepcopy(s)
    for k, v in over.items():
        setattr(s, k, v)
    return s


def _errors(s: Script) -> list[str]:
    return validate(s, allow_unverified=True)[0]


def test_unknown_character_staging_face_and_gesture_are_errors():
    s = _script()
    s.cast["victim"]["character"] = "grandpa"
    assert any("unknown character 'grandpa'" in e for e in _errors(s))
    s = _script()
    s.scenes[0].staging = "zoom_call"
    assert any("unknown staging 'zoom_call'" in e for e in _errors(s))
    s = _script()
    s.scenes[0].lines[1].face = "angry"
    s.scenes[0].lines[1].gesture = "wave"
    errs = _errors(s)
    assert any("unknown face 'angry'" in e for e in errs) and any("unknown gesture 'wave'" in e for e in errs)


def test_bubbles_are_short_keywords_from_the_line():
    s = _script()
    s.scenes[0].lines[0].bubble = "연소득으로 한도가 나왔어요"
    assert any("longer than 8" in e for e in _errors(s))
    s = _script()
    s.scenes[0].lines[0].bubble = "지금 송금"
    assert any("must be a part of the line" in e for e in _errors(s))


def test_staging_must_fit_the_layout_and_the_cast():
    s = _script()
    s.scenes[0].staging = "over_shoulder_chat"   # a call scene
    assert any("plays the layouts chat, sms" in e for e in _errors(s))
    s = _script()
    s.scenes[3].staging = "pip_call"             # a checklist
    assert any("not 'checklist'" in e for e in _errors(s))
    s = _script()
    s.cast["scammer"].pop("character")
    assert any("needs a caller character" in e for e in _errors(s))
    s = _script()
    s.cast["victim"].pop("character")
    assert any("needs a family character" in e for e in _errors(s))
    ad = copy.deepcopy(load_script(DRAMAS["invest-ad"]))
    ad.cast["ad"].pop("character")
    assert any("watch_ad needs a line by a cast member with character 'ad'" in e for e in _errors(ad))


def test_default_staging_follows_the_layout():
    cast = {"victim": {"role": "victim", "character": "mother"}, "scammer": {"role": "scammer", "character": "scammer"},
            "ad": {"role": "neutral", "character": "ad"}, "plain": {"role": "neutral"}}
    def scene(layout, *speakers, staging=""):
        return Scene("x", "h", layout=layout, lines=[Line(s, "안녕하세요") for s in speakers], staging=staging)
    assert default_staging(scene("call", "scammer", "victim"), cast) == "pip_call"
    assert default_staging(scene("chat", "victim"), cast) == "over_shoulder_chat"
    assert default_staging(scene("sms", "victim"), cast) == "over_shoulder_chat"
    assert default_staging(scene("card", "ad", "victim"), cast) == "watch_ad"
    assert default_staging(scene("card", "victim"), cast) is None          # explainers are opt-in
    assert default_staging(scene("call", "plain"), cast) is None           # nobody rigged speaks
    assert default_staging(scene("checklist", "dochi", staging="dochi_explains"), cast) == "dochi_explains"


def test_props_carry_character_staging_and_acting_notes():
    s = load_script(DRAMAS["compensation-sms"])
    props = cast_props(s)
    assert props["mom"]["character"] == "mother" and props["daughter"]["character"] == "daughter"
    assert "character" not in props["dochi"]
    chat = s.scenes[1]
    lines = lines_props(chat, [(0.0, 2.6), (2.9, 5.6)], cast_of(s))
    assert lines[1]["face"] == "shocked" and lines[1]["gesture"] == "palmOut" and lines[1]["bubble"] == "누르지 마!"
    assert "face" not in {k for k in lines[0] if k == "bubble"}
    sp = scene_props(chat, "a.wav", 0.0, 5.6, 6.0, [], lines, default_staging(chat, cast_of(s)))
    assert sp["staging"] == "over_shoulder_chat"
    flow = s.scenes[3]
    assert "staging" not in scene_props(flow, "a.wav", 0.0, 5.0, 5.3, [], None, default_staging(flow, cast_of(s)))


# ------------------------------------------------------------------ composition rules

def _neck(spot) -> float:
    return spot["eyeY"] - RIG["eyeY"] * spot["k"]


def _face_box(spot):
    """Face (with ears and hair) in screen px."""
    k, n = spot["k"], _neck(spot)
    half = (RIG["head"]["rx"] + 34) * k
    return spot["x"] - half, n + RIG["head"]["top"] * k, spot["x"] + half, n + RIG["head"]["chin"] * k


def _hand_boxes(spot):
    k, n = spot["k"], _neck(spot)
    r = RIG["handR"] * k * 1.15
    sides = [-1] if spot.get("mirror") else [1]   # mirror: the gestures are drawn on the other side
    for g in spot["gestures"]:
        for side in sides:
            for hx, hy in RIG["hands"].get(g, {}).values():
                x, y = spot["x"] + side * hx * k, n + hy * k
                yield g, (x - r, y - r, x + r, y + r)


def _forbidden(box) -> list[str]:
    x0, y0, x1, y1 = box
    out = []
    band = FRAME["captionBand"]
    if y1 > band[0] and y0 < band[1]:
        out.append("caption band")
    if y1 > FRAME["bottomSafe"]:
        out.append("bottom 20%")
    rc = FRAME["rightColumn"]
    if x1 > rc["x"] and y1 > rc["y"][0] and y0 < rc["y"][1]:
        out.append("right UI column")
    return out


def _shots():
    for name, spec in COMP["stagings_spec"].items():
        for shot, s in spec["shots"].items():
            yield name, shot, s


@pytest.mark.parametrize("staging,shot,spec", list(_shots()), ids=lambda v: v if isinstance(v, str) else "")
def test_faces_and_hands_stay_out_of_the_caption_band_bottom_and_right_column(staging, shot, spec):
    for spot in spec["chars"]:
        assert _forbidden(_face_box(spot)) == [], (staging, shot, spot["who"], "face")
        for g, box in _hand_boxes(spot):
            assert _forbidden(box) == [], (staging, shot, spot["who"], g)


@pytest.mark.parametrize("staging,shot,spec", list(_shots()), ids=lambda v: v if isinstance(v, str) else "")
def test_eye_lines_and_sizes(staging, shot, spec):
    chars = spec["chars"]
    windows = sum(1 for k in ("window", "tv") if k in spec)
    dochi = 1 if staging == "dochi_explains" else 0
    assert len(chars) + windows + dochi <= FRAME["maxCharacters"]
    band = COMP["stagings_spec"][staging].get("eyeBandOverride", {})
    split = staging == "split_call"
    for spot in chars:
        if spot.get("view") == "back":
            continue   # the over-the-shoulder back of the head has no eyes
        lo, hi = band.get(spot["who"], FRAME["eyeBand"])
        assert lo <= spot["eyeY"] <= hi, (staging, shot, spot["who"])
        # visible height: hair top to the waist or the frame / panel edge
        n, k = _neck(spot), spot["k"]
        top, bottom = n + RIG["head"]["top"] * k, min(FRAME["h"], n + RIG["waist"] * k)
        if split and spot["who"] == "caller":
            top, bottom = max(top, 236), min(bottom, COMP["stagings_spec"]["split_call"]["border"]["y"])
        if split and spot["who"] == "victim":
            top = max(top, COMP["stagings_spec"]["split_call"]["border"]["y"])
        need = FRAME["minHeight"]["single" if len(chars) + windows + dochi == 1 else "twoShot"]
        assert (bottom - top) / FRAME["h"] >= need, (staging, shot, spot["who"], round((bottom - top) / FRAME["h"], 3))
        # the face is big enough to read on a phone: at least 30% of the width (single shots)
        if len(chars) + dochi == 1 and spot["who"] != "presenter":
            assert 2 * RIG["head"]["rx"] * k / FRAME["w"] >= 0.29, (staging, shot)
    for key in ("window",):
        if key in spec:
            w = spec[key]
            assert w["h"] * w["scale"] / FRAME["h"] >= FRAME["minHeight"]["window"], (staging, shot)


def test_the_first_frame_is_the_victims_face():
    """Every drama staging opens (its first shot) on the victim's face, eyes in the eye band, face >= 30% wide."""
    for name in ("pip_call", "over_shoulder_chat", "watch_ad"):
        first = {"pip_call": "close", "over_shoulder_chat": "face", "watch_ad": "face"}[name]
        spot = COMP["stagings_spec"][name]["shots"][first]["chars"][0]
        assert spot["who"] == "victim" and spot.get("view", "front") == "front"
        assert FRAME["eyeBand"][0] <= spot["eyeY"] <= FRAME["eyeBand"][1]
        assert 2 * RIG["head"]["rx"] * spot["k"] / FRAME["w"] >= 0.3
    rig = (ROOT / "video" / "src" / "rig.ts").read_text(encoding="utf-8")
    assert 'push("close", -1e9, first)' in rig and 'push("face", -1e9, first)' in rig


def test_twist_close_up_and_stamp():
    tw = COMP["stagings_spec"]["twist_closeup"]
    spot = tw["shots"]["twist"]["chars"][0]
    x0, _, x1, chin = _face_box(spot)
    assert 0.40 <= 2 * RIG["head"]["rx"] * spot["k"] / FRAME["w"] <= 0.85   # face 40-85% of the width
    mouth = _neck(spot) + RIG["mouthY"] * spot["k"]
    stamp = tw["stamp"]
    top, bottom = stamp["y"] - stamp["h"] / 2, stamp["y"] + stamp["h"] / 2
    assert top > mouth + 60 and top > spot["eyeY"] + 100       # never over the eyes or the mouth
    assert top >= chin - 30                                     # on the chest, under the chin
    assert bottom < FRAME["captionBand"][0]                     # and clear of the captions


def test_dochi_explains_keeps_the_cards_beside_the_family():
    de = COMP["stagings_spec"]["dochi_explains"]
    c = de["content"]
    victim = de["shots"]["explain"]["chars"][0]
    body_left = c["x"] + 110 * c["scale"]          # kit BODY.left, scaled
    body_right = c["x"] + 970 * c["scale"]
    body_bottom = c["y"] + 1200 * c["scale"]
    assert _face_box(victim)[2] - 34 * victim["k"] <= body_left       # the cards never cover the face
    assert body_right <= FRAME["rightColumn"]["x"] + 50 and body_bottom < FRAME["captionBand"][0]
    assert c["scale"] >= 0.7                                           # explainer text stays readable
    d = de["dochi"]
    assert d["y"] < FRAME["captionBand"][0] and d["x"] + d["size"] * 0.6 < FRAME["rightColumn"]["x"]
