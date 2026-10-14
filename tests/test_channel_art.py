"""Channel art (video/src/ChannelArt.tsx): the YouTube profile picture and banner stills. Source-level checks: the
compositions are registered with YouTube's sizes, the banner's key content is laid out in the 1546x423 centre safe
area, the copy tells a stranger the topic (digital scams, surviving them) and stays honest (a dramatized series, no
agency claim), there is no score anywhere (2026-10-14), and nothing names a real brand or number. v3 (2026-10-14):
characters are cast per story, so the banner shows everyday neighbours of different species and ages from the
registry (not one family) and the fox in a disguise; the profile picture is 도치 from the front, no text. v4
(2026-10-14): every key element lies wholly inside the 1546x423 band with a 16 px margin (whole, smaller figures)."""
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "video" / "src"
ART = (SRC / "ChannelArt.tsx").read_text(encoding="utf-8")
ROOT_TSX = (SRC / "Root.tsx").read_text(encoding="utf-8")


def test_compositions_are_registered_with_youtube_sizes():
    assert 'id="ChannelProfile"' in ROOT_TSX and "width={800} height={800}" in ROOT_TSX
    assert 'id="ChannelBanner"' in ROOT_TSX and "width={BANNER.w} height={BANNER.h}" in ROOT_TSX
    assert "BANNER = {w: 2560, h: 1440, safe: {w: 1546, h: 423}}" in ART


def _obj(name):
    """A flat TS object literal of numbers (`name: {a: 1, b: 2}` inside ChannelArt.tsx) as a dict."""
    m = re.search(rf"\b{name}: \{{([^{{}}]*)\}}", ART)
    assert m, name
    return {k: float(v) for k, v in re.findall(r"(\w+): (-?[\d.]+)", m.group(1))}


def _rot(cx, cy, w, h, deg):
    a = math.radians(abs(deg))
    hw = w / 2 * math.cos(a) + h / 2 * math.sin(a)
    hh = h / 2 * math.cos(a) + w / 2 * math.sin(a)
    return cx - hw, cy - hh, cx + hw, cy + hh


def _figure(cid, x, eye_y, k):
    f = _obj(cid)
    return x - f["left"] * k, eye_y - f["up"] * k, x + f["right"] * k, eye_y + f["down"] * k


def _key_boxes():
    """Mirror of keyBoxes() in ChannelArt.tsx: every key element's extent in safe-area coordinates."""
    card, phone, fox, tag, stamp, dochi = (_obj(n) for n in ("card", "phone", "fox", "tag", "stamp", "dochi"))
    ext = {k: float(v) for k, v in re.findall(r"(\w+): ([\d.]+)",
                                              re.search(r"DOCHI_EXTENT = \{([^}]*)\}", ART).group(1))}
    dx, dy, ds = card["l"] + card["w"] - dochi["inset"], card["t"] + dochi["sink"], dochi["size"]
    boxes = {cid: _figure(cid, float(x), float(eye), float(k)) for cid, x, eye, k, _ in _neighbours()}
    boxes.update({
        "card": (card["l"], card["t"], card["l"] + card["w"], card["t"] + card["h"]),
        "phone": _rot(phone["cx"], phone["cy"], phone["w"] + 10, phone["h"] + 10, phone["rotate"]),
        "fox": _figure("scammer", fox["x"], fox["eyeY"], fox["k"]),
        "tag": _rot(tag["cx"], tag["cy"], 184 * tag["s"], 100 * tag["s"], tag["rotate"]),
        "stamp": _rot(stamp["x"], stamp["y"], stamp["w"] + 20, stamp["h"] + 20, stamp["rotate"] + 2),
        "dochi": (dx - ext["left"] * ds, dy - ext["up"] * ds, dx + ext["right"] * ds, dy + ext["down"] * ds),
    })
    return boxes


def test_banner_key_content_lies_wholly_in_the_band_with_a_margin():
    # v4: YouTube's crop tool cut v3's cast at the chest and 도치 at the top: now every key element (each figure ears
    # to shadow, the card, the call phone, the fox's tag and stamp, 도치) lies inside 1546x423 with MARGIN to spare
    margin = int(re.search(r"export const MARGIN = (\d+);", ART).group(1))
    assert margin >= 16
    boxes = _key_boxes()
    assert {"rabbit_teller", "raccoon_neighbor", "cat_guard", "card", "phone", "fox", "tag", "stamp", "dochi"} <= set(boxes)
    for name, (l, t, r, b) in boxes.items():
        assert l >= margin and t >= margin and r <= 1546 - margin and b <= 423 - margin, (name, (l, t, r, b))
    # the code places these through LAYOUT / keyBoxes (no stray safe-area literals elsewhere)
    assert "keyBoxes().map" in ART and "export const LAYOUT" in ART
    for fn, limit in (("X", 1546), ("Y", 423)):
        for v in re.findall(rf"\b{fn}\((\d+)\)", ART):
            assert 0 <= int(v) <= limit, (fn, v)


