"""The fox's disguises and rooms (owner note 2026-10-14: the villain looked the same in every video): the cast field
"costume" and the script / scene field "villain_set", their gate, the props the renderer reads, the first-frame helper
and the script-check warning against the previous scheduled episode, and the TypeScript side (composition.json
costumes / villainSets, Disguise.tsx, Sets.tsx VillainSetView, every caller shot drawn through it)."""
import json
import re
from pathlib import Path

import pytest

from radar.production.remotion_render import build_props, cast_props, scene_props
from radar.production.script import (CALLERS, COSTUME_CHARACTERS, COSTUMES, DEFAULT_VILLAIN_SET, VILLAIN_SETS, Line,
                                     Scene, Script, cast_of, costume_of, default_staging, first_frame_villain,
                                     load_script, validate)
from radar.production.themes import villain_repeat_warning

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "video" / "src"
COMP = json.loads((SRC / "composition.json").read_text(encoding="utf-8"))
TYPES = (SRC / "types.ts").read_text(encoding="utf-8")
DISGUISE = (SRC / "Disguise.tsx").read_text(encoding="utf-8")
SETS = (SRC / "Sets.tsx").read_text(encoding="utf-8")
CAST_SCENE = (SRC / "CastScene.tsx").read_text(encoding="utf-8")
DISCLAIMER = "※ 실제 수법을 바탕으로 각색한 재연입니다"


def _ts_union(name: str) -> list[str]:
    m = re.search(rf"export type {name} =([^;]+);", TYPES)
    assert m, name
    return re.findall(r'"([A-Za-z_]+)"', m.group(1))


def _drama(sid: str = "2026-10-20-fox-test", opening: str = "aside", **fields) -> Script:
    """Format A: the fox brags (aside = the poster), calls, gets caught out, his aside. opening "call": the call first."""
    first = [Line("fox_inner", "소득만 맞히면, 다들 믿어요."), Line("fox", "아버님, 연소득 기준 한도 나왔어요."),
             Line("father", "내 소득을 어떻게 알아요?")]
    if opening == "call":
        first = first[1:]
    scenes = [
        Scene("", "소득 맞히는 전화", "phone", layout="call", caller="모르는 번호", lines=first),
        Scene("", "앱부터 깔라고?", "phone", layout="call", caller="모르는 번호", lines=[
            Line("fox", "신청서 쓰게 앱만 깔아 주세요."),
            Line("father", "끊고, 은행 대표번호로 직접 걸게요.")], twist="뚝!", twist_on="fox", twist_face="shocked"),
        Scene("", "작전 실패", "phone", layout="card", staging="solo",
              lines=[Line("fox_inner", "직접 건다는 말이… 제일 무서워요."), Line("fox_inner", "다음 집은…")]),
    ]
    for sc in scenes:
        sc.narration = " ".join(x.text for x in sc.lines)
    cast = {"fox": {"voice": "M2", "label": "여우", "role": "scammer", "character": "scammer"},
            "fox_inner": {"voice": "M3", "label": "여우 속마음", "role": "inner", "character": "scammer"},
            "father": {"voice": "M1", "label": "아버지", "role": "victim", "character": "father"}}
    s = Script(id=sid, source_video_id="x", title="은행 사칭 전화, 여우가 제일 무서워한 한마디", description="", tags=[],
               disclaimer=DISCLAIMER, scenes=scenes, sources=[{"url": "https://example.org"}], cast=cast,
               cast_style="animal", hook_title="소득 맞히는\n은행 전화")
    for k, v in fields.items():
        setattr(s, k, v)
    return s


def _errors(s):
    return validate(s)[0]


def _warnings(s):
    return validate(s)[1]


# ------------------------------------------------------------------ one vocabulary in Python, JSON and TypeScript

def test_vocabulary_is_the_same_in_python_json_and_typescript():
    assert list(COSTUMES) == COMP["costumes"] == _ts_union("CostumeId")
    assert list(VILLAIN_SETS) == list(COMP["villainSets"]) == _ts_union("VillainSet")
    assert DEFAULT_VILLAIN_SET == "callcentre" and COMP["villainSets"]["callcentre"]["prop"] == "ccDesk"
    assert set(CALLERS) <= set(COSTUME_CHARACTERS) and "ad" in COSTUME_CHARACTERS
    assert re.search(r"costume\?: CostumeId", TYPES) and re.search(r"villainSet\?: VillainSet", TYPES)
    for name, spec in COMP["villainSets"].items():
        assert spec["prop"] in COMP["props"], name
        assert re.fullmatch(r"#[0-9A-F]{6}", spec["rim"]) and re.fullmatch(r"#[0-9A-F]{6}", spec["light"]), name


