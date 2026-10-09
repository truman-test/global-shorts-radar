"""Draw the channel profile picture and banner (original artwork, Pretendard OFL font only).

    .venv/Scripts/python.exe tools/make_channel_art.py [out_dir]

Profile 800x800 (YouTube shows it as a small circle), banner 2048x1152 with every word inside the
1235x338 centre area that all devices show.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONTS = ROOT / "video" / "public" / "fonts"
NAVY_TOP, NAVY_BOTTOM = (6, 11, 22), (14, 29, 58)
YELLOW, RED, WHITE, MUTED = (255, 210, 63), (255, 90, 95), (255, 255, 255), (190, 202, 222)


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / f"Pretendard-{weight}.otf"), size)


def background(w: int, h: int, grid: int, glow: tuple[int, int, int], glow_xy: tuple[int, int], glow_r: int) -> Image.Image:
    img = Image.new("RGB", (w, h))
    px = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        px.line([(0, y), (w, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(NAVY_TOP, NAVY_BOTTOM)))
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for x in range(0, w, grid):
        d.line([(x, 0), (x, h)], fill=(255, 255, 255, 18), width=2)
    for y in range(0, h, grid):
        d.line([(0, y), (w, y)], fill=(255, 255, 255, 18), width=2)
    img.paste(layer, (0, 0), layer)
    g = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gx, gy = glow_xy
    ImageDraw.Draw(g).ellipse([gx - glow_r, gy - glow_r, gx + glow_r, gy + glow_r], fill=(*glow, 70))
    g = g.filter(ImageFilter.GaussianBlur(glow_r // 2))
    img.paste(g, (0, 0), g)
    return img


def centered(d: ImageDraw.ImageDraw, cx: float, y: float, text: str, f, fill, stroke=0) -> tuple[int, int, int, int]:
    box = d.textbbox((0, 0), text, font=f, stroke_width=stroke)
    w = box[2] - box[0]
    d.text((cx - w / 2 - box[0], y - box[1]), text, font=f, fill=fill, stroke_width=stroke, stroke_fill=(0, 0, 0))
    return d.textbbox((cx - w / 2 - box[0], y - box[1]), text, font=f, stroke_width=stroke)


def profile(out: Path) -> Path:
    s = 800
    img = background(s, s, 80, RED, (220, 260), 260)
    d = ImageDraw.Draw(img)
    # everything inside the inscribed circle (YouTube crops to a circle)
    f = font("Black", 250)
    top = centered(d, s / 2, 150, "생존", f, WHITE)
    bar_y = top[3] + 26
    d.rounded_rectangle([s / 2 - 230, bar_y, s / 2 + 230, bar_y + 26], radius=13, fill=YELLOW)
    centered(d, s / 2, bar_y + 60, "노트", font("Black", 150), YELLOW)
    img.save(out)
    return out


def banner(out: Path) -> Path:
    w, h = 2048, 1152
    img = background(w, h, 90, RED, (700, 520), 420)
    g = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(g).ellipse([1250, 380, 1850, 980], fill=(*YELLOW, 40))
    g = g.filter(ImageFilter.GaussianBlur(220))
    img.paste(g, (0, 0), g)
    d = ImageDraw.Draw(img)
    cx = w / 2
    # safe area: x 406..1641, y 407..745 (everything below stays inside it)
    title = centered(d, cx, 440, "디지털 생존노트", font("Black", 132), WHITE)
    d.rounded_rectangle([cx - 110, title[3] + 20, cx + 110, title[3] + 32], radius=6, fill=YELLOW)
    sub_f, tag_f = font("Bold", 44), font("ExtraBold", 38)
    sub, label = "AI 사기 · 보이스피싱 · 폰 보안", "30초로 지키는 내 돈과 가족"
    sb, lb = d.textbbox((0, 0), sub, font=sub_f), d.textbbox((0, 0), label, font=tag_f)
    sw, lw, gap, pad = sb[2] - sb[0], lb[2] - lb[0], 36, 28
    x0 = cx - (sw + gap + lw + 2 * pad) / 2
    row_mid = title[3] + 100
    d.text((x0 - sb[0], row_mid - (sb[1] + sb[3]) / 2), sub, font=sub_f, fill=MUTED)
    px = x0 + sw + gap
    lh = lb[3] - lb[1]
    d.rounded_rectangle([px, row_mid - lh / 2 - 16, px + lw + 2 * pad, row_mid + lh / 2 + 16], radius=40,
                        outline=RED, width=4, fill=(0, 0, 0))
    d.text((px + pad - lb[0], row_mid - (lb[1] + lb[3]) / 2), label, font=tag_f, fill=WHITE)
    img.save(out)
    return out


if __name__ == "__main__":
    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "media" / "channel"
    out_dir.mkdir(parents=True, exist_ok=True)
    print(profile(out_dir / "프로필_800x800.png"))
    print(banner(out_dir / "배너_2048x1152.png"))
