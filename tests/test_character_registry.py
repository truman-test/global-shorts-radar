"""The character registry (owner decision 2026-10-14: characters are made per story): content/characters/<id>.json specs,
their checks (radar.production.characters), the script gate reading role_kind instead of fixed id lists, the resolved
spec in the props, and the TypeScript side (composition.json vocabulary, registry.ts, Species.tsx, a parametric
Animal.tsx) keeping every species inside the rig's head box and every body class inside the SD rules."""
import copy
import json
import re
from pathlib import Path

import pytest

from radar.production import characters as reg
from radar.production.remotion_render import cast_props
from radar.production.script import Line, Scene, Script, cast_of, default_staging, validate, victim_character

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "video" / "src"
COMP = json.loads((SRC / "composition.json").read_text(encoding="utf-8"))
TYPES = (SRC / "types.ts").read_text(encoding="utf-8")
ANIMAL = (SRC / "Animal.tsx").read_text(encoding="utf-8")
RIG = COMP["rig"]
FRAME = COMP["frame"]
HEAD_H = RIG["head"]["chin"] - RIG["head"]["top"]
HEAD_W = 2 * RIG["head"]["rx"]
NEW = ("cat_guard", "rabbit_teller", "raccoon_neighbor")
DISCLAIMER = "※ 실제 수법을 바탕으로 각색한 재연입니다"


def _ts_union(name: str) -> list[str]:
    m = re.search(rf"export type {name} =([^;]+);", TYPES)
    assert m, name
    return re.findall(r'"([A-Za-z_]+)"', m.group(1))


def _spec(**over) -> dict:
    s = copy.deepcopy(reg.registry()["cat_guard"])
    s.update(over)
    return s


# ------------------------------------------------------------------ the folder and one vocabulary

def test_the_registry_is_valid_and_keeps_the_legacy_cast():
    errors, warnings = reg.check_dir()
    assert errors == [] and warnings == [], (errors, warnings)
    ids = reg.character_ids()
    assert ids[:7] == reg.LEGACY == tuple(COMP["characters"])
    for cid in NEW:
        assert cid in ids
    for f in (ROOT / "content" / "characters").glob("*.json"):
        assert json.loads(f.read_text(encoding="utf-8"))["id"] == f.stem
    assert (ROOT / "content" / "characters" / "README.md").exists()


def test_vocabulary_is_the_same_in_python_json_and_typescript():
    assert list(reg.SPECIES) == COMP["species"] == _ts_union("Species")
    assert list(reg.RESERVED_SPECIES) == COMP["reservedSpecies"] == ["hedgehog"]
    assert list(reg.ROLE_KINDS) == COMP["roleKinds"] == _ts_union("RoleKind")
    assert list(reg.OUTFITS) == COMP["outfits"] == _ts_union("OutfitType")
    assert list(reg.PROPS) == COMP["characterProps"] == _ts_union("CharacterProp")
    assert set(COMP["bodyClasses"]) == set(reg.HEIGHTS)


def test_the_legacy_kinds_match_the_old_lists():
    """The rules now read role_kind; for the legacy cast it says what the old FAMILY / CALLERS lists said."""
    assert [c for c in reg.LEGACY if reg.is_family(c)] == COMP["family"]
    assert [c for c in reg.LEGACY if reg.is_caller(c)] == COMP["callers"]
    assert [c for c in reg.LEGACY if reg.is_presenter(c)] == ["ad"]
    assert [c for c in reg.LEGACY if reg.can_disguise(c)] == ["scammer", "fake_banker", "ad"]
    assert all(reg.has_human_skin(c) for c in reg.LEGACY) and not any(reg.has_human_skin(c) for c in NEW)
    # the legacy bodies are pinned (pixel-identical renders); new characters use a height class
    for c in reg.LEGACY:
        assert reg.spec_of(c)["body"]["pin"] == c
    for c in NEW:
        assert "pin" not in reg.spec_of(c)["body"]


def test_every_cast_character_of_the_existing_scripts_is_in_the_registry():
    for f in (ROOT / "content" / "scripts").glob("*.json"):
        data = json.loads(f.read_text(encoding="utf-8"))
        for entry in (data.get("cast") or {}).values():
            if isinstance(entry, dict) and entry.get("character"):
                assert entry["character"] in reg.character_ids(), (f.name, entry["character"])


# ------------------------------------------------------------------ the spec checks

@pytest.mark.parametrize("over,needle", [
    ({"species": "hedgehog"}, "reserved for 도치"),
    ({"species": "dragon"}, "unknown species"),
    ({"role_kind": "hero"}, "unknown role_kind"),
    ({"voice": "X9"}, "unknown voice"),
    ({"label": ""}, "label needs"),
    ({"legacy": True}, "legacy is only for"),
    ({"body": {"height": "elder", "build": "regular", "pin": "father"}}, "body.pin"),
    ({"body": {"height": "giant", "build": "regular"}}, "body.height"),
    ({"role_kind": "family", "body": {"height": "tall", "build": "slim"}}, "a family character is elder or adult"),
    ({"markings": "urajiro"}, "drawn on dog only"),
    ({"eyes": "laser"}, "unknown eyes"),
    ({"hat": {"style": "helmet", "color": "#56625D"}}, "hat is null"),
    ({"prop": "badge"}, "unknown prop"),
    ({"acting": {"habit": "angry"}}, "acting.habit"),
])
def test_bad_specs_are_errors(over, needle):
    errors, _ = reg.spec_problems(_spec(**over), "cat_guard")
    assert any(needle in e for e in errors), errors


