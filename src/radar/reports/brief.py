"""Production brief: the few stories worth making today, on one page, in Korean.

The radar report is the analyst's full dossier. The brief is what a creator reads before
producing: which story, why now (observed metrics), what has been verified (and what has
not), the Story DNA to build an *original* Korean story on, and a 30-second structure
template derived from that DNA. It never contains the source video's script.
"""
from __future__ import annotations

from datetime import datetime

from radar.analysis.story_dna import FIELDS, LABELS

STATUS_KO = {"verified": "검증됨", "in_progress": "검증 진행 중 (출처 제안됨, 사람 확인 필요)",
             "unverified": "미검증", "false": "허위로 판정"}
STATUS_ORDER = {"verified": 0, "in_progress": 1, "unverified": 2, "false": 9}


MIN_CHANNEL_FIT = 0.5   # a brief is "what to make": promos, reaction clips and off-topic uploads stay out


def brief_rows(rows: list[dict], top: int, produced: set[str] | None = None) -> list[dict]:
    """Story leaders with a Story DNA and channel_fit >= 0.5, verified first, then by score;
    debunked and already-produced stories excluded."""
    produced = produced or set()

    def fit(r):
        j = r["judgments"].get("channel_fit")
        return None if j is None else float(j["value"])

    picked = [r for r in rows if r.get("cluster_leader", True) and r.get("story_dna")
              and r["verification_status"] != "false" and r["video_id"] not in produced
              and (fit(r) is None or fit(r) >= MIN_CHANNEL_FIT)]
    picked.sort(key=lambda r: (STATUS_ORDER.get(r["verification_status"], 5), -r["radar_score"]))
    return picked[:top]


def _structure(fields: dict) -> list[str]:
    """A 30-second Shorts structure template filled from the Story DNA (structure, not script)."""
    return [
        f"0–3초 훅: {fields.get('hook') or '—'}",
        f"3–12초 갈등/전개: {fields.get('conflict') or '—'} → {fields.get('story_progression') or '—'}",
        f"12–22초 반전: {fields.get('reveal') or '—'}",
        f"22–30초 보상·행동: {fields.get('payoff') or '—'}",
    ]


def render_brief(rows: list[dict], *, generated_at: datetime, settings, skipped_unanalyzed: int = 0) -> str:
    out = [f"# 오늘의 소재 브리프 — {generated_at:%Y-%m-%d %H:%M} UTC", ""]
    out.append("> 원본 영상은 아이디어 신호입니다. 아래 구조로 **원본 없이 성립하는 한국 이야기**를 만듭니다. "
               "대본·장면을 옮기지 않습니다. '검증됨'이 아닌 사실은 영상에서 단정하지 않습니다.")
    out.append("")
    if not rows:
        out.append("_Story DNA가 채워진 후보가 없습니다. `radar story-dna --export`로 번들을 만들어 분석을 돌린 뒤 다시 실행하세요._")
        return "\n".join(out) + "\n"
    out.append(f"후보 {len(rows)}개 (검증된 것 우선, 점수순). 이미 제작한 소재는 제외"
               + (f", Story DNA 없는 상위 후보 {skipped_unanalyzed}개 제외" if skipped_unanalyzed else "") + ".")
    out.append("")
    for i, r in enumerate(rows, start=1):
        dna = r["story_dna"]; f = dna["fields"]
        out.append(f"## {i}. {r['title']}")
        out.append("")
        out.append(f"- 소재: {f.get('topic') or '—'}")
        out.append(f"- 원본 신호: {r['url']} · {r['channel_title']} · Radar {r['radar_score']:.1f} (#{r['rank']})")
        why = [f"채널 평소의 {r['outlier_ratio']:.1f}배" if r["outlier_ratio"] is not None else "기준선 없음",
               f"시간당 {r['views_per_hour']:,.0f}회" if r["views_per_hour"] is not None else "",
               f"게시 {r['hours_since_publish']:.0f}시간 경과" if r["hours_since_publish"] is not None else ""]
        if r.get("velocity_ratio") is not None:
            why.append("가속 중" if r["velocity_ratio"] >= 1.2 else ("식는 중" if r["velocity_ratio"] <= 0.8 else "유지"))
        out.append("- 왜 지금: " + " · ".join(w for w in why if w))
        status = r["verification_status"]
        out.append(f"- 사실 확인: **{STATUS_KO.get(status, status)}**" + (f" — {r['verification_note']}" if r.get("verification_note") else ""))
        srcs = r.get("verification_sources") or [s["url"] for s in dna.get("sources", [])]
        if srcs:
            out.append("- 근거 출처:")
            out.extend(f"  - {u}" for u in srcs[:5])
        else:
            out.append("- 근거 출처: 없음 → 이 소재는 '현상 소개'로만 다루고 구체 사건을 단정하지 말 것")
        out.append(f"- 왜 터졌나: {f.get('why_viral') or '—'}")
        out.append(f"- 시청자 욕구/공포: {f.get('audience_desire_fear') or '—'}")
        out.append("")
        out.append(f"**한국형 각도** ({dna['source']}): {f.get('korean_angle') or '—'}")
        out.append("")
        out.append("**30초 구조 (Story DNA 기반 템플릿)**")
        out.append("")
        out.extend(f"- {line}" for line in _structure(f))
        out.append("")
        out.append(f"- 감정선: {f.get('emotion') or '—'} · 호기심 공백: {f.get('curiosity_gap') or '—'}")
        if status != "verified":
            out.append("- ⚠ 제작 전 확인: 위 출처를 열어 사실을 확인하고 `radar verify`로 상태를 올린 뒤 제작합니다.")
        out.append("")
    out.append("---")
    out.append("제작했으면 `radar publish-log <video_id> --url <내 영상 URL>`로 기록하세요. 다음 브리프에서 제외되고, 성과 피드백의 기준이 됩니다.")
    return "\n".join(out) + "\n"
