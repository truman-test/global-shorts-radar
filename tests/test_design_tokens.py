"""Contrast gate for the design tokens (video/src/tokens.json), WCAG 2.2 relative luminance.

Captions >= 4.5:1 and warning text >= 7:1 against the background they actually sit on, for every stage; all other
text >= 4.5:1; graphics (doodles, 도치's edge) >= 3:1. Every stage declares contrastSamples: the worst composited
colours measured from stage-only renders in four zones (top = behind the brand line, caption = the caption band,
card = beside the note card where handwritten labels and doodles go, mascot = behind 도치). The classic dark /
paper stages also keep the derived set (translucent panels and pattern lines over each gradient stop).
"""
import itertools
import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TOKENS = json.loads((ROOT / "video" / "src" / "tokens.json").read_text(encoding="utf-8"))
STAGES = TOKENS["stages"]
NOTE, CAPTION, BRAND = TOKENS["note"], TOKENS["caption"], TOKENS["brand"]
TONES = {**TOKENS["tones"], **{f"category:{k}": v for k, v in TOKENS["categories"].items()}}
MASCOT = TOKENS["mascot"]
ZONES = ("top", "caption", "card", "mascot")
FULL_STAGE_PATTERNS = {"lamp", "kraft", "spread", "sky"}   # draw their own surface: declared samples only
NOTEBOOK = sorted(n for n, s in STAGES.items() if s["family"] == "notebook")
NEW_STAGES = ("night-lamp", "kraft-board", "desk-spread", "mood-sky")

CAPTION_MIN, WARNING_MIN, TEXT_MIN, GRAPHIC_MIN = 4.5, 7.0, 4.5, 3.0


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


def derived_backgrounds(name: str) -> list[tuple]:
    """Classic stages: every stop of the gradient, plain and under its strongest pattern line / accent glow."""
    s = STAGES[name]
    out = []
    for stop in s["base"]:
        out.append(rgba(stop))
        if s["luminance"] == "light":
            out.append(over(f"rgba(64,110,180,{s['patternInk']})", stop))      # ruled / grid line
            out.append(over("rgba(214,72,72,0.36)", stop))                       # margin line
            out.append(over("rgba(110,84,40,0.16)", stop))                       # warm vignette
        else:
            out.append(over(f"rgba({s['ink']},{s['patternInk']})", stop))
            for accent in s["accents"].values():
                out.append(over(rgba(accent)[:3] + (s["glow"],), stop))
            out.append(over("rgba(0,0,0,0.55)", stop))                           # vignette
    return out


def stage_backgrounds(name: str, zone: str = "caption") -> list[tuple]:
    """The colours text or graphics in `zone` sit on: the stage's declared (measured) samples, plus the derived
    set for the classic stages' caption band and top bar."""
    s = STAGES[name]
    out = [rgba(c) for c in s["contrastSamples"][zone]]
    if zone in ("caption", "top") and s["pattern"] not in FULL_STAGE_PATTERNS:
        out += derived_backgrounds(name)
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
               for w in (CAPTION["fill"], CAPTION["highlight"]) for bg in stage_backgrounds(name, "caption"))


@pytest.mark.parametrize("stage", sorted(STAGES))
def test_every_stage_declares_its_contrast_samples(stage):
    samples = STAGES[stage].get("contrastSamples", {})
    for zone in ZONES:
        assert samples.get(zone), (stage, zone)
        assert all(re.fullmatch(r"#[0-9A-Fa-f]{6}", c) for c in samples[zone]), (stage, zone)
    for sky in STAGES[stage].get("skies", {}).values():
        if sky["hand"]:
            assert sky.get("samples") and sky.get("mascot"), (stage, "a sky with its own inks declares its samples")


@pytest.mark.parametrize("stage", sorted(STAGES))
def test_captions_are_legible_on_every_stage(stage):
    assert CAPTION["mode"] == "outline"
    assert caption_glyph_min("outline") >= CAPTION_MIN
    assert caption_silhouette_min(stage) >= CAPTION_MIN, stage


def test_caption_treatment_is_the_better_one_on_paper():
    # both treatments pass on cream; the outline keeps the higher glyph contrast (and the same look as dark stages)
    assert any(s["luminance"] == "light" for s in STAGES.values())
    assert caption_glyph_min("outline") > caption_glyph_min("box") >= CAPTION_MIN


@pytest.mark.parametrize("stage", sorted(STAGES))
def test_stage_text_brand_line_disclaimer_and_panels(stage):
    s = STAGES[stage]
    for bg in stage_backgrounds(stage, "top"):
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


