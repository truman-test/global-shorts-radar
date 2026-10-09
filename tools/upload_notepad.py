"""Write the upload notepad for the next unpublished entries of content/schedule.json.

    .venv/Scripts/python.exe tools/upload_notepad.py [--days 3]

Output: media/upload/업로드_예정.txt (UTF-8 with BOM, CRLF, opens cleanly in Notepad) and one thumbnail
jpg per entry. Only entries whose video is rendered and publishable are listed; the rest are reported as
missing so the orchestrator can fix them.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SCHEDULE = ROOT / "content" / "schedule.json"
OUT_DIR = ROOT / "media" / "upload"
WEEKDAYS = "월화수목금토일"

COMMON = """모든 영상 공통 선택값
▶ 썸네일 (올린 뒤 휴대폰에서 30초):
   유튜브 앱 → 내 영상 → 이 쇼츠 ⋮ → 수정 → 썸네일 → 맨 끝 장면 선택
   (영상 마지막 0.5초가 첫 화면과 같은 포스터입니다. 앱의 '텍스트 추가'는 쓰지 마세요)
   쇼츠 썸네일 파일 업로드는 파트너 프로그램 가입 채널만 데스크톱에서 됩니다. 그때는 아래 썸네일 파일을 쓰면 됩니다
▶ 재생목록: 비워 두기
▶ 시청자층: 아니요, 아동용이 아닙니다
▶ 연령 제한: 없음
▶ 변경되거나 합성된 콘텐츠: 예   ← 꼭 확인
▶ 유료 프로모션: 체크 안 함
▶ 동영상 언어: 한국어 / 카테고리: 교육 (업로드 기본 설정에 넣어 두었으면 자동)
▶ 공개 상태: 공개"""


def weekday(date: str) -> str:
    from datetime import date as d
    y, m, dd = map(int, date.split("-"))
    return WEEKDAYS[d(y, m, dd).weekday()]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=3)
    args = ap.parse_args(argv)
    plan = json.loads(SCHEDULE.read_text(encoding="utf-8"))
    upcoming = [e for e in plan["entries"] if e.get("status") != "published"][: args.days]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    lines = ["디지털 생존노트 · 올릴 영상", f"올리는 시간: 매일 {plan.get('upload_time', '19:00')} 전후 / 하루 한 편", "", COMMON, ""]
    problems = []
    for e in upcoming:
        folder = ROOT / "media" / "final" / e["script"]
        meta_path, video = folder / "meta.json", folder / "video.mp4"
        if not (meta_path.is_file() and video.is_file()):
            problems.append(f"{e['date']} {e['script']}: video not rendered (status {e.get('status')})")
            continue
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        if not meta.get("publishable"):
            problems.append(f"{e['date']} {e['script']}: video is not publishable ({meta.get('tts_backend')})")
            continue
        thumb = OUT_DIR / f"썸네일_{e['date']}_{e['script'].split('-', 3)[-1]}.jpg"
        if (folder / "thumb.png").is_file():
            Image.open(folder / "thumb.png").convert("RGB").save(thumb, quality=90)
        lines += ["-" * 60, f"[{e['date']} ({weekday(e['date'])})]  {meta['duration_seconds']}초", "-" * 60,
                  "▶ 영상 파일", str(video), "", "▶ 썸네일 파일 (파트너 가입 후 업로드용)", str(thumb), "", "▶ 제목", meta["title"], "",
                  "▶ 설명", meta["description"].rstrip(), "", "▶ 태그 (더보기 → 태그 칸)", ", ".join(meta["tags"]), ""]
    if not upcoming:
        lines.append("올릴 영상이 아직 없습니다. 오케스트레이터가 준비 중입니다.")
    lines += ["=" * 60, "올린 뒤에는 따로 알려 주지 않아도 됩니다. 매일 아침 채널을 확인해 기록합니다."]
    out = OUT_DIR / "업로드_예정.txt"
    out.write_text("\r\n".join(lines) + "\r\n", encoding="utf-8-sig")
    print(out)
    for p in problems:
        print("problem:", p, file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