def test_ids_must_match_the_file_and_palettes_stay_muted():
    errors, _ = reg.spec_problems(_spec(), "cat_guard2")
    assert any("must equal the file name" in e for e in errors)
    candy = _spec()
    candy["palette"] = {**candy["palette"], "fur": "#FF69B4"}
    candy["outfit"] = {**candy["outfit"], "top": "#E02020"}
    _, warnings = reg.spec_problems(candy, "cat_guard")
    assert any("candy" in w and "palette.fur" in w for w in warnings)
    assert any("reads as red" in w and "outfit.top" in w for w in warnings)


def test_the_new_characters_are_distinct_from_each_other_and_the_family():
    on_screen = list(NEW) + ["father", "mother", "daughter", "son", "scammer", "fake_banker"]
    for i, a in enumerate(on_screen):
        for b in on_screen[i + 1:]:
            assert not reg.look_alike(a, b), (a, b)
    assert {reg.spec_of(c)["species"] for c in NEW} == {"cat", "rabbit", "raccoon"}
    # one prop each that says who they are, a voice suggestion each, all bystanders / helpers
    for c in NEW:
        s = reg.spec_of(c)
        assert s["prop"] != "none" and s["voice"] and s["role_kind"] == "other"
    assert reg.look_alike("cat_guard", "cat_guard") is False


# ------------------------------------------------------------------ geometry: head box and SD bodies

def test_every_species_keeps_to_the_rig_head_box():
    a, head = COMP["animal"], RIG["head"]
    assert set(a["speciesBox"]) == set(COMP["species"]) == set(a["shockedMouth"])
    for sp, box in a["speciesBox"].items():
        assert box["top"] >= head["top"], sp                   # ears / hair / cap never above the hair line
        assert box["halfWidth"] <= head["rx"] + 34, sp         # the face box the composition rules check
        assert box["jowl"] <= head["chin"], sp                 # the jaw never lower than the chin
        assert 0.3 <= 2 * a["shockedMouth"][sp] / a["faceWidth"] <= 0.4, sp
    species = (SRC / "Species.tsx").read_text(encoding="utf-8")
    for sp in COMP["species"]:
        assert re.search(rf"^\s+{sp}: headPath\(", species, re.M), sp   # a head for every species
        assert f'case "{sp}"' in species, sp                             # its ears / face


def _bodies():
    for h, c in COMP["bodyClasses"].items():
        for build in reg.BUILDS:
            w = c[build]
            b = {**w, "waistY": c["waistY"], "hemY": c["hemY"], "crotch": c["crotch"], "sole": c["sole"]}
            for skirt in (False, True):
                bb = dict(b)
                if skirt:
                    bb["skirt"] = [c["crotch"] + 138, min(190, w["hip"] + 12)]
                yield h, build, bb


@pytest.mark.parametrize("height,build,b", list(_bodies()), ids=lambda v: v if isinstance(v, str) else "")
def test_body_classes_are_sd_proportions(height, build, b):
    tall = {"elder": 2.7, "adult": 2.9, "tall": 3.0}[height]
    assert 0.6 <= (b["waistY"] - RIG["head"]["chin"]) / HEAD_H <= 0.75
    widest = max(b["sh"], b["w"], b["hip"], (b.get("skirt") or [0, 0])[1])
    assert 1.05 <= 2 * widest / HEAD_W <= 1.2, round(2 * widest / HEAD_W, 3)
    assert abs((b["sole"] - RIG["head"]["top"]) / HEAD_H - tall) <= 0.05
    assert b["waistY"] < b["hemY"] < b["crotch"] < b["sole"] and b["legX"] > b["legW"]
    assert b["sole"] in {v["sole"] for v in COMP["bodies"].values()}   # the same floor lines as the legacy bodies


def _kinds_of(who: str) -> tuple[str, ...]:
    return {"victim": ("family",), "other": ("family", "other"), "caller": ("caller",), "presenter": ("presenter",)}[who]


def _soles(kinds) -> list[int]:
    """Every sole a character of these kinds can have (any height class it may use)."""
    heights = [h for h in reg.HEIGHTS if not ("family" in kinds and len(kinds) == 1 and h == "tall")]
    return [COMP["bodyClasses"][h]["sole"] for h in heights]


