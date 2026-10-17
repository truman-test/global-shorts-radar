"""Render the channel banner (video/src/ChannelArt.tsx ChannelBanner) and its previews into media/upload/채널아트/.

    .venv/Scripts/python.exe tools/render_channel_art.py [--keep v4] [--bundle DIR] [--profile] [out_dir]

Writes 배너_2560x1440.png (the upload), 미리보기_배너_크롭가이드.png (the same with the safe-area guides),
미리보기_배너_데스크톱_2560x423.png and 미리보기_배너_모바일_1546x423.png (what the desktop / phone channel page shows)
and 미리보기_배너_휴대폰_390px.png (the phone band at a 390 px screen width: the readability check). --keep moves the
previous banner files into <tag>_보관/ first. --profile also renders 프로필_800.png and its 98 / 40 px previews (the
profile picture is unchanged since v3, so it is off by default). --bundle uses a prebuilt Remotion bundle
(`npx remotion bundle src/index.ts --out-dir DIR`), else the entry file is bundled per still (~45 s each).
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
VIDEO = ROOT / "video"
SAFE = {"w": 1546, "h": 423}            # YouTube's "모든 기기에 표시 가능" band (ChannelArt.tsx BANNER.safe)
BANNER = {"w": 2560, "h": 1440}
PHONE_W = 390                           # a common phone CSS width
BANNER_FILES = ("배너_2560x1440.png", "미리보기_배너_크롭가이드.png", "미리보기_배너_데스크톱_2560x423.png",
                "미리보기_배너_모바일_1546x423.png", "미리보기_배너_휴대폰_390px.png")


def npx() -> str:
    exe = shutil.which("npx") or shutil.which("npx.cmd")
    if not exe:
        raise SystemExit("npx not found: install Node.js 20+ and run `npm install` in video/")
    return exe


def still(composition: str, out: Path, props: str | None, bundle: Path | None) -> None:
    entry = str(bundle) if bundle else "src/index.ts"
    cmd = [npx(), "remotion", "still", entry, composition, str(out), "--log=error"]
    if props:
        cmd.append(f"--props={props}")
    r = subprocess.run(cmd, cwd=str(VIDEO), capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        raise SystemExit(f"remotion still {composition} failed: {(r.stderr or r.stdout)[-1500:]}")


def previews(banner: Path, out: Path) -> None:
    im = Image.open(banner).convert("RGB")
    x0 = (BANNER["w"] - SAFE["w"]) // 2
    y0 = (BANNER["h"] - SAFE["h"]) // 2
    im.crop((0, y0, BANNER["w"], y0 + SAFE["h"])).save(out / "미리보기_배너_데스크톱_2560x423.png")
    band = im.crop((x0, y0, x0 + SAFE["w"], y0 + SAFE["h"]))
    band.save(out / "미리보기_배너_모바일_1546x423.png")
    band.resize((PHONE_W, round(SAFE["h"] * PHONE_W / SAFE["w"])), Image.LANCZOS).save(out / "미리보기_배너_휴대폰_390px.png")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("out_dir", nargs="?", default=str(ROOT / "media" / "upload" / "채널아트"))
    ap.add_argument("--keep", help="move the previous banner files into <tag>_보관/ first (e.g. v4)")
    ap.add_argument("--bundle", help="a prebuilt Remotion bundle directory")
    ap.add_argument("--profile", action="store_true", help="also render the profile picture and its previews")
    args = ap.parse_args()
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    bundle = Path(args.bundle).resolve() if args.bundle else None
    if args.keep:
        keep = out / f"{args.keep}_보관"
        keep.mkdir(exist_ok=True)
        for name in BANNER_FILES:
            if (out / name).is_file():
                shutil.move(str(out / name), str(keep / name))
        print(f"kept the previous banner in {keep}")
    banner = out / "배너_2560x1440.png"
    still("ChannelBanner", banner, None, bundle)
    still("ChannelBanner", out / "미리보기_배너_크롭가이드.png", '{"guides": true}', bundle)
    previews(banner, out)
    if args.profile:
        profile = out / "프로필_800.png"
        still("ChannelProfile", profile, None, bundle)
        im = Image.open(profile).convert("RGB")
        for size in (98, 40):
            im.resize((size, size), Image.LANCZOS).save(out / f"미리보기_프로필_{size}px.png")
    for name in sorted(p.name for p in out.iterdir() if p.is_file()):
        print(name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