@pytest.mark.parametrize("stage", NOTEBOOK)
def test_handwritten_labels_and_doodles_beside_the_card(stage):
    """Notebook stages write a tone label (위험! = warning text in the danger tone's deeper hand ink, >= 7:1; 주의! /
    안전! and the closing sign-off in a tone or category ink, >= 4.5:1) and draw two doodles (graphics, >= 3:1) straight on the stage. Stages with
    handBacking write on a paper label instead; mood-sky's night sky has its own light inks."""
    s = STAGES[stage]
    hand_bg = [rgba(NOTE["paper"])] if s.get("handBacking") else stage_backgrounds(stage, "card")
    for bg in hand_bg:
        assert contrast(TONES["danger"]["hand"], bg) >= WARNING_MIN, (stage, "위험!", bg)
        for name, tone in TONES.items():
            assert contrast(tone["ink"], bg) >= TEXT_MIN, (stage, name, bg)
    for bg in stage_backgrounds(stage, "card"):
        assert contrast(NOTE["ink"], bg) >= GRAPHIC_MIN, (stage, "doodle", bg)
    for state, sky in s.get("skies", {}).items():
        if not sky["hand"]:
            continue
        for bg in sky["samples"]:   # the sky behind the label
            assert contrast(sky["hand"], bg) >= WARNING_MIN, (stage, state, "hand", bg)
            assert contrast(sky["doodle"], bg) >= GRAPHIC_MIN, (stage, state, "doodle", bg)


@pytest.mark.parametrize("stage", sorted(STAGES))
def test_share_line_and_value_chip(stage):
    """The closing share line ("부모님께도 보내 주세요", handwritten under the checklist card, text >= 4.5:1): the page's
    note ink on notebook stages (their surface under the card is paper, night-lamp's lamp-lit page included; a paper
    label with handBacking), the stage's light ink on the dark alert stages. The value CTA chip: note ink and the
    category's bell on the white note paper."""
    s = STAGES[stage]
    if s["family"] == "notebook":
        ink = NOTE["ink"]
        bgs = [rgba(NOTE["paper"])] if s.get("handBacking") else stage_backgrounds(stage, "card")
    else:
        assert s["luminance"] == "dark"
        ink = s["stageInk"]
        bgs = stage_backgrounds(stage, "card") + stage_backgrounds(stage, "caption")
    for bg in bgs:
        assert contrast(ink, bg) >= TEXT_MIN, (stage, "share line", bg)
    assert contrast(NOTE["ink"], NOTE["paper"]) >= TEXT_MIN
    for name, cat in TOKENS["categories"].items():
        assert contrast(cat["ink"], NOTE["paper"]) >= GRAPHIC_MIN, (name, "bell")


@pytest.mark.parametrize("stage", NEW_STAGES)
def test_new_stages_keep_captions_and_warning_text_above_the_bar(stage):
    assert caption_silhouette_min(stage) >= CAPTION_MIN
    test_handwritten_labels_and_doodles_beside_the_card(stage)


def mascot_edge(palette: dict, bg) -> float:
    """도치 against the stage: whichever of the ink outline and the rim light separates more."""
    edge = contrast(palette["ink"], bg)
    if palette["rimWidth"] > 0:
        edge = max(edge, contrast(palette["rim"], bg))
    return edge


@pytest.mark.parametrize("stage", sorted(STAGES))
def test_mascot_edge_contrast(stage):
    s = STAGES[stage]
    kind = s["mascotPalette"]
    pairs = [("paper", s["contrastSamples"]["mascot"]), ("night", s["skies"]["night"]["mascot"])] if kind == "sky" \
        else [(kind, s["contrastSamples"]["mascot"])]
    for pal, samples in pairs:
        for bg in samples:
            assert mascot_edge(MASCOT[pal], bg) >= GRAPHIC_MIN, (stage, pal, bg)


def test_night_mascot_palette():
    night, paper = MASCOT["night"], MASCOT["paper"]
    assert 6 <= night["rimWidth"] <= 10 and paper["rimWidth"] == 0
    # the rim is neutral (not a tone colour) and stays apart from the outline it frames
    r, g, b, _ = rgba(night["rim"])
    assert max(r, g, b) - min(r, g, b) <= 24
    assert contrast(night["rim"], night["ink"]) >= 7.0
    # the darkest night sample of every dark stage: the rim carries the silhouette there
    for name, s in STAGES.items():
        if s["mascotPalette"] in ("night", "sky"):
            samples = s["skies"]["night"]["mascot"] if s["mascotPalette"] == "sky" else s["contrastSamples"]["mascot"]
            darkest = min(samples, key=lum)
            assert contrast(night["rim"], darkest) >= 7.0, name
    assert lum(night["face"]) > lum(paper["face"])                       # a slightly brighter face
    assert rgba(night["shadow"])[3] <= 0.35                              # a soft floor shadow


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


def test_python_and_token_names_match():
    from radar.production.themes import CATEGORIES, FAMILIES, FAMILY_OF, STAGES as SPECS, THEMES, VISUAL_GROUPS
    assert set(THEMES) == set(STAGES) == set(SPECS)
    assert set(CATEGORIES) == set(TOKENS["categories"])
    assert {k: v["label"] for k, v in TOKENS["categories"].items()} == CATEGORIES
    for name, s in STAGES.items():
        assert FAMILY_OF[name] == s["family"], name
        spec = SPECS[name]
        assert (spec.family, spec.luminance, spec.mascot, spec.visual_group) == (
            s["family"], s["luminance"], s["mascotDefault"], s["surface"]), name
        assert s["surface"] in VISUAL_GROUPS
    assert {f: tuple(v["auto"]) for f, v in TOKENS["families"].items()} == FAMILIES
    assert set(FAMILIES) == {"alert", "notebook"}


