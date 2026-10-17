"""The 도치 stamp ending (2026-10-17 design re-review: the white end card with a green check read as a public-notice
poster, and five of six videos ended on the same frame). Every drama now ends with 도치 popping up from behind the desk
edge in the story's last ~1.2 s and stamping a red "생존!" (the twist stamp's style) on the picture; no text card, no
sound; the poster tail (= frame 0) never shows it. The old script field `end_card` is accepted and ignored with a
warning (the sharing line goes to the pinned comment); the retired scoreboard stays retired (video/src/Packaging.tsx
DochiEnding, composition.json packaging.ending)."""
import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

from radar.production.remotion_render import POSTER_TAIL_MS, build_props, scene_props
from radar.production.script import (END_CARD_RETIRED, ENDING_STAMP, ScriptError, cast_of, default_staging,
                                     load_script, validate)
from tests.test_series_features import _drama

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "video" / "src"
COMP = json.loads((SRC / "composition.json").read_text(encoding="utf-8"))
TOKENS = json.loads((SRC / "tokens.json").read_text(encoding="utf-8"))
FRAME, PACK = COMP["frame"], COMP["packaging"]
E = PACK["ending"]
FPS = 30
SHORT = (SRC / "Short.tsx").read_text(encoding="utf-8")
PACKAGING = (SRC / "Packaging.tsx").read_text(encoding="utf-8")
SERIES_SCRIPTS = ("2026-10-15-ep2-compensation-sms.json", "2026-10-16-fox3-loan-block.json",
                  "2026-10-17-ep3-invest-ad.json")


def _props(s):
    cast = cast_of(s)
    scenes = [scene_props(sc, "", 0.0, 2.0, 2.3, [], None, default_staging(sc, cast)) for sc in s.scenes]
    return build_props(s, scenes, "디지털 생존노트")


# ------------------------------------------------------------------ the script field is retired

@pytest.mark.parametrize("card", [{"line1": "오늘도 생존 성공"}, {"line2": "친구에게도 보내 주세요"}, False,
                                  "오늘도 생존 성공", {"line3": "추가 줄", "line1": 3}])
def test_end_card_is_accepted_and_ignored_with_a_warning(card):
    errors, warnings = validate(_drama(end_card=card))
    assert errors == [], errors
    assert END_CARD_RETIRED in warnings
    assert "endCard" not in _props(_drama(end_card=card))


def test_no_end_card_no_warning_and_old_files_still_load(tmp_path):
    assert END_CARD_RETIRED not in validate(_drama())[1]
    data = json.loads((ROOT / "content" / "scripts" / SERIES_SCRIPTS[0]).read_text(encoding="utf-8"))
    data["end_card"] = "오늘도 생존 성공"                 # once a type error: now any value loads and only warns
    p = tmp_path / "s.json"
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    errors, warnings = validate(load_script(p))
    assert errors == [] and END_CARD_RETIRED in warnings
    explainer = load_script(ROOT / "content" / "scripts" / "2026-10-08-zero-click.json")
    assert "endCard" not in build_props(explainer, [], "ch")


@pytest.mark.parametrize("name", SERIES_SCRIPTS)
def test_the_series_scripts_carry_no_end_card_or_score(name):
    data = json.loads((ROOT / "content" / "scripts" / name).read_text(encoding="utf-8"))
    assert "score" not in data
    errors, warnings = validate(load_script(ROOT / "content" / "scripts" / name))
    assert errors == [] and not any("score" in w for w in warnings), (errors, warnings)


# ------------------------------------------------------------------ the retired scoreboard and card in the renderer

def test_an_old_score_field_is_only_a_warning():
    for score in ({"home": 4, "fox": 0}, {"home": 0}, "3:0", 7):
        errors, warnings = validate(_drama(score=score))
        assert errors == [], (score, errors)
        assert any("score is no longer shown" in w for w in warnings), warnings
    assert "score" not in _props(_drama(score={"home": 4, "fox": 0}))


