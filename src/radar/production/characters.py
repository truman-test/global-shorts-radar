"""The character registry (owner decision 2026-10-14: characters are made per story, not a fixed cast).

Every character a script can cast is a data spec in content/characters/<id>.json (schema: content/characters/README.md),
drawn by the parametric animal rig (video/src/Animal.tsx on the species templates of Species.tsx). The seven legacy
characters (father, mother, daughter, son, scammer, fake_banker, ad) are specs too; only they also have a human skin.
The character designer (.claude/agents/character-designer.md) adds a file per new character; script.py validates a
cast's `character` against this folder and reads the spec's role_kind instead of fixed id lists; remotion_render puts
the resolved spec into the props (CastMember.spec), so the renderer needs no network and no code change.

CLI:  python -m radar.production.characters check      # validate every file (exit 1 on errors)
      python -m radar.production.characters list       # id, label, species, kind, voice
"""
from __future__ import annotations

import colorsys
import json
import re
import sys
from functools import lru_cache
from pathlib import Path

from radar.config import PROJECT_ROOT

REGISTRY_DIR = PROJECT_ROOT / "content" / "characters"
COMPOSITION = PROJECT_ROOT / "video" / "src" / "composition.json"

LEGACY = ("father", "mother", "daughter", "son", "scammer", "fake_banker", "ad")
SPECIES = ("dog", "fox", "cat", "rabbit", "bear", "raccoon")
RESERVED_SPECIES = ("hedgehog",)          # 도치 only (video/src/Mascot.tsx), never a cast character
ROLE_KINDS = ("family", "caller", "other", "presenter")
HEIGHTS = ("elder", "adult", "tall")      # ~2.7 / ~2.9 / ~3.0 heads (composition.json bodyClasses)
BUILDS = ("slim", "regular", "broad")
MARKINGS = {"none": SPECIES, "urajiro": ("dog",), "tabby": ("cat", "rabbit")}
EYES = ("round", "narrow", "lash", "sleepy")
HAIR = ("none", "perm", "forelock", "slicked", "bun")
GLASSES = ("none", "halfMoon", "round")
HATS = ("cap",)
OUTFITS = ("cardigan", "blouseCardigan", "officeLanyard", "hoodie", "darkHoodie", "suitBadge", "suit", "workJacket",
           "vest", "knit")
PROPS = ("none", "headset", "whistle", "nameTag", "brooch", "pen")
LABEL_MAX_CHARS = 8
CANDY_CHROMA = 0.45       # chroma (max - min channel) above this on a large area (fur, muzzle, top, legs) = candy
DISGUISE_KINDS = ("caller", "presenter")   # the fox's costumes (Disguise.tsx) fit the fox callers / presenter only

_ID_RE = re.compile(r"^[a-z][a-z0-9_]{1,23}$")
_HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
PALETTE_KEYS = ("fur", "muzzle", "innerEar", "brow", "paw", "pad")
OUTFIT_COLOURS = ("top", "inner", "accent", "legs", "shoes")


def _hex(v) -> bool:
    return isinstance(v, str) and bool(_HEX_RE.match(v))


def _rgb(h: str) -> tuple[float, float, float]:
    return tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))  # type: ignore[return-value]


def saturation(h: str) -> float:
    """HSL saturation of a #RRGGBB colour."""
    r, g, b = _rgb(h)
    return colorsys.rgb_to_hls(r, g, b)[2]


def chroma(h: str) -> float:
    """How colourful a #RRGGBB colour is: the max minus the min channel (0 grey .. 1 pure hue)."""
    rgb = _rgb(h)
    return max(rgb) - min(rgb)


def colour_distance(a: str, b: str) -> float:
    """RGB distance in 0-255 units."""
    return sum(((x - y) * 255) ** 2 for x, y in zip(_rgb(a), _rgb(b))) ** 0.5


