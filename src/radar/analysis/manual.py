"""Import human judgments from CSV: video_id,dimension,value,rationale,author"""
from __future__ import annotations

import csv
from pathlib import Path

from radar.scoring.radar import JUDGMENT_DIMENSIONS

REQUIRED_COLUMNS = {"video_id", "dimension", "value"}


def import_manual_csv(db, path: str | Path, now: str) -> tuple[int, list[str]]:
    """Returns (imported_count, errors). Invalid rows are skipped and reported, never half-written."""
    path = Path(path)
    if not path.is_file():
        return 0, [f"file not found: {path}"]
    imported, errors = 0, []
    with path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        missing = REQUIRED_COLUMNS - set(reader.fieldnames or [])
        if missing:
            return 0, [f"missing columns: {', '.join(sorted(missing))}"]
        for lineno, row in enumerate(reader, start=2):
            video_id = (row.get("video_id") or "").strip()
            dimension = (row.get("dimension") or "").strip()
            try:
                value = float(row.get("value", ""))
            except ValueError:
                errors.append(f"line {lineno}: value is not a number")
                continue
            if dimension not in JUDGMENT_DIMENSIONS:
                errors.append(f"line {lineno}: unknown dimension '{dimension}' (allowed: {', '.join(JUDGMENT_DIMENSIONS)})")
                continue
            if not 0.0 <= value <= 1.0:
                errors.append(f"line {lineno}: value {value} outside [0, 1]")
                continue
            if db.video(video_id) is None:
                errors.append(f"line {lineno}: unknown video_id '{video_id}'")
                continue
            db.add_judgment(video_id, dimension, value, "manual", now,
                            rationale=(row.get("rationale") or "").strip(), author=(row.get("author") or "").strip() or None)
            imported += 1
    return imported, errors
