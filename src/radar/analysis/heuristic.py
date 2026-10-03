"""heuristic_v0: low-confidence, title/description-only judgments.

These are placeholders until LLM or human judgments exist. They are stored in the `judgments`
table with source="heuristic_v0" and never presented as facts. Values are capped below 1.0
because keyword matching cannot confirm that a story actually holds attention.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

SOURCE = "heuristic_v0"
HEURISTIC_MAX = 0.9

HOOK_CUES = {
    "question": re.compile(r"\?"),
    "number": re.compile(r"\b\d+(?:[.,]\d+)?\b|\$\d"),
    "negation/warning": re.compile(r"\b(never|don'?t|stop|warning|avoid|nobody|no one)\b"),
    "curiosity": re.compile(r"\b(why|how|what happens|secret|truth|hidden|mystery|actually|really)\b"),
    "conflict": re.compile(r"\b(scam\w*|hack\w*|stole|stolen|fraud|caught|exposed|attack\w*|lost|fake)\b"),
    "personal": re.compile(r"\b(i|my|me|mom|dad|grandma|grandpa|friend)\b"),
    "reveal": re.compile(r"\b(turns out|until|then|found out|discovered|realized)\b"),
}


@dataclass
class Judgment:
    dimension: str
    value: float
    rationale: str
    source: str = SOURCE


def matched_terms(text: str, terms: list[str]) -> list[str]:
    text = text.lower()
    # Whole-word match, tolerating a plural "s" ("scammers" matches "scammer").
    return [t for t in terms if re.search(rf"(?<!\w){re.escape(t)}s?(?!\w)", text)]


def story_strength(title: str, description: str = "") -> Judgment:
    text = f"{title} {description[:300]}".lower()
    cues = [name for name, pattern in HOOK_CUES.items() if pattern.search(text)]
    value = min(0.2 + 0.12 * len(cues), HEURISTIC_MAX)
    return Judgment("story_strength", round(value, 3), f"title hook cues: {', '.join(cues) or 'none'}")


def channel_fit(title: str, description: str, topic_lexicon: dict[str, list[str]]) -> Judgment:
    text = f"{title} {description[:500]}"
    hits = {cat: matched_terms(text, terms) for cat, terms in topic_lexicon.items()}
    hits = {c: t for c, t in hits.items() if t}
    value = {0: 0.1, 1: 0.6}.get(len(hits), HEURISTIC_MAX)
    detail = "; ".join(f"{c}: {', '.join(t[:3])}" for c, t in hits.items()) or "no digital-topic terms"
    return Judgment("channel_fit", value, f"topic categories matched ({len(hits)}): {detail}")


def localization_potential(title: str, description: str, universal: list[str], region_specific: list[str]) -> Judgment:
    text = f"{title} {description[:500]}"
    uni = matched_terms(text, universal)
    local = matched_terms(text, region_specific)
    value = 0.45 + (0.3 if uni else 0.0) - (0.35 if local else 0.0)
    value = min(max(value, 0.05), HEURISTIC_MAX)
    parts = []
    if uni:
        parts.append(f"universal: {', '.join(uni[:4])}")
    if local:
        parts.append(f"region-specific (hard to localize): {', '.join(local[:4])}")
    return Judgment("localization_potential", round(value, 3), "; ".join(parts) or "no localization cues")


def heuristic_judgments(title: str, description: str, settings) -> list[Judgment]:
    return [
        story_strength(title, description),
        channel_fit(title, description, settings.topic_lexicon),
        localization_potential(title, description, settings.universal_terms, settings.region_specific_terms),
    ]