def spec_problems(spec: dict, file_id: str | None = None) -> tuple[list[str], list[str]]:
    """(errors, warnings) of one registry spec. `file_id` = the file's stem (it must equal the spec's id)."""
    from radar.production.script import EXPRESSIONS, VOICES   # late: script.py imports this module

    errors, warnings = [], []
    if not isinstance(spec, dict):
        return ["the spec must be a JSON object"], []
    sid = spec.get("id")
    where = f"character '{sid or file_id}'"
    if not isinstance(sid, str) or not _ID_RE.match(sid):
        errors.append(f"{where}: id must be 2-24 lowercase letters, digits or _ (starting with a letter)")
    if file_id is not None and sid != file_id:
        errors.append(f"{where}: id must equal the file name ({file_id}.json)")
    label = spec.get("label")
    if not isinstance(label, str) or not 1 <= len(label.strip()) <= LABEL_MAX_CHARS:
        errors.append(f"{where}: label needs 1-{LABEL_MAX_CHARS} characters (the Korean name / role, e.g. 경비 할아버지)")
    species = spec.get("species")
    if species in RESERVED_SPECIES:
        errors.append(f"{where}: species '{species}' is reserved for 도치 (the mascot); pick one of {', '.join(SPECIES)}")
    elif species not in SPECIES:
        errors.append(f"{where}: unknown species '{species}' (use {', '.join(SPECIES)})")
    kind = spec.get("role_kind")
    if kind not in ROLE_KINDS:
        errors.append(f"{where}: unknown role_kind '{kind}' (use {', '.join(ROLE_KINDS)})")
    if spec.get("voice") is not None and spec.get("voice") not in VOICES:
        errors.append(f"{where}: unknown voice '{spec.get('voice')}' (use {', '.join(VOICES)})")
    legacy = bool(spec.get("legacy"))
    if legacy and sid not in LEGACY:
        errors.append(f"{where}: legacy is only for the original seven ({', '.join(LEGACY)})")

    body = spec.get("body")
    if not isinstance(body, dict):
        errors.append(f"{where}: body {{height, build}} is required")
        body = {}
    if body.get("height") not in HEIGHTS:
        errors.append(f"{where}: body.height must be one of {', '.join(HEIGHTS)}")
    if body.get("build") not in BUILDS:
        errors.append(f"{where}: body.build must be one of {', '.join(BUILDS)}")
    if body.get("pin") is not None and (not legacy or body.get("pin") not in LEGACY):
        errors.append(f"{where}: body.pin keeps a legacy character's exact body; new characters use height + build")
    if kind == "family" and body.get("height") == "tall":
        errors.append(f"{where}: a family character is elder or adult (the victim's full shots keep the feet above the "
                      "bottom UI line); tall is for callers and bystanders")

    pal = spec.get("palette")
    if not isinstance(pal, dict):
        errors.append(f"{where}: palette is required")
        pal = {}
    for k in PALETTE_KEYS:
        if not _hex(pal.get(k)):
            errors.append(f"{where}: palette.{k} must be a #RRGGBB colour")
    for k in ("earTip", "nose", "marking"):
        if pal.get(k) is not None and not _hex(pal.get(k)):
            errors.append(f"{where}: palette.{k} must be a #RRGGBB colour or null")
    if species in ("raccoon", "bear") and not pal.get("marking"):
        warnings.append(f"{where}: palette.marking is the {species}'s dark patches / pale crescent; set it (a shade of "
                        "the fur is used otherwise)")

    markings = spec.get("markings", "none")
    if markings not in MARKINGS:
        errors.append(f"{where}: unknown markings '{markings}' (use {', '.join(MARKINGS)})")
    elif species in SPECIES and species not in MARKINGS[markings]:
        errors.append(f"{where}: markings '{markings}' is drawn on {', '.join(MARKINGS[markings])} only")
    age = spec.get("age", {}) or {}
    if not isinstance(age, dict) or any(not isinstance(age.get(k, False), bool) for k in ("young", "wrinkles", "greyBrows")):
        errors.append(f"{where}: age is {{young, wrinkles, greyBrows}} (true / false)")
    if spec.get("eyes", "round") not in EYES:
        errors.append(f"{where}: unknown eyes '{spec.get('eyes')}' (use {', '.join(EYES)})")
    hair = spec.get("hair", {"style": "none"}) or {"style": "none"}
    if not isinstance(hair, dict) or hair.get("style") not in HAIR:
        errors.append(f"{where}: hair.style must be one of {', '.join(HAIR)}")
    else:
        for k in ("color", "shade"):
            if hair.get(k) is not None and not _hex(hair[k]):
                errors.append(f"{where}: hair.{k} must be a #RRGGBB colour")
    if spec.get("glasses", "none") not in GLASSES:
        errors.append(f"{where}: unknown glasses '{spec.get('glasses')}' (use {', '.join(GLASSES)})")
    hat = spec.get("hat")
    if hat is not None and (not isinstance(hat, dict) or hat.get("style") not in HATS or not _hex(hat.get("color"))):
        errors.append(f"{where}: hat is null or {{\"style\": \"cap\", \"color\": \"#RRGGBB\"}} (a plain cap, no badge)")
    if spec.get("clip") is not None and not _hex(spec.get("clip")):
        errors.append(f"{where}: clip is null or a #RRGGBB colour")

    outfit = spec.get("outfit")
    if not isinstance(outfit, dict):
        errors.append(f"{where}: outfit is required")
        outfit = {}
    if outfit.get("type") not in OUTFITS:
        errors.append(f"{where}: unknown outfit.type '{outfit.get('type')}' (use {', '.join(OUTFITS)})")
    for k in OUTFIT_COLOURS:
        if not _hex(outfit.get(k)):
            errors.append(f"{where}: outfit.{k} must be a #RRGGBB colour")
    for k in ("skirt", "sheen"):
        if not isinstance(outfit.get(k, False), bool):
            errors.append(f"{where}: outfit.{k} is true / false")
    prop = spec.get("prop", "none")
    if prop not in PROPS:
        errors.append(f"{where}: unknown prop '{prop}' (use {', '.join(PROPS)})")
    acting = spec.get("acting", {}) or {}
    if not isinstance(acting, dict):
        errors.append(f"{where}: acting is {{habit, halfShadow}}")
        acting = {}
    if acting.get("habit") is not None and acting.get("habit") not in EXPRESSIONS:
        errors.append(f"{where}: acting.habit must be null or one of {', '.join(EXPRESSIONS)}")
    if not isinstance(acting.get("halfShadow", False), bool):
        errors.append(f"{where}: acting.halfShadow is true / false")

    # muted, grown-up palettes (no candy colours) and no danger red on the big areas
    big = [("palette.fur", pal.get("fur")), ("palette.muzzle", pal.get("muzzle")), ("outfit.top", outfit.get("top")),
           ("outfit.legs", outfit.get("legs"))]
    for name, c in big:
        if _hex(c) and chroma(c) > CANDY_CHROMA:
            warnings.append(f"{where}: {name} {c} is a saturated (candy) colour; use a muted, grown-up tone")
        if _hex(c):
            r, g, b = _rgb(c)
            h = colorsys.rgb_to_hls(r, g, b)[0]
            if (h < 0.03 or h > 0.95) and saturation(c) > 0.45 and r > 0.55:
                warnings.append(f"{where}: {name} {c} reads as red (red means danger on this channel)")
    return errors, warnings