def test_full_shots_keep_the_feet_of_any_registry_character_above_the_ui_line():
    """A full shot shows the feet of every character that may stand on its spot, whatever height class the
    character designer picks (family: elder or adult; the others any)."""
    line = COMP["bodyRule"]["line"]
    for name, spec in COMP["stagings_spec"].items():
        for shot, s in spec["shots"].items():
            if s.get("size") != "full":
                continue
            for spot in s["chars"]:
                n = spot["eyeY"] - RIG["eyeY"] * spot["k"]
                for sole in _soles(_kinds_of(spot["who"])):
                    assert n + sole * spot["k"] <= line, (name, shot, spot["who"], sole)


# ------------------------------------------------------------------ scripts cast registry characters

def _drama(**cast_over) -> Script:
    """A call where the victim's neighbour (a new registry character) steps in."""
    lines = [Line("fox", "아버님, 연소득 기준 한도 나왔어요."), Line("father", "내 소득을 어떻게 알아요?"),
             Line("guard", "어르신, 그 전화 끊고 은행에 직접 거세요.")]
    scenes = [Scene("", "소득 맞히는 전화", "phone", layout="call", caller="모르는 번호", lines=lines)]
    for sc in scenes:
        sc.narration = " ".join(x.text for x in sc.lines)
    cast = {"fox": {"voice": "M2", "label": "여우", "role": "scammer", "character": "scammer"},
            "father": {"voice": "M1", "label": "아버지", "role": "victim", "character": "father"},
            "guard": {"voice": "M4", "label": "경비", "role": "neutral", "character": "cat_guard"}}
    for k, v in cast_over.items():
        cast[k] = {**cast.get(k, {}), **v}
    return Script(id="2026-10-20-registry-test", source_video_id="x", title="은행 사칭 전화, 경비 할아버지의 한마디",
                  description="", tags=[], disclaimer=DISCLAIMER, scenes=scenes, sources=[{"url": "https://example.org"}],
                  cast=cast, cast_style="animal", hook_title="소득 맞히는\n은행 전화")


def test_a_script_may_cast_a_registry_character():
    s = _drama()
    errors, warnings = validate(s, allow_unverified=True)
    assert not [e for e in errors if "character" in e or "cast" in e], errors
    assert not [w for w in warnings if "registry" in w or "look alike" in w], warnings
    assert victim_character(cast_of(s)) == "father" and default_staging(s.scenes[0], cast_of(s)) == "pip_call"
    props = cast_props(s)
    spec = {k: v for k, v in reg.spec_of("cat_guard").items() if k != "notes"}
    assert props["guard"]["character"] == "cat_guard" and props["guard"]["spec"] == spec
    assert props["father"]["spec"]["id"] == "father"   # the legacy cast gets its spec too (one code path)


def test_unknown_ids_costumes_and_the_human_skin():
    s = _drama(guard={"character": "grandpa_owl"})
    assert any("unknown character 'grandpa_owl'" in e and "content/characters" in e
               for e in validate(s, allow_unverified=True)[0])
    s = _drama(guard={"costume": "bank_suit"})
    assert any("only caller characters" in e for e in validate(s, allow_unverified=True)[0])
    s = _drama()
    s.cast_style = "human"
    assert any("cat_guard" in w and "animal skin only" in w for w in validate(s, allow_unverified=True)[1])


def test_role_kind_drives_the_rules():
    """A new family character can be the victim, a new caller fills the caller spot, a bystander never does."""
    s = _drama(guard={"role": "victim"}, father={"role": "neutral"})
    assert victim_character(cast_of(s)) == "father"          # cat_guard is "other": never the victim
    s = _drama(fox={"character": "cat_guard"})
    s.scenes[0].staging = "pip_call"
    assert any("needs a caller character" in e for e in validate(s, allow_unverified=True)[0])


# ------------------------------------------------------------------ the TypeScript side

def test_the_renderer_is_parametric_and_reads_the_registry():
    registry_ts = (SRC / "registry.ts").read_text(encoding="utf-8")
    assert 'require as unknown as' in registry_ts and '"../../content/characters"' in registry_ts
    assert "given ?? (id ? REGISTRY[id] : undefined)" in registry_ts       # props spec wins over the bundled file
    # no character id is special-cased in the animal skin or in the acting rules any more
    assert not re.search(r'p\.id === "', ANIMAL), "Animal.tsx must read the spec, not the id"
    assert "const S = specOf(p.id, p.spec);" in ANIMAL
    rig = (SRC / "rig.ts").read_text(encoding="utf-8")
    assert not re.search(r'=== "(scammer|fake_banker|ad|father|mother)"', rig)
    assert "kindOf(m) === \"family\"" in rig and "acting?.habit" in rig
    cast_scene = (SRC / "CastScene.tsx").read_text(encoding="utf-8")
    assert '=== "fake_banker"' not in cast_scene and "halfShadow" in cast_scene
    actor = (SRC / "Actor.tsx").read_text(encoding="utf-8")
    assert "hasHumanSkin(specOf(props.pose.id, props.pose.spec))" in actor
    assert re.search(r"spec\?: CharacterSpec", TYPES) and re.search(r"character\?: string;", TYPES)
    root = (SRC / "Root.tsx").read_text(encoding="utf-8")
    assert 'id="CharacterSheet"' in root