def test_no_scoreboard_or_end_card_left_in_the_renderer():
    types = (SRC / "types.ts").read_text(encoding="utf-8")
    art = (SRC / "ChannelArt.tsx").read_text(encoding="utf-8")
    for src in (PACKAGING, SHORT, types, art):
        assert "SCORE_LABELS" not in src and "DigitTile" not in src and "ScoreChip" not in src
        assert "props.score" not in src and "score?:" not in src
    assert "score" not in PACK and "score" not in TOKENS["drama"] and "endCard" not in PACK
    for gone in ("<EndCard", "export const EndCard", "END_CARD", "endCardText", "오늘도 생존 성공", "lucide-react\").Check"):
        assert gone not in PACKAGING and gone not in SHORT, gone
    assert "Check," not in PACKAGING.split("\n", 20)[0:20].__str__()        # no green check icon imported
    assert "endCard?: EndCardProps" in types and "ignored" in types.split("endCard?: EndCardProps")[1][:80]


# ------------------------------------------------------------------ the 도치 stamp ending

def test_ending_is_wired_in_every_drama_and_ends_where_the_tail_begins():
    assert "export const DochiEnding" in PACKAGING and "<DochiEnding frames={end - endingFrom} alt={endingAlt} />" in SHORT
    assert "end - E.frames" in SHORT and "E.afterStamp" in SHORT and "const E = PACK.ending;" in SHORT
    assert "<Sequence from={endingFrom} durationInFrames={end - endingFrom}>" in SHORT
    assert "if (!n || !dramaPack) return undefined;" in SHORT                  # no props needed: every drama
    tail = SHORT[SHORT.index("Poster tail"):SHORT.index("{props.cta && n ?")]
    assert "DochiEnding" not in tail
    # drawn under the captions and the speaker chip (they come later in the tree)
    assert SHORT.index("<DochiEnding") < SHORT.index("<Captions pages={scene.pages} instantFirst={i === 0} />")
    ending = PACKAGING[PACKAGING.index("export const DochiEnding"):PACKAGING.index("/** The cold open's rewind chip")]
    assert "<Audio" not in ending and "Sfx" not in ending                       # no sound over the last line
    assert "<Dochi " in ending and "<Stamp text={E.text}" in ending and "clipY: E.clipY" in ending
    assert "useCurrentFrame" in ending and "useState" not in ending            # a pure function of the frame


def test_ending_text_and_stamp_style():
    assert E["text"] == ENDING_STAMP == "생존!"
    assert "stampLook(ENDING.text)" in PACKAGING                                # the twist stamp's style
    assert 'twist_face_of' in (ROOT / "src" / "radar" / "production" / "remotion_render.py").read_text(encoding="utf-8")


def test_ending_timing_is_short_and_calm():
    assert 30 <= E["frames"] <= 45 and E["minFrames"] <= E["frames"]            # ~1.2 s before the tail
    assert E["rise"] <= 15 and E["stampAt"] < E["frames"] - E["outFrames"] and E["outFrames"] <= 8
    assert E["rise"] <= E["stampAt"] - E["swing"]                               # up first, then the stamp


def _stamp_box(spot):
    """Mirror of Packaging.tsx endingStampLook: the stamp's box for "생존!" at the spot's scale (unrotated)."""
    st = COMP["stagings_spec"]["twist_closeup"]["stamp"]
    v = st["variants"]["short"]                                                 # 2.5 visible characters -> the box
    units = sum(0.3 if ch == " " else 0.45 if ch in "!?.,~" else 0.95 for ch in E["text"])
    w, h = (units * v["size"] + 0.9 * v["size"]) * spot["scale"], 1.75 * v["size"] * spot["scale"]
    return spot["x"] - w / 2, spot["y"] - h / 2, spot["x"] + w / 2, spot["y"] + h / 2


def test_dochi_pops_up_at_the_spike_slot_clear_of_the_safe_zones():
    sp = PACK["spike"]
    assert (E["x"], E["feetY"], E["size"]) == (sp["x"], sp["feetY"], sp["size"])   # the same family-side spot
    assert E["feetY"] + 0.06 * E["size"] < FRAME["captionBand"][0] and E["feetY"] < FRAME["bottomSafe"]
    assert E["x"] + 0.6 * E["size"] < FRAME["rightColumn"]["x"]
    assert E["feetY"] < E["clipY"] <= FRAME["captionBand"][0]                    # rises from behind the desk edge, never into the captions


