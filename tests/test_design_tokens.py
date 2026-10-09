"""Contrast gate for the design tokens (video/src/tokens.json), WCAG 2.2 relative luminance.

Captions >= 4.5:1 and warning text >= 7:1 against the background they actually sit on, for every stage; all other
text >= 4.5:1. Backgrounds are composited the way the page draws them (translucent panels over each stop of the
stage gradient, the stage's pattern lines and accent glows at their strongest).
"""
import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TOKENS = json.loads((ROOT / "video" / "src" / "tokens.json").read_text(encoding="utf-8"))
STAGES = TOKENS["stages"]
NOTE, CAPTION, BRAND = TOKENS["note"], TOKENS["caption"], TOKENS["brand"]
TONES = {**TOKENS["tones"], **{f"category:{k}": v for k, v in TOKENS["categories"].items()}}

CAPTION_MIN, WARNING_MIN, TEXT_MIN = 4.5, 7.0, 4.5


def rgba(c: str) -> tuple[float, float, float, float]:
    c = c.strip()
    if c.startswith("#"):
        h = c[1:]
        if len(h) == 8:
            return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (int(h[6:8], 16) / 255,)
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (1.0,)
    m = re.match(r"rgba?\(([^)]+)\)", c)
    parts = [float(p) for p in m.group(1).split(",")]
    return (parts[0], parts[1], parts[2], parts[3] if len(parts) > 3 else 1.0)


def over(top: str | tuple, bottom: str | tuple) -> tuple:
    """`top` composited over an opaque `bottom`."""
    t = rgba(top) if isinstance(top, str) else top
    b = rgba(bottom) if isinstance(bottom, str) else bottom
    a = t[3]
    return (t[0] * a + b[0] * (1 - a), t[1] * a + b[1] * (1 - a), t[2] * a + b[2] * (1 - a), 1.0)


def lum(c) -> float:
    r, g, b, _ = rgba(c) if isinstance(c, str) else c

    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast(a, b) -> float:
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def stage_backgrounds(name: str) -> list[tuple]:
    """Every stop of the stage gradient, plain and under its strongest pattern line / accent glow."""
    s = STAGES[name]
    out = []
    for stop in s["base"]:
        out.append(rgba(stop))
        if s["family"] == "paper":
            out.append(over(f"rgba(64,110,180,{s['patternInk']})", stop))      # ruled / grid line
            out.append(over("rgba(214,72,72,0.36)", stop))                       # margin line
            out.append(over("rgba(110,84,40,0.16)", stop))                       # warm vignette
        else:
            out.append(over(f"rgba({s['ink']},{s['patternInk']})", stop))
            for accent in s["accents"].values():
                out.append(over(rgba(accent)[:3] + (s["glow"],), stop))
            out.append(over("rgba(0,0,0,0.55)", stop))                           # vignette
    return out


def caption_glyph_min(mode: str) -> float:
    """Lowest contrast between a caption word and what its glyphs actually touch.

    outline: white / yellow words inside their own black outline. box: dark words on a white box, the spoken
    word on a yellow highlighter band (the alternative measured for light stages).
    """
    if mode == "outline":
        return min(contrast(w, CAPTION["outline"]) for w in (CAPTION["fill"], CAPTION["highlight"]))
    box = CAPTION["alternatives"]["box"]
    return min(contrast(box["fill"], box["bg"]), contrast(box["highlight"], box["highlightBand"]))


def caption_silhouette_min(name: str) -> float:
    """The outlined word against the stage: whichever of fill and outline separates more, at the worst spot."""
    return min(max(contrast(w, bg), contrast(CAPTION["outline"], bg))
               for w in (CAPTION["fill"], CAPTION["highlight"]) for bg in stage_backgrounds(name))


@pytest.mark.parametrize("stage", sorted(STAGES))
def test_captions_are_legible_on_every_stage(stage):
    assert CAPTION["mode"] == "outline"
    assert caption_glyph_min("outline") >= CAPTION_MIN
    assert caption_silhouette_min(stage) >= CAPTION_MIN, stage


def test_caption_treatment_is_the_better_one_on_paper():
    # both treatments pass on cream; the outline keeps the higher glyph contrast (and the same look as dark stages)
    assert any(s["family"] == "paper" for s in STAGES.values())
    assert caption_glyph_min("outline") > caption_glyph_min("box") >= CAPTION_MIN