def test_stage_spec_fields():
    for name, s in STAGES.items():
        assert s["family"] in ("alert", "notebook") and s["luminance"] in ("light", "dark"), name
        # 도치 lives in the notebook world: on by default there, off on the dark alert stages
        assert s["mascotDefault"] == (s["family"] == "notebook"), name
        slot = s["mascotSlot"]
        assert 16 <= slot["x"] <= 196 and 700 <= slot["minY"] < slot["maxY"] <= 1232, name
    assert STAGES["night-lamp"]["luminance"] == "dark" and STAGES["night-lamp"]["family"] == "notebook"
    assert STAGES["night-lamp"]["mascotPalette"] == "night"
    assert {STAGES[n]["surface"] for n in NEW_STAGES} == {"desk", "evidence", "sky"}


def test_every_pattern_has_a_renderer():
    """themes.ts PATTERNS == the cases of Backdrop.tsx's exhaustive switch; every stage uses a known pattern."""
    src = ROOT / "video" / "src"
    themes = (src / "themes.ts").read_text(encoding="utf-8")
    patterns = set(re.findall(r'"(\w+)"', re.search(r"export const PATTERNS = \[([^\]]+)\]", themes).group(1)))
    backdrop = (src / "Backdrop.tsx").read_text(encoding="utf-8")
    layer = backdrop[backdrop.index("const PatternLayer"):]
    layer = layer[:layer.index("\n};")]
    cases = set(re.findall(r'case "(\w+)":', layer))
    assert cases == patterns
    assert "assertNever(pattern)" in layer and "<Grid" not in layer.split("default:")[1]
    assert {s["pattern"] for s in STAGES.values()} <= patterns
    # the stage registry is validated, never cast
    assert "as unknown as" not in themes and "parseStage" in themes


def test_mascot_follows_the_stage_default():
    src = (ROOT / "video" / "src" / "Mascot.tsx").read_text(encoding="utf-8")
    # the script wins, then the drama stagings (off; on in dochi_explains), then the stage default
    assert "typeof scene.mascot === \"boolean\"" in src and "return theme.mascotDefault" in src
    assert "theme.mascotSlot" in src and "mascotPaletteFor" in src


def test_strict_family_rule_leaves_no_room_for_a_dark_notebook_stage():
    """Why the run rule counts family *and* luminance (radar.production.themes): read as family only, no-three-
    in-a-row plus <= 3 dark days in 7 (alert stages are all dark) admits no cyclic schedule with a dark notebook day
    (L) at all, for any period up to 11."""
    def ok(seq):
        n = len(seq)
        fam = {"A": "A", "N": "N", "L": "N"}
        for i in range(n):
            if len({fam[seq[(i + k) % n]] for k in range(3)}) == 1:
                return False
            if sum(seq[(i + k) % n] in "AL" for k in range(7)) > 3:
                return False
        return True
    for n in range(7, 12):
        assert not any("L" in seq and ok(seq) for seq in itertools.product("ANL", repeat=n)), n


def test_captions_component_uses_the_tokens():
    src = (ROOT / "video" / "src" / "Captions.tsx").read_text(encoding="utf-8")
    assert "CAPTION.highlight" in src and "CAPTION.fill" in src and "CAPTION.outline" in src


def test_handwriting_font_is_only_used_for_accents():
    """Gaegu (HAND) may only be loaded in fonts.ts and used by Handwriting.tsx, never by captions/headlines/mockups."""
    src = ROOT / "video" / "src"
    users = sorted(p.name for p in src.glob("*.ts*") if re.search(r"\bHAND\b|Gaegu", p.read_text(encoding="utf-8")))
    assert users == ["Handwriting.tsx", "fonts.ts"], users


SPEAKERS = {k: v for k, v in TOKENS["speakers"].items() if k != "_doc"}


@pytest.mark.parametrize("role", sorted(SPEAKERS))
def test_speaker_chips_read_on_every_stage(role):
    """Dialogue speaker chip: its label on the pill >= 4.5:1; against each stage's caption band (the chip sits just
    above the captions) the pill or its ring separates at >= 3:1. The scammer chip is the danger solid."""
    chip = SPEAKERS[role]
    assert contrast(chip["text"], chip["bg"]) >= TEXT_MIN, role
    for stage in STAGES:
        for bg in stage_backgrounds(stage, "caption"):
            assert max(contrast(chip["bg"], bg), contrast(chip["ring"], bg)) >= GRAPHIC_MIN, (role, stage, bg)
    assert SPEAKERS["scammer"]["bg"] == TOKENS["tones"]["danger"]["solid"]
