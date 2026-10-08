"""Analyst worksheet: the top stories laid out for a human to judge, plus a CSV that feeds
`radar judge --import` once the value column is filled in.

Manual judgments outrank heuristic_v0, so this is how ground truth enters the system. The
worksheet repeats the heuristic's current guess next to each dimension so the analyst can
confirm or overrule it, and it carries the Story DNA checklist so the judgment is written
down as a story analysis, not a gut score.
"""
from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path

from radar.reports.build import DIM_LABELS, STORY_DNA_FIELDS, _cell, _fmt, _fmt_int, _fmt_ratio
from radar.scoring.radar import JUDGMENT_DIMENSIONS

CSV_COLUMNS = ["video_id", "dimension", "value", "rationale", "author", "title", "url", "heuristic_value", "heuristic_source"]

# Korean prompts for the analyst (the analyst works in Korean; reports stay in English).
DIMENSION_GUIDE = {
    "story_strength": "Story Strength — 끝까지 볼 이유가 있는가? 0 = 없음 · 0.5 = 보통 · 1 = 반전·긴장·보상이 분명함",
    "korea_localization_gap": "Korea Localization Gap — 한국에 유사 콘텐츠가 얼마나 없는가? 0 = 이미 포화 · 1 = 거의 없음",
    "localization_potential": "Localization Potential — 한국 시청자도 관심을 가질 주제인가? 0 = 해외 특수 사정 · 1 = 누구나 겪을 수 있음",
    "channel_fit": "Channel Fit — \"디지털 세상에서 평범한 사람이 겪는 놀랍고 이상하고 위험하고 유용한 이야기\"에 맞는가? 0 = 무관 · 1 = 정확히 우리 이야기",
}


def worksheet_rows(rows: list[dict], top_n: int) -> list[dict]:
    """One row per story (cluster leaders), best first."""
    return [r for r in rows if r.get("cluster_leader", True)][:top_n]


def write_worksheet_csv(rows: list[dict], path: str | Path) -> Path:
    """Long format, one line per (video, dimension); `value` is left blank for the analyst.

    Extra columns are ignored by the importer; blank values are skipped, so a partly filled
    sheet imports cleanly.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=CSV_COLUMNS)
        w.writeheader()
        for r in rows:
            for dim in JUDGMENT_DIMENSIONS:
                j = r["judgments"].get(dim)
                w.writerow({
                    "video_id": r["video_id"], "dimension": dim, "value": "", "rationale": "", "author": "",
                    "title": r["title"] or "", "url": r["url"],
                    "heuristic_value": "" if j is None else j["value"],
                    "heuristic_source": "" if j is None else j["source"],
                })
    return path


def render_worksheet_markdown(rows: list[dict], *, generated_at: datetime, csv_name: str) -> str:
    out = [f"# 판단 워크시트 — {generated_at:%Y-%m-%d %H:%M} UTC", ""]
    out.append("> 원본 영상은 **아이디어 신호**입니다. 내용을 사실로 가정하지 말고, 복제·번역·재업로드하지 않습니다. "
               "판단은 0~1 사이 숫자로 적고, 모르면 비워 둡니다 (빈칸은 import 때 건너뜁니다).")
    out.append("")
    out.append(f"작성 방법: `{csv_name}`의 `value` 열을 채우고 `radar judge --import {csv_name}`로 가져오면 "
               "`manual` 판단이 heuristic을 대체합니다. 아래 각 항목의 `heuristic` 값은 현재 자동 추정치입니다.")
    out.append("")
    out.append("## 판단 기준")
    out.append("")
    for dim in JUDGMENT_DIMENSIONS:
        out.append(f"- `{dim}`: {DIMENSION_GUIDE[dim]}")
    out.append("")
    out.append("## 후보")
    out.append("")
    if not rows:
        out.append("_판단할 후보가 없습니다. 먼저 `radar run`을 실행하세요._")
        return "\n".join(out) + "\n"
    for i, r in enumerate(rows, start=1):
        story = f" · 같은 사건 영상 {r['cluster_size']}개" if r.get("cluster_size", 1) > 1 else ""
        out.append(f"### {i}. {r['title']}")
        out.append("")
        out.append(f"- 링크: {r['url']} · 채널: {_cell(r['channel_title'])} · 발견 키워드: {r['found_by']}{story}")
        out.append(f"- Radar Score {r['radar_score']:.1f} (#{r['rank']}) · outlier {_fmt_ratio(r['outlier_ratio'])} · "
                   f"views/hour {_fmt(r['views_per_hour'], ',.0f')} · 게시 후 {_fmt(r['hours_since_publish'], '.0f')}h · "
                   f"조회수 {_fmt_int(r['view_count'])} · 구독자 {_fmt_int(r['subscriber_count'])}")
        out.append(f"- 팩트체크 상태: **{r['verification_status'].upper()}**")
        out.append("")
        out.append("| 차원 | heuristic | 근거 (자동) | 내 판단 (0~1) |")
        out.append("|---|---|---|---|")
        for dim in JUDGMENT_DIMENSIONS:
            j = r["judgments"].get(dim)
            val = "—" if j is None else f"{j['value']:.2f} ({j['source']})"
            why = "" if j is None else _cell(j.get("rationale") or "")
            out.append(f"| {DIM_LABELS[dim]} | {val} | {why} |  |")
        out.append("")
        out.append("**Story DNA** (원본을 옮겨 적지 말고 구조만)")
        out.append("")
        out.extend(f"- [ ] {f}:" for f in STORY_DNA_FIELDS)
        out.append("- [ ] 독립 출처 (공식 → 경찰/기업 → 주요 언론 → 전문가):")
        out.append("- [ ] 원본 없이도 성립하는 한국형 각도:")
        out.append("")
    return "\n".join(out) + "\n"