@pytest.mark.parametrize("stage", sorted(STAGES))
def test_stage_text_brand_line_disclaimer_and_panels(stage):
    s = STAGES[stage]
    for bg in stage_backgrounds(stage):
        ink = rgba(s["stageInk"])[:3] + (BRAND["inkAlpha"],)
        assert contrast(over(ink, bg), bg) >= TEXT_MIN, ("brand line", stage)
        assert contrast(BRAND["disclaimerText"], over(BRAND["disclaimerBg"], bg)) >= TEXT_MIN, ("disclaimer", stage)
    for stop in s["base"]:
        panel = over(s["panel"], stop)
        muted = over(tuple(float(v) for v in s["ink"].split(",")) + (BRAND["panelMutedAlpha"],), panel)
        assert contrast(BRAND["panelText"], panel) >= TEXT_MIN, ("panel text", stage)
        assert contrast(muted, panel) >= TEXT_MIN, ("panel muted text", stage)
    for bubble in (s["bubble"], s["bubbleMe"]):
        assert contrast("#FFFFFF", bubble) >= TEXT_MIN, ("bubble text", stage, bubble)


@pytest.mark.parametrize("stage", sorted(STAGES))
def test_warning_text_is_at_least_7_to_1_on_every_stage(stage):
    s = STAGES[stage]
    danger = TONES["danger"]
    # the flagged link inside the SMS bubble, with the pulsing red wash at its strongest (alpha 50/255)
    washed = over(rgba(danger["fill"])[:3] + (50 / 255,), s["bubble"])
    assert contrast(BRAND["flaggedLink"], washed) >= WARNING_MIN, stage
    # warning text on the note card (same card on every stage) and white on the danger pill ("의심 링크", "가짜")
    assert contrast(danger["ink"], NOTE["paper"]) >= WARNING_MIN
    assert contrast(danger["ink"], danger["tint"]) >= WARNING_MIN
    assert contrast(NOTE["ink"], danger["marker"]) >= WARNING_MIN
    assert contrast(danger["onSolid"], danger["solid"]) >= WARNING_MIN


@pytest.mark.parametrize("tone", sorted(TONES))
def test_note_card_text_and_tones(tone):
    t = TONES[tone]
    assert contrast(NOTE["ink"], NOTE["paper"]) >= WARNING_MIN
    assert contrast(NOTE["muted"], NOTE["paper"]) >= TEXT_MIN
    assert contrast(t["ink"], NOTE["paper"]) >= TEXT_MIN, tone           # numbers, labels, conclusions
    assert contrast(t["ink"], t["tint"]) >= TEXT_MIN, tone              # tag pills, timeline dates, chips
    assert contrast(NOTE["ink"], t["marker"]) >= TEXT_MIN, tone          # highlighted key phrase
    assert contrast(NOTE["ink"], t["tint"]) >= TEXT_MIN, tone           # compare title field
    assert contrast(t["onSolid"], t["solid"]) >= TEXT_MIN, tone          # solid pills
    assert contrast(NOTE["ink"], t["fill"]) >= 3.0, tone                 # the check drawn on a filled box


def test_semantic_tones_and_categories_stay_apart():
    """Red means danger only: no category colour may sit near the danger hue, and none may be cyan."""
    import colorsys

    def hue(c):
        r, g, b, _ = rgba(c)
        return colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[0] * 360

    danger = hue(TONES["danger"]["fill"])
    for name, cat in TOKENS["categories"].items():
        h = hue(cat["fill"])
        assert min(abs(h - danger), 360 - abs(h - danger)) >= 30, name
        assert not 170 <= h <= 200, f"{name} is cyan (the look of another channel's titles)"


def test_python_and_token_names_match():
    from radar.production.themes import CATEGORIES, FAMILIES, FAMILY_OF, THEMES
    assert set(THEMES) == set(STAGES)
    assert set(CATEGORIES) == set(TOKENS["categories"])
    assert {k: v["label"] for k, v in TOKENS["categories"].items()} == CATEGORIES
    for name, s in STAGES.items():
        assert FAMILY_OF[name] == s["family"], name
    assert {f: tuple(v["auto"]) for f, v in TOKENS["families"].items()} == FAMILIES


def test_captions_component_uses_the_tokens():
    src = (ROOT / "video" / "src" / "Captions.tsx").read_text(encoding="utf-8")
    assert "CAPTION.highlight" in src and "CAPTION.fill" in src and "CAPTION.outline" in src
