"""Scene cards: 1080x1920 typographic frames rendered locally (no stock footage, no AI images).

Layout (top to bottom), chosen for the Shorts UI: channel name and the re-enactment badge
at the top, a simple vector icon, a large headline, a short sub-line, and an empty band
at 66-78% height reserved for the burned-in captions. The bottom 20% and the right rail
stay free for YouTube's own buttons.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
BG_TOP, BG_BOTTOM = (12, 19, 33), (30, 45, 74)
TEXT, MUTED = (245, 247, 250), (165, 178, 198)
ACCENTS = {"red": (255, 82, 82), "yellow": (255, 210, 0), "green": (52, 211, 123), "blue": (84, 166, 255)}
ICONS = ("phone", "voice", "shield", "lock", "family", "warning", "money", "check", "video", "update")
FONT_CANDIDATES = (
    "C:/Windows/Fonts/malgunbd.ttf", "C:/Windows/Fonts/malgun.ttf",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", "/usr/share/fonts/noto-cjk/NotoSansCJK-Bold.ttc",
    "/System/Library/Fonts/AppleSDGothicNeo.ttc",
)


def find_font(preferred: str | None = None) -> str:
    for candidate in (preferred, *FONT_CANDIDATES):
        if candidate and Path(candidate).is_file():
            return str(candidate)
    raise FileNotFoundError("no Korean font found; set [production] font_file in config/radar.toml")


def _font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, int(size))


def _rr(draw, box, radius, **kw):
    draw.rounded_rectangle([int(v) for v in box], radius=int(radius), **kw)


def _wrap(draw, text: str, font, max_w: float) -> list[str]:
    lines, cur = [], ""
    for word in text.split():
        cand = f"{cur} {word}".strip()
        if not cur or draw.textlength(cand, font=font) <= max_w:
            cur = cand
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    out = []
    for line in lines:  # a single word wider than the box is split by character
        if draw.textlength(line, font=font) <= max_w:
            out.append(line)
            continue
        buf = ""
        for ch in line:
            if buf and draw.textlength(buf + ch, font=font) > max_w:
                out.append(buf)
                buf = ch
            else:
                buf += ch
        if buf:
            out.append(buf)
    return out


def _balanced(draw, lines: list[str], font, max_w: float) -> list[str]:
    """Re-split a two-line wrap so both lines have similar width (no single orphan word)."""
    if len(lines) != 2:
        return lines
    words = " ".join(lines).split()
    best, best_w = lines, max(draw.textlength(l, font=font) for l in lines)
    for k in range(1, len(words)):
        a, b = " ".join(words[:k]), " ".join(words[k:])
        w = max(draw.textlength(a, font=font), draw.textlength(b, font=font))
        if w <= max_w and w < best_w:
            best, best_w = [a, b], w
    return best


def _fit(draw, text: str, font_path: str, max_w: float, max_lines: int, start: int, minimum: int):
    size = start
    while size >= minimum:
        font = _font(font_path, size)
        lines = _wrap(draw, text, font, max_w)
        if len(lines) <= max_lines:
            return font, _balanced(draw, lines, font, max_w)
        size -= 6
    font = _font(font_path, minimum)
    return font, _wrap(draw, text, font, max_w)


def _center_lines(draw, lines: list[str], font, y: float, fill, spacing: float = 1.2) -> float:
    ascent, descent = font.getmetrics()
    lh = (ascent + descent) * spacing
    for i, line in enumerate(lines):
        w = draw.textlength(line, font=font)
        draw.text(((W - w) / 2, y + i * lh), line, font=font, fill=fill)
    return y + len(lines) * lh


def _gradient() -> Image.Image:
    img = Image.new("RGB", (W, H), BG_TOP)
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / (H - 1)
        d.line([(0, y), (W, y)], fill=tuple(int(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t) for i in range(3)))
    return img


def _check(d, cx, cy, size, color, lw):
    d.line([(cx - size * 0.45, cy), (cx - size * 0.1, cy + size * 0.32), (cx + size * 0.5, cy - size * 0.35)],
           fill=color, width=int(lw), joint="curve")


def draw_icon(d, name: str, cx: float, cy: float, s: float, color, font_path: str) -> None:
    lw = max(8, int(s / 16))
    if name == "phone":
        w, h = s * 0.52, s * 0.92
        _rr(d, (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), s * 0.09, outline=color, width=lw)
        d.line([(cx - w * 0.18, cy - h / 2 + lw * 2), (cx + w * 0.18, cy - h / 2 + lw * 2)], fill=color, width=lw // 2 + 2)
        r = lw * 0.9
        d.ellipse([cx - r, cy + h / 2 - lw * 3 - r, cx + r, cy + h / 2 - lw * 3 + r], fill=color)
    elif name == "voice":
        heights = (0.25, 0.55, 0.9, 0.6, 1.0, 0.45, 0.75, 0.3)
        bw = s / (len(heights) * 1.6)
        gap = bw * 0.6
        x0 = cx - (len(heights) * bw + (len(heights) - 1) * gap) / 2
        for i, hf in enumerate(heights):
            x, h = x0 + i * (bw + gap), s * hf
            _rr(d, (x, cy - h / 2, x + bw, cy + h / 2), bw / 2, fill=color)
    elif name == "shield":
        pts = [(cx, cy - s * 0.48), (cx + s * 0.4, cy - s * 0.32), (cx + s * 0.36, cy + s * 0.12), (cx, cy + s * 0.5),
               (cx - s * 0.36, cy + s * 0.12), (cx - s * 0.4, cy - s * 0.32)]
        d.line(pts + [pts[0], pts[1]], fill=color, width=lw, joint="curve")
        _check(d, cx, cy + s * 0.02, s * 0.42, color, lw)
    elif name == "lock":
        sx = s * 0.22
        d.arc([cx - sx, cy - s * 0.5, cx + sx, cy - s * 0.06], 180, 360, fill=color, width=lw)
        for x in (cx - sx + lw / 2, cx + sx - lw / 2):
            d.line([(x, cy - s * 0.29), (x, cy - s * 0.04)], fill=color, width=lw)
        bw, bh = s * 0.62, s * 0.48
        _rr(d, (cx - bw / 2, cy - s * 0.06, cx + bw / 2, cy - s * 0.06 + bh), s * 0.06, fill=color)
        r = s * 0.06
        d.ellipse([cx - r, cy + s * 0.12 - r, cx + r, cy + s * 0.12 + r], fill=BG_TOP)
    elif name == "family":
        for dx, scale in ((-0.3, 1.0), (0.3, 1.0), (0.0, 0.72)):
            r = s * 0.11 * scale
            hx, hy = cx + dx * s, cy - s * 0.18 + (1 - scale) * s * 0.28
            d.ellipse([hx - r, hy - r, hx + r, hy + r], fill=color)
            br = s * 0.2 * scale
            d.pieslice([hx - br, hy + r * 1.3, hx + br, hy + r * 1.3 + 2 * br], 180, 360, fill=color)
    elif name == "warning":
        pts = [(cx, cy - s * 0.45), (cx + s * 0.5, cy + s * 0.42), (cx - s * 0.5, cy + s * 0.42)]
        d.line(pts + [pts[0], pts[1]], fill=color, width=lw, joint="curve")
        _rr(d, (cx - lw * 0.6, cy - s * 0.18, cx + lw * 0.6, cy + s * 0.16), lw * 0.5, fill=color)
        r = lw * 0.75
        d.ellipse([cx - r, cy + s * 0.27 - r, cx + r, cy + s * 0.27 + r], fill=color)
    elif name == "money":
        r = s * 0.45
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=color, width=lw)
        f = _font(font_path, s * 0.5)
        w = d.textlength("₩", font=f)
        asc, desc = f.getmetrics()
        d.text((cx - w / 2, cy - (asc + desc) / 2), "₩", font=f, fill=color)
    elif name == "check":
        r = s * 0.45
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=color, width=lw)
        _check(d, cx, cy + s * 0.02, s * 0.5, color, lw)
    elif name == "video":
        w, h = s * 0.62, s * 0.5
        _rr(d, (cx - s * 0.48, cy - h / 2, cx - s * 0.48 + w, cy + h / 2), s * 0.07, outline=color, width=lw)
        d.polygon([(cx + s * 0.2, cy), (cx + s * 0.5, cy - s * 0.2), (cx + s * 0.5, cy + s * 0.2)], fill=color)
    elif name == "update":
        r = s * 0.42
        d.arc([cx - r, cy - r, cx + r, cy + r], 40, 320, fill=color, width=lw)
        tip = (cx + r * 0.77, cy - r * 0.64)
        d.polygon([(tip[0] - s * 0.16, tip[1] - s * 0.02), (tip[0] + s * 0.06, tip[1] - s * 0.14),
                   (tip[0] + s * 0.04, tip[1] + s * 0.12)], fill=color)
    else:
        raise ValueError(f"unknown icon '{name}' (available: {', '.join(ICONS)})")


def render_scene(scene, out_path: str | Path, *, channel_name: str, disclaimer: str, font_path: str,
                 show_disclaimer: bool) -> Path:
    img = _gradient()
    d = ImageDraw.Draw(img)
    accent = ACCENTS.get(scene.accent, ACCENTS["yellow"])
    _center_lines(d, [channel_name], _font(font_path, 40), 120, MUTED)
    if show_disclaimer and disclaimer:
        f = _font(font_path, 36)
        tw = d.textlength(disclaimer, font=f)
        asc, desc = f.getmetrics()
        pad_x, pad_y, y0 = 30, 18, 196
        _rr(d, ((W - tw) / 2 - pad_x, y0, (W + tw) / 2 + pad_x, y0 + asc + desc + 2 * pad_y), 30,
            fill=(0, 0, 0), outline=accent, width=4)
        d.text(((W - tw) / 2, y0 + pad_y), disclaimer, font=f, fill=TEXT)
    draw_icon(d, scene.icon, W / 2, 520, 300, accent, font_path)
    hf, lines = _fit(d, scene.headline, font_path, 860, 2, 104, 66)
    y = _center_lines(d, lines, hf, 760, TEXT)
    _rr(d, (W / 2 - 90, y + 16, W / 2 + 90, y + 28), 6, fill=accent)
    if scene.sub:
        sf, slines = _fit(d, scene.sub, font_path, 840, 2, 50, 38)
        _center_lines(d, slines[:2], sf, y + 56, MUTED)
    out_path = Path(out_path)
    img.save(out_path)
    return out_path