def load_dir(path: Path) -> dict[str, dict]:
    """Every spec of a registry folder by id (unchecked; see check_dir)."""
    out = {}
    for f in sorted(path.glob("*.json")):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if isinstance(data, dict) and isinstance(data.get("id"), str):
            out[data["id"]] = data
    return out


@lru_cache(maxsize=1)
def _registry_cached(stamp: tuple) -> dict[str, dict]:
    return load_dir(REGISTRY_DIR)


def registry() -> dict[str, dict]:
    """The registry folder by id (cached until a file changes)."""
    stamp = tuple(sorted((f.name, f.stat().st_mtime_ns) for f in REGISTRY_DIR.glob("*.json"))) if REGISTRY_DIR.exists() else ()
    return _registry_cached(stamp)


def check_dir(path: Path = REGISTRY_DIR) -> tuple[list[str], list[str]]:
    """(errors, warnings) of every file in a registry folder, plus the legacy seven being present."""
    errors, warnings = [], []
    ids = set()
    for f in sorted(path.glob("*.json")):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{f.name}: not valid JSON ({exc})")
            continue
        e, w = spec_problems(data, f.stem)
        errors += e
        warnings += w
        ids.add(f.stem)
    missing = [c for c in LEGACY if c not in ids]
    if path == REGISTRY_DIR and missing:
        errors.append(f"the legacy characters must stay in the registry: missing {', '.join(missing)}")
    return errors, warnings


def character_ids() -> tuple[str, ...]:
    """Every castable id: the legacy seven first, then the rest by id."""
    reg = registry()
    return tuple(c for c in LEGACY if c in reg) + tuple(sorted(c for c in reg if c not in LEGACY))


def spec_of(char_id: str | None) -> dict | None:
    return registry().get(char_id or "")


def kind_of(char_id: str | None) -> str | None:
    """The registry role_kind of a character id (None = no character / unknown)."""
    s = spec_of(char_id)
    return s.get("role_kind") if s else None


def is_family(char_id: str | None) -> bool:
    return kind_of(char_id) == "family"


def is_caller(char_id: str | None) -> bool:
    return kind_of(char_id) == "caller"


def is_presenter(char_id: str | None) -> bool:
    return kind_of(char_id) == "presenter"


def can_disguise(char_id: str | None) -> bool:
    """The fox's costumes (cast "costume", Disguise.tsx) fit the fox callers and the fox presenter only."""
    s = spec_of(char_id)
    return bool(s and s.get("species") == "fox" and s.get("role_kind") in DISGUISE_KINDS)


def has_human_skin(char_id: str | None) -> bool:
    s = spec_of(char_id)
    return bool(s and s.get("legacy") and s.get("id") in LEGACY)


def resolved_spec(char_id: str) -> dict | None:
    """The spec as the renderer reads it (CastMember.spec): the file without the designer's notes."""
    s = spec_of(char_id)
    return {k: v for k, v in s.items() if k != "notes"} if s else None


def look_alike(a: str, b: str) -> bool:
    """Two different characters that would read as one at phone size: the same species, a near fur and a near top."""
    sa, sb = spec_of(a), spec_of(b)
    if not sa or not sb or a == b or sa.get("species") != sb.get("species"):
        return False
    return (colour_distance(sa["palette"]["fur"], sb["palette"]["fur"]) < 36
            and colour_distance(sa["outfit"]["top"], sb["outfit"]["top"]) < 36)


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    cmd = args[0] if args else "check"
    if cmd == "check":
        errors, warnings = check_dir()
        for w in warnings:
            print(f"warning: {w}")
        for e in errors:
            print(f"error: {e}")
        print(f"{len(load_dir(REGISTRY_DIR))} characters, {len(errors)} errors, {len(warnings)} warnings")
        return 1 if errors else 0
    if cmd == "list":
        for cid in character_ids():
            s = spec_of(cid) or {}
            print(f"{cid}\t{s.get('label')}\t{s.get('species')}\t{s.get('role_kind')}\t{s.get('voice', '')}")
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
