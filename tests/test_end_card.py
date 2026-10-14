"""The drama end card and the retired scoreboard (owner decision 2026-10-14: no score counting anywhere; the scammer
gets caught and the family survives). Every drama ends with a small two-line card under the title box in the story's
last ~1.5 s ("오늘도 생존 성공" / "부모님 단톡방에 공유해 주세요", script end_card overrides), never in the poster tail;
a script's old "score" field is ignored with a warning (video/src/Packaging.tsx EndCard, composition.json
packaging.endCard, tokens.json drama.endCard)."""
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from radar.production.remotion_render import POSTER_TAIL_MS, build_props, scene_props
from radar.production.script import (END_CARD, END_CARD_LINE_MAX_CHARS, ScriptError, cast_of, default_staging,
                                     end_card_line, end_card_of, load_script, validate)
from tests.test_design_tokens import GRAPHIC_MIN, TEXT_MIN, WARNING_MIN, contrast
from tests.test_series_features import _drama

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "video" / "src"
COMP = json.loads((SRC / "composition.json").read_text(encoding="utf-8"))
TOKENS = json.loads((SRC / "tokens.json").read_text(encoding="utf-8"))
FRAME, PACK = COMP["frame"], COMP["packaging"]
FPS = 30
SERIES_SCRIPTS = ("2026-10-15-ep2-compensation-sms.json", "2026-10-16-fox3-loan-block.json",
                  "2026-10-17-ep3-invest-ad.json")


def _props(s):
    cast = cast_of(s)
    scenes = [scene_props(sc, "", 0.0, 2.0, 2.3, [], None, default_staging(sc, cast)) for sc in s.scenes]
    return build_props(s, scenes, "디지털 생존노트")


# ------------------------------------------------------------------ the end card's text

def test_defaults_and_overrides():
    assert END_CARD == {"line1": "오늘도 생존 성공", "line2": "부모님 단톡방에 공유해 주세요"}
    assert all(len(v) <= END_CARD_LINE_MAX_CHARS for v in END_CARD.values())
    assert end_card_of(_drama()) == END_CARD                                   # every drama, no field needed
    assert end_card_of(_drama(end_card={"line2": "친구에게도 보내 주세요"})) == {
        "line1": END_CARD["line1"], "line2": "친구에게도 보내 주세요"}
    assert end_card_of(_drama(end_card={"line1": "오늘도 생존 성공 ✔"}))["line1"] == "오늘도 생존 성공"   # drawn check
    assert end_card_line(" 살았다 ✅ ") == "살았다"
    assert end_card_of(_drama(end_card=False)) is None                        # opt out
    explainer = load_script(ROOT / "content" / "scripts" / "2026-10-08-zero-click.json")
    assert end_card_of(explainer) is None
    assert "endCard" not in build_props(explainer, [], "ch")
    packaging = (SRC / "Packaging.tsx").read_text(encoding="utf-8")
    assert f'END_CARD = {{line1: "{END_CARD["line1"]}", line2: "{END_CARD["line2"]}"}}' in packaging


def test_props_carry_the_end_card_and_never_a_score():
    props = _props(_drama(score={"home": 4, "fox": 0}))
    assert props["endCard"] == END_CARD and "score" not in props
    assert "endCard" not in _props(_drama(end_card=False))


@pytest.mark.parametrize("card,problem", [
    ({"line1": "오늘도 우리 가족은 무사히 생존 성공"}, "longer than 16"),
    ({"line2": ""}, "non-empty"),
    ({"line2": 3}, "non-empty"),
    ({"line3": "추가 줄"}, "unknown keys"),
    ({"line2": "토스로 공유해 주세요"}, "real brand"),
    ({"line2": "010-1234-5678로 문의"}, "real-looking number"),
])
def test_end_card_gate(card, problem):
    errors = validate(_drama(end_card=card))[0]
    assert any(problem in e for e in errors), errors


def test_end_card_that_reads_like_a_score_warns():
    warnings = validate(_drama(end_card={"line1": "벌써 5판 생존"}))[1]
    assert any("reads like a score" in w for w in warnings)
    assert not any("reads like a score" in w for w in validate(_drama())[1])


def test_end_card_must_be_an_object(tmp_path):
    data = json.loads((ROOT / "content" / "scripts" / SERIES_SCRIPTS[0]).read_text(encoding="utf-8"))
    data["end_card"] = "오늘도 생존 성공"
    p = tmp_path / "s.json"
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    with pytest.raises(ScriptError):
        load_script(p)
    data["end_card"] = False
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    assert end_card_of(load_script(p)) is None


# ------------------------------------------------------------------ the retired scoreboard

def test_an_old_score_field_is_only_a_warning(tmp_path):
    for score in ({"home": 4, "fox": 0}, {"home": 0}, "3:0", 7):
        errors, warnings = validate(_drama(score=score))
        assert errors == [], (score, errors)
        assert any("score is no longer shown" in w for w in warnings), warnings
    data = json.loads((ROOT / "content" / "scripts" / SERIES_SCRIPTS[0]).read_text(encoding="utf-8"))
    data["score"] = {"home": 4, "fox": 0}
    p = tmp_path / "old.json"
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    errors, warnings = validate(load_script(p))
    assert errors == [] and any("score is no longer shown" in w for w in warnings)


@pytest.mark.parametrize("name", SERIES_SCRIPTS)
def test_the_series_scripts_carry_no_score(name):
    data = json.loads((ROOT / "content" / "scripts" / name).read_text(encoding="utf-8"))
    assert "score" not in data
    errors, warnings = validate(load_script(ROOT / "content" / "scripts" / name))
    assert errors == [] and not any("score" in w for w in warnings), (errors, warnings)