def test_banner_card_is_the_biggest_and_readable_on_a_phone():
    boxes = _key_boxes()
    area = {n: (r - l) * (b - t) for n, (l, t, r, b) in boxes.items()}
    assert max(area, key=area.get) == "card"
    card_block = ART[ART.index("{/* the note card"):ART.index("{/* 도치, the silent alarm")]
    title = int(re.search(r"fontSize: (\d+), fontWeight: 900", card_block).group(1))
    assert title * 390 / 1546 >= 20                                   # the name stays >= 20 px on a 390 px phone
    assert "wordBreak: \"keep-all\"" in card_block
    # the phone is left of the card, the fox's things right of it, nothing overlaps the card
    for name in ("phone", "rabbit_teller", "raccoon_neighbor", "cat_guard"):
        assert boxes[name][2] <= boxes["card"][0], name
    for name in ("fox", "tag", "stamp"):
        assert boxes[name][0] >= boxes["card"][2], name


def test_desktop_only_extra_is_wholly_outside_the_band():
    # 엄마 is decoration for the desktop strip: never half inside the phone view
    m = re.search(r'EXTRA: Neighbour = \{id: "([a-z_]+)", x: (-?\d+), eyeY: (\d+), k: ([\d.]+)', ART)
    l, t, r, b = _figure(m.group(1), *map(float, m.group(2, 3, 4)))
    assert r <= 0 or l >= 1546
    assert t >= 16 and b <= 423 - 16                                  # and whole in the desktop strip


def test_banner_tells_the_topic_without_a_score():
    assert '"디지털 사기에서 살아남는 법"' in ART and "{TAGLINE.main}" in ART      # the promise, tied to the name
    assert "보이스피싱 · 문자 사기 · 가짜 투자 광고" in ART                         # the kinds of scams
    assert "모르는 번호" in ART and "수신 전화" in ART                            # the generic incoming call
    assert 'text="사기꾼"' in ART and '<Stamp text="사기 실패"' in ART            # the caller is named and fails
    assert "SurvivedBadge" not in ART                                             # v3: no badge crowding the cast
    for gone in ("ScoreChip", "SCORE_LABELS", "home:", "작전 실패", "0점", "잘못 걸리는 30초"):
        assert gone not in ART, gone
    assert "home" not in ROOT_TSX[ROOT_TSX.index('id="ChannelBanner"'):]


def test_copy_is_honest_and_generic():
    assert "디지털 생존노트" in ART
    for banned in ("공식", "경찰", "금융감독원", "정부", "카카오", "토스", "네이버", "KB", "신한", "삼성", "애플",
                   "iPhone", "Galaxy", "SKT", "LG U+"):
        assert banned not in ART, banned
    assert not re.search(r"\d{2,4}-\d{3,4}-\d{4}", ART)      # no phone numbers
    assert "fetch(" not in ART and "http" not in ART          # plain props, no network


def _spec(cid):
    return json.loads((ROOT / "content" / "characters" / f"{cid}.json").read_text(encoding="utf-8"))


def _neighbours():
    block = ART[ART.index("export const NEIGHBOURS"):]
    block = block[:block.index("];")]
    return re.findall(r'\{id: "([a-z_]+)", x: (-?\d+), eyeY: (\d+), k: ([\d.]+), expr: "(\w+)"', block)


def test_banner_shows_everyday_neighbours_not_one_family():
    rows = _neighbours()
    assert 3 <= len(rows) <= 4
    for cid, x, eye_y, _k, expr in rows:
        assert _spec(cid)["role_kind"] in ("family", "other"), cid      # never the caller's side
        assert expr in ("suspicious", "smug"), (cid, expr)              # a calm "안 속아", never shocked
        assert 0 <= int(x) <= 1546 and 0 <= int(eye_y) <= 423          # in the safe area
    species = {_spec(cid)["species"] for cid, *_ in rows}
    assert len(species) == len(rows) and "dog" not in species         # all different, not the Jindo family
    assert {"elder", "adult"} <= {_spec(cid)["body"]["height"] for cid, *_ in rows}   # different ages
    assert "fill={REGISTRY[holder.id]?.palette.paw" in ART              # the grip paw is the holder's own


def test_fox_wears_a_disguise_that_leaks():
    assert 'costume = "bank_suit"' in ART
    fox = re.search(r'<Actor id="scammer" costume=\{costume\}[^>]*/>', ART, re.S)
    assert fox and re.search(r"\btail\b", fox.group(0))                  # his tail stays out


def test_profile_is_dochi_from_the_front_without_text():
    profile_reg = ROOT_TSX[ROOT_TSX.index('id="ChannelProfile"'):]
    assert 'defaultProps={{subject: "dochi", bg: "yellow"}' in profile_reg[:300]
    mascot = (SRC / "Mascot.tsx").read_text(encoding="utf-8")
    assert "export const DochiFront" in mascot and "export const Dochi:" in mascot     # additive to the side view
    front = mascot[mascot.index("export const DochiFront"):mascot.index("where 도치 stands")]
    assert "useCurrentFrame" not in front                                # a pure function of the pose
    profile = ART[ART.index("export const ChannelProfile"):ART.index("export type ChannelBannerProps")]
    assert "<DochiFront" in profile and 'bristle: 1, expr: "alarmed"' in profile
    assert not re.search(r">\s*[가-힣A-Za-z]", profile)                  # no text in the picture