def test_every_costume_and_room_is_drawn():
    """Each disguise has its clothes and a head layer (the leak sits at face / collar height), each room a set."""
    looks = re.search(r"COSTUME_LOOKS: Record<CostumeId, CostumeLook> = \{(.+?)\n\};", DISGUISE, re.S).group(1)
    for cos in COSTUMES:
        assert re.search(rf"\b{cos}: \{{", looks), cos
        if cos != "hoodie":   # the hoodie is the usual look (Animal.tsx headset + hood)
            assert f'case "{cos}"' in DISGUISE, cos
    for room in VILLAIN_SETS:
        if room != "callcentre":
            assert f'case "{room}": return <' in SETS, room
    # cheap to render: no SVG filters (the rim light stays a CSS drop-shadow), no real marks
    for src in (DISGUISE, SETS):
        assert "<filter" not in src and "feGaussianBlur" not in src and "feMorphology" not in src
    assert "상담실" in SETS   # the fake office's plate is a generic room name, never a company


def test_every_caller_shot_is_drawn_in_the_villain_set():
    """The call window, caller / solo / over-shoulder caller shots, the split panel, the aside and the twist on the fox
    all draw the scene's villain set (the cold open reuses the twist shot); the caller's desk is the set's prop."""
    assert "<CallCentreSet" not in CAST_SCENE
    assert CAST_SCENE.count("<VillainSetView set={c.villain}") >= 7
    assert '"#5FD3C8", monitor' not in CAST_SCENE and "VILLAIN[c.villain].rim" in CAST_SCENE
    assert 'kind === "ccDesk" ? VILLAIN[c.villain].prop' in CAST_SCENE
    assert "costume: costumeOf(c.cast, id)" in CAST_SCENE


# ------------------------------------------------------------------ the gate

def test_a_disguised_episode_passes():
    s = _drama(villain_set="fake_office")
    s.cast["fox"]["costume"] = "bank_suit"
    s.scenes[2].villain_set = "car"
    errors, warnings = validate(s)
    assert errors == [] and not [w for w in warnings if "costume" in w or "villain_set" in w], (errors, warnings)


def test_bad_costumes_and_rooms_are_errors():
    s = _drama()
    s.cast["fox"]["costume"] = "police"
    assert any("unknown costume 'police'" in e for e in _errors(s))
    s = _drama()
    s.cast["father"]["costume"] = "bank_suit"
    assert any("only caller characters" in e for e in _errors(s))
    s = _drama()
    s.cast["fox"]["costume"] = "bank_suit"
    s.cast["fox_inner"]["costume"] = "guru"
    assert any("inner voice wears 'guru'" in e for e in _errors(s))
    assert any("unknown villain_set 'bank'" in e for e in _errors(_drama(villain_set="bank")))
    s = _drama()
    s.scenes[1].villain_set = "jail"
    assert any("scene 2: unknown villain_set 'jail'" in e for e in _errors(s))


def test_costume_on_the_human_skin_warns():
    s = _drama(cast_style="")
    s.cast["fox"]["costume"] = "courier"
    assert any("animal skin only" in w for w in _warnings(s))


def test_the_inner_voice_wears_its_characters_costume():
    s = _drama()
    s.cast["fox"]["costume"] = "investigator"
    cast = cast_of(s)
    assert costume_of(cast, "fox_inner") == costume_of(cast, "fox") == "investigator"
    assert costume_of(cast, "father") == ""
    props = cast_props(s)
    assert props["fox"]["costume"] == props["fox_inner"]["costume"] == "investigator"
    assert "costume" not in props["father"]
    assert "costume" not in cast_props(_drama())["fox"]   # no costume: the usual look (unchanged props)


def test_props_carry_the_villain_set_per_scene():
    s = _drama(villain_set="studio")
    s.scenes[1].villain_set = "car"
    cast = cast_of(s)
    scenes = [scene_props(sc, "", 0.0, 2.0, 2.3, [], None, default_staging(sc, cast)) for sc in s.scenes]
    assert [sc.get("villainSet") for sc in build_props(s, scenes, "ch")["scenes"]] == ["studio", "car", "studio"]
    plain = _drama()
    assert all("villainSet" not in sc for sc in build_props(plain, scenes, "ch")["scenes"])