def test_ending_stamp_sits_on_the_chest_zone_or_the_top_right_corner():
    chip_top = PACK["speakerChip"]["top"]
    l, t, r, b = _stamp_box(E["stamp"])
    assert b <= chip_top and l >= E["x"] + 0.6 * E["size"] and r < FRAME["rightColumn"]["x"]   # beside 도치, under the chip
    assert t > PACK["safeTop"]
    l, t, r, b = _stamp_box(E["stampAlt"])                                      # when the twist stamp holds the chest
    # the right column only matters where the box reaches it
    assert t >= PACK["safeTop"] and r <= FRAME["w"] - 16 and (b < FRAME["rightColumn"]["y"][0] or r < FRAME["rightColumn"]["x"])
    assert "endingAlt = n > 0 && Boolean(props.scenes[n - 1].twist)" in SHORT


# ------------------------------------------------------------------ rendered (slow)

def _render_props(**over) -> dict:
    page = [{"startMs": 0, "endMs": 1500, "words": [{"text": "테스트", "startMs": 0, "endMs": 700}]}]
    props = {
        "channel": "디지털 생존노트", "disclaimer": "※ 테스트용 재연입니다", "sfx": False, "music": None,
        "posterTailMs": POSTER_TAIL_MS, "theme": "paper", "episode": "test", "seed": 7, "packaging": "drama",
        "hookTitle": ["모르는 번호", "먼저 확인"], "seriesChip": "진돗개네 역관광 EP2",
        "scenes": [
            {"layout": "card", "audio": "", "leadInMs": 0, "speechMs": 2500, "durationMs": 3000, "pages": page,
             "headline": "모르는 번호", "sub": "", "icon": "phone", "accent": "red", "mascot": False},
            {"layout": "card", "audio": "", "leadInMs": 0, "speechMs": 2500, "durationMs": 3000, "pages": page,
             "headline": "먼저 확인", "sub": "", "icon": "check", "accent": "green", "mascot": False},
        ],
    }
    props.update(over)
    return {k: v for k, v in props.items() if v is not None}


@pytest.mark.skipif(os.environ.get("RADAR_TEST_REMOTION") != "1", reason="slow: set RADAR_TEST_REMOTION=1 to render")
def test_rendered_ending_shows_before_the_tail_only(tmp_path):
    Image = pytest.importorskip("PIL.Image")
    ImageChops = pytest.importorskip("PIL.ImageChops")
    npx = shutil.which("npx") or shutil.which("npx.cmd")
    if not npx or not (ROOT / "video" / "node_modules" / "remotion").is_dir():
        pytest.skip("Remotion is not installed")
    end = sum(round(s["durationMs"] / 1000 * FPS) for s in _render_props()["scenes"])
    last = end + round(POSTER_TAIL_MS / 1000 * FPS) - 1

    def still(name: str, props: dict, frame: int):
        pp = tmp_path / f"{name}.json"
        pp.write_text(json.dumps(props, ensure_ascii=False), encoding="utf-8")
        out = tmp_path / f"{name}_{frame}.png"
        r = subprocess.run([npx, "remotion", "still", "src/index.ts", "Short", str(out), f"--props={pp}",
                            f"--frame={frame}", "--log=error"], cwd=ROOT / "video", capture_output=True, text=True,
                           encoding="utf-8", errors="replace")
        assert r.returncode == 0, r.stderr[-1500:]
        return Image.open(out).convert("RGB")

    props = _render_props()
    band = (0, 900, 930, 1250)                                                  # 도치 and the stamp, above the captions
    before, during = still("a", props, end - 60), still("b", props, end - 12)
    assert ImageChops.difference(before.crop(band), during.crop(band)).getbbox() is not None
    # the tail is frame 0 again (below the progress bar)
    first, tail = still("c", props, 0), still("d", props, last)
    below_bar = (0, 14, 1080, 1920)
    assert ImageChops.difference(first.crop(below_bar), tail.crop(below_bar)).getbbox() is None
