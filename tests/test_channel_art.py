"""Channel art (video/src/ChannelArt.tsx): the YouTube profile picture and banner stills. Source-level checks: the
compositions are registered with YouTube's sizes, the banner's key content is laid out in the 1546x423 centre safe
area, the copy tells a stranger the topic (digital scams, surviving them) and stays honest (a dramatized series, no
agency claim), there is no score anywhere (2026-10-14), and nothing names a real brand or number."""
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


def test_banner_key_content_sits_in_the_safe_area():
    # every key element is placed in safe-area coordinates (X()/Y()), and those stay inside 0..1546 / 0..423
    for fn, limit in (("X", 1546), ("Y", 423)):
        for v in re.findall(rf"\b{fn}\((\d+)\)", ART):
            assert 0 <= int(v) <= limit, (fn, v)
    card = re.search(r"const card = \{l: X\((\d+)\), t: Y\((\d+)\), w: (\d+), h: (\d+)\}", ART)
    assert card, "the note card is placed in safe-area coordinates"
    l, t, w, h = map(int, card.groups())
    assert l + w <= 1546 and t + h <= 423
    phone = re.search(r"const phone = \{cx: X\((\d+)\), cy: Y\((\d+)\), w: (\d+), h: (\d+)", ART)
    assert phone, "the phone is placed in safe-area coordinates"
    cx, cy, pw, ph = map(int, phone.groups())
    assert cx - pw / 2 >= 0 and cx + pw / 2 <= l and cy - ph / 2 >= 0 and cy + ph / 2 <= 423   # left of the card


def test_banner_tells_the_topic_without_a_score():
    assert '"디지털 사기에서 살아남는 법"' in ART and "{TAGLINE.main}" in ART      # the promise, tied to the name
    assert "보이스피싱 · 문자 사기 · 가짜 투자 광고" in ART                         # the kinds of scams
    assert "모르는 번호" in ART and "수신 전화" in ART                            # the generic incoming call
    assert 'text="사기꾼"' in ART and '<Stamp text="사기 실패"' in ART            # the caller is named and fails
    assert "생존" in ART and "<SurvivedBadge" in ART                              # the family's survival cue
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