def test_no_scoreboard_left_in_the_renderer():
    packaging = (SRC / "Packaging.tsx").read_text(encoding="utf-8")
    short = (SRC / "Short.tsx").read_text(encoding="utf-8")
    types = (SRC / "types.ts").read_text(encoding="utf-8")
    art = (SRC / "ChannelArt.tsx").read_text(encoding="utf-8")
    for src in (packaging, short, types, art):
        assert "SCORE_LABELS" not in src and "DigitTile" not in src and "ScoreChip" not in src
        assert "props.score" not in src and "score?:" not in src
    assert "score" not in PACK and "score" not in TOKENS["drama"]
    assert "endCard?: EndCardProps" in types


# ------------------------------------------------------------------ geometry, timing, colours

def test_end_card_sits_under_the_title_clear_of_the_safe_zones():
    E, t = PACK["endCard"], PACK["title"]
    title_bottom = t["top"] + t["maxLines"] * t["lineH"] + 2 * (t["padY"] + t["border"])
    top = title_bottom + E["gap"]
    height = 2 * (E["padY"] + E["border"]) + max(E["icon"], E["font1"] * 1.15) + E["gap2"] + E["font2"] * 1.2
    assert top > title_bottom and top + height + 30 < FRAME["eyeBand"][0]       # above the faces' eye line
    assert top + height < FRAME["captionBand"][0] and top + height < FRAME["bottomSafe"]
    assert top + height < FRAME["rightColumn"]["y"][0]                          # above the YouTube buttons
    # the default lines fit one line each, centred, inside the side margins
    hangul = lambda s: sum(0.3 if c == " " else 0.98 for c in s)
    w1 = hangul(END_CARD["line1"]) * E["font1"] + E["icon"] + 12
    w2 = hangul(END_CARD["line2"]) * E["font2"]
    width = max(w1, w2) + 2 * (E["padX"] + E["border"])
    assert width <= FRAME["w"] - 2 * E["margin"]
    assert E["font1"] >= 36 and E["font2"] >= 28                                # readable on a phone
    assert E["maxChars"] == END_CARD_LINE_MAX_CHARS


def test_end_card_timing_is_short_and_calm():
    E = PACK["endCard"]
    assert E["frames"] == 45 and E["minFrames"] <= E["frames"]                    # ~1.5 s before the tail
    assert 8 <= E["inFrames"] <= 15 and E["checkAt"] < E["inFrames"] and E["outFrames"] <= 8
    short = (SRC / "Short.tsx").read_text(encoding="utf-8")
    assert "end - E.frames" in short and "E.afterStamp" in short
    assert "<Sequence from={endCardFrom} durationInFrames={end - endCardFrom}>" in short    # ends where the tail starts
    tail = short[short.index("Poster tail"):short.index("{props.cta && n ?")]
    assert "EndCard" not in tail
    packaging = (SRC / "Packaging.tsx").read_text(encoding="utf-8")
    card = packaging[packaging.index("export const EndCard"):packaging.index("/** The cold open's rewind chip")]
    assert "<Audio" not in card and "Sfx" not in card                            # no sound over the last line


def test_end_card_colours():
    c = TOKENS["drama"]["endCard"]
    assert contrast(c["ink"], c["bg"]) >= WARNING_MIN
    assert contrast(c["sub"], c["bg"]) >= TEXT_MIN
    assert contrast(c["checkInk"], c["check"]) >= TEXT_MIN
    assert contrast(c["check"], c["bg"]) >= GRAPHIC_MIN and contrast(c["border"], c["bg"]) >= GRAPHIC_MIN
    assert c["check"] == TOKENS["tones"]["safe"]["solid"]                        # the safe tone, the one accent


# ------------------------------------------------------------------ rendered (slow)

def _render_props(**over) -> dict:
    page = [{"startMs": 0, "endMs": 1500, "words": [{"text": "테스트", "startMs": 0, "endMs": 700}]}]
    props = {
        "channel": "디지털 생존노트", "disclaimer": "※ 테스트용 재연입니다", "sfx": False, "music": None,
        "posterTailMs": POSTER_TAIL_MS, "theme": "paper", "episode": "test", "seed": 7, "packaging": "drama",
        "hookTitle": ["모르는 번호", "먼저 확인"], "seriesChip": "진돗개네 역관광 EP2", "endCard": dict(END_CARD),
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
def test_rendered_end_card_shows_before_the_tail_only(tmp_path):
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

    def mean_diff(a, b, box):
        h = ImageChops.difference(a.crop(box), b.crop(box)).convert("L").histogram()
        return sum(v * n for v, n in enumerate(h)) / max(1, sum(h))

    on, off = _render_props(), _render_props(endCard=None)
    band = (0, 370, 1080, 560)                                                  # under the title box
    assert mean_diff(still("on", on, end - 12), still("off", off, end - 12), band) > 3
    assert ImageChops.difference(still("on", on, end - 60), still("off", off, end - 60)).getbbox() is None
    # the tail is frame 0 again (below the progress bar) and never shows the card
    first, tail = still("on", on, 0), still("on", on, last)
    below_bar = (0, 14, 1080, 1920)
    assert ImageChops.difference(first.crop(below_bar), tail.crop(below_bar)).getbbox() is None
    assert ImageChops.difference(tail, still("off", off, last)).getbbox() is None
