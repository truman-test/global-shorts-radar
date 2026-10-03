"""Opt-in Korea localization-gap check.

Searches YouTube in Korean on the KR region for the candidate's topic and measures how saturated
that topic already is. Costs ~101 quota units per candidate (search.list + videos.list), so it is
off by default and limited to the top-N candidates.

The result is derived from observed search data (source="derived:kr_search_v0"), but it is a
rough proxy: YouTube search relevance is not a census of Korean content.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from radar.analysis.heuristic import matched_terms

SOURCE = "derived:kr_search_v0"
NOISE_FLOOR_VIEWS = 50_000     # total KR views at/below this = effectively uncovered
SATURATION_VIEWS = 5_000_000   # total KR views at/above this = fully saturated


@dataclass
class GapResult:
    query: str | None
    value: float | None
    rationale: str


def korean_query(title: str, korean_terms: dict[str, str], max_terms: int = 3) -> str | None:
    """Map English topic terms in the title to Korean search terms (longest match first)."""
    matched_en: list[str] = []
    picked: list[str] = []
    for term in sorted(korean_terms, key=len, reverse=True):
        if any(matched_terms(longer, [term]) for longer in matched_en):  # "voice" inside "voice cloning"
            continue
        if matched_terms(title, [term]):
            matched_en.append(term)
            if korean_terms[term] not in picked:
                picked.append(korean_terms[term])
        if len(picked) >= max_terms:
            break
    return " ".join(picked) if picked else None


def gap_from_results(result_count: int, total_views: int) -> float:
    """1.0 = no meaningful Korean coverage found; 0.0 = saturated. Log scale between floor and cap."""
    if result_count == 0 or total_views <= NOISE_FLOOR_VIEWS:
        return 1.0
    lo, hi = math.log10(NOISE_FLOOR_VIEWS), math.log10(SATURATION_VIEWS)
    saturation = (math.log10(total_views) - lo) / (hi - lo)
    return round(min(max(1.0 - saturation, 0.0), 1.0), 3)


def check_korea_gap(client, title: str, korean_terms: dict[str, str], published_after: str | None) -> GapResult:
    query = korean_query(title, korean_terms)
    if not query:
        return GapResult(None, None, "no mappable Korean topic terms; gap not measured")
    search = client.search_shorts(query, region_code="KR", relevance_language="ko",
                                  published_after=published_after, max_results=25, order="relevance")
    ids = [it["id"]["videoId"] for it in search.get("items", []) if it.get("id", {}).get("videoId")]
    total_views = 0
    if ids:
        for item in client.videos(ids):
            total_views += int(item.get("statistics", {}).get("viewCount", 0) or 0)
    value = gap_from_results(len(ids), total_views)
    return GapResult(query, value, f"KR search '{query}': {len(ids)} results, {total_views:,} total views")
