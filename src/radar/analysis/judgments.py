"""Resolve which judgment to use per dimension when several sources exist."""
from __future__ import annotations

from typing import Iterable, Mapping


def source_rank(source: str) -> int:
    """Higher wins: manual > llm:* > derived:* > heuristic_* > anything else."""
    if source == "manual":
        return 4
    if source.startswith("llm:"):
        return 3
    if source.startswith("derived:"):
        return 2
    if source.startswith("heuristic"):
        return 1
    return 0


def resolve(judgments: Iterable[Mapping]) -> dict[str, Mapping]:
    """dimension -> winning judgment row (highest source rank, then most recent)."""
    best: dict[str, Mapping] = {}
    for j in judgments:
        current = best.get(j["dimension"])
        key = (source_rank(j["source"]), j["created_at"], j["id"] if "id" in j.keys() else 0)
        if current is None or key >= (
            source_rank(current["source"]), current["created_at"], current["id"] if "id" in current.keys() else 0
        ):
            best[j["dimension"]] = j
    return best