# ------------------------------------------------------------------ frame 0 and the previous episode

def test_first_frame_villain():
    assert first_frame_villain(_drama()) == ("scammer", "hoodie", "callcentre")   # the opening aside is the poster
    s = _drama(villain_set="car")
    s.cast["fox"]["costume"] = "investigator"
    assert first_frame_villain(s) == ("scammer", "investigator", "car")
    assert first_frame_villain(_drama(opening="call")) is None                     # the victim's close-up opens
    cold = _drama(opening="call", cold_open={"line": "어, 어어…?", "speaker": "fox", "seconds": 0.9, "stamp": "",
                                               "label": "", "tts": ""})
    cold.scenes[1].villain_set = "lecture_room"
    assert first_frame_villain(cold) == ("scammer", "hoodie", "lecture_room")      # the twist on the fox opens


def _write(dirpath: Path, s: Script, costume: str = "", villain: str = "") -> None:
    data = {"id": s.id, "source_video_id": "x", "title": s.title, "disclaimer": DISCLAIMER, "cast_style": "animal",
            "hook_title": s.hook_title, "sources": s.sources,
            "cast": {k: {**v, **({"costume": costume} if costume and k == "fox" else {})} for k, v in s.cast.items()},
            "scenes": [{"headline": sc.headline, "layout": sc.layout, "caller": sc.caller, "icon": sc.icon,
                        **({"staging": sc.staging} if sc.staging else {}), **({"twist": sc.twist} if sc.twist else {}),
                        **({"twist_on": sc.twist_on} if sc.twist_on else {}),
                        "lines": [{"speaker": x.speaker, "text": x.text} for x in sc.lines]} for sc in s.scenes]}
    if villain:
        data["villain_set"] = villain
    (dirpath / f"{s.id}.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


@pytest.mark.parametrize("prev_look,mine,warns", [
    (("", ""), ("", ""), True),                                  # both the usual hoodie in the call centre
    (("bank_suit", "fake_office"), ("bank_suit", "fake_office"), True),
    (("bank_suit", "fake_office"), ("investigator", "car"), False),
    (("bank_suit", "fake_office"), ("bank_suit", "car"), False),   # a new room is enough
])
def test_two_scheduled_episodes_in_a_row_do_not_open_on_the_same_fox(tmp_path, prev_look, mine, warns):
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    prev = _drama("2026-10-20-fox-a")
    _write(scripts, prev, *prev_look)
    schedule = tmp_path / "schedule.json"
    schedule.write_text(json.dumps({"entries": [{"date": "2026-10-20", "script": prev.id},
                                                {"date": "2026-10-21", "script": "2026-10-21-fox-b"}]}),
                        encoding="utf-8")
    me = _drama("2026-10-21-fox-b", villain_set=mine[1])
    if mine[0]:
        me.cast["fox"]["costume"] = mine[0]
    w = villain_repeat_warning(me, schedule, scripts, tmp_path / "log.json")
    assert bool(w) == warns, w
    if w:
        assert prev.id in w and "costume or villain_set" in w


def test_no_warning_when_either_episode_opens_on_the_family(tmp_path):
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    prev = _drama("2026-10-20-fox-a", opening="call")
    _write(scripts, prev)
    schedule = tmp_path / "schedule.json"
    schedule.write_text(json.dumps({"entries": [{"date": "2026-10-20", "script": prev.id},
                                                {"date": "2026-10-21", "script": "2026-10-21-fox-b"}]}),
                        encoding="utf-8")
    assert villain_repeat_warning(_drama("2026-10-21-fox-b"), schedule, scripts, tmp_path / "log.json") is None
    assert villain_repeat_warning(_drama("2026-10-21-fox-b", opening="call"), schedule, scripts,
                                  tmp_path / "log.json") is None


def test_the_scheduled_fox_episodes_are_recognised():
    """The live schedule: the two 영업비밀 pilots open on the fox's aside, fox #3 on the cold open's twist."""
    for sid in ("2026-10-12-fox-bank-income", "2026-10-12-fox-isolation", "2026-10-16-fox3-loan-block"):
        look = first_frame_villain(load_script(ROOT / "content" / "scripts" / f"{sid}.json"))
        assert look is not None and look[0] == "scammer", sid
    for sid in ("2026-10-12-mom-wins", "2026-10-15-ep2-compensation-sms", "2026-10-17-ep3-invest-ad"):
        assert first_frame_villain(load_script(ROOT / "content" / "scripts" / f"{sid}.json")) is None, sid
