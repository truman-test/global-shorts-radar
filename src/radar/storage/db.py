"""SQLite storage.

Tables are grouped by data class and never mixed:
  raw       -> raw_responses (API JSON preserved as received, key excluded)
  observed  -> videos, video_snapshots, channels, channel_snapshots, discoveries
  derived   -> metrics, scores
  judgment  -> judgments (heuristic / manual / llm / derived-from-search), verification
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Iterable

SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
    run_id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    mode TEXT NOT NULL,              -- live | fixture
    quota_used INTEGER,
    notes TEXT
);

-- RAW ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS raw_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER,
    endpoint TEXT NOT NULL,
    params_json TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    response_json TEXT NOT NULL
);

-- OBSERVED ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS channels (
    channel_id TEXT PRIMARY KEY,
    title TEXT,
    country TEXT,
    uploads_playlist_id TEXT,
    first_seen_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS channel_snapshots (
    channel_id TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    subscriber_count INTEGER,        -- NULL when hidden
    video_count INTEGER,
    view_count INTEGER,
    PRIMARY KEY (channel_id, fetched_at)
);
CREATE TABLE IF NOT EXISTS videos (
    video_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    title TEXT,
    description TEXT,
    published_at TEXT NOT NULL,
    duration_iso TEXT,
    default_language TEXT,
    tags_json TEXT,
    first_seen_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS video_snapshots (
    video_id TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    view_count INTEGER,
    like_count INTEGER,              -- NULL when hidden
    comment_count INTEGER,           -- NULL when disabled
    PRIMARY KEY (video_id, fetched_at)
);
CREATE TABLE IF NOT EXISTS discoveries (
    video_id TEXT NOT NULL,
    run_id INTEGER NOT NULL,
    query TEXT NOT NULL,
    region TEXT,
    discovered_at TEXT NOT NULL,
    PRIMARY KEY (video_id, run_id, query, region)
);

-- DERIVED (deterministic) -------------------------------------------
CREATE TABLE IF NOT EXISTS metrics (
    video_id TEXT NOT NULL,
    computed_at TEXT NOT NULL,
    metric_version TEXT NOT NULL,
    snapshot_fetched_at TEXT,
    duration_seconds INTEGER,
    is_short INTEGER,
    hours_since_publish REAL,
    views_per_hour REAL,
    channel_median_views REAL,
    baseline_size INTEGER,
    baseline_kind TEXT,
    outlier_ratio REAL,
    engagement_rate REAL,
    freshness REAL,
    recent_views_per_hour REAL,      -- from snapshot deltas (repeated tracking)
    velocity_ratio REAL,             -- recent vph / average vph before the previous snapshot
    trend_window_hours REAL,
    snapshot_count INTEGER,
    PRIMARY KEY (video_id, computed_at)
);
CREATE TABLE IF NOT EXISTS scores (
    video_id TEXT NOT NULL,
    scored_at TEXT NOT NULL,
    weights_version TEXT NOT NULL,
    radar_score REAL NOT NULL,
    available_weight REAL NOT NULL,
    components_json TEXT NOT NULL,
    missing_json TEXT NOT NULL,
    PRIMARY KEY (video_id, scored_at)
);

-- JUDGMENT (non-factual; always carries its source) -----------------
CREATE TABLE IF NOT EXISTS judgments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL,
    dimension TEXT NOT NULL,
    value REAL NOT NULL CHECK (value >= 0 AND value <= 1),
    source TEXT NOT NULL,            -- heuristic_v0 | manual | llm:<model> | derived:<method>
    rationale TEXT,
    author TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS verification (
    video_id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'unverified'
        CHECK (status IN ('unverified', 'in_progress', 'verified', 'false')),
    sources_json TEXT NOT NULL DEFAULT '[]',
    note TEXT,
    updated_at TEXT NOT NULL
);
"""

VERIFICATION_STATUSES = ("unverified", "in_progress", "verified", "false")

# Columns added after the first release: (table, column, type). Applied with ALTER TABLE so
# existing databases are upgraded in place without losing rows.
MIGRATIONS = [
    ("metrics", "recent_views_per_hour", "REAL"),
    ("metrics", "velocity_ratio", "REAL"),
    ("metrics", "trend_window_hours", "REAL"),
    ("metrics", "snapshot_count", "INTEGER"),
]


def _int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


class Database:
    def __init__(self, path: str | Path):
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.path)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")

    def init_schema(self) -> None:
        self.conn.executescript(SCHEMA)
        self._migrate()
        self.conn.commit()

    def _migrate(self) -> None:
        for table, column, col_type in MIGRATIONS:
            existing = {r["name"] for r in self.conn.execute(f"PRAGMA table_info({table})")}
            if column not in existing:
                self.conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")

    def close(self) -> None:
        self.conn.close()

    def __enter__(self) -> "Database":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    def query(self, sql: str, params: Iterable[Any] = ()) -> list[sqlite3.Row]:
        return self.conn.execute(sql, tuple(params)).fetchall()

    # -- runs / raw ------------------------------------------------------
    def start_run(self, started_at: str, mode: str) -> int:
        cur = self.conn.execute("INSERT INTO runs (started_at, mode) VALUES (?, ?)", (started_at, mode))
        self.conn.commit()
        return int(cur.lastrowid)

    def finish_run(self, run_id: int, quota_used: int, notes: str = "") -> None:
        self.conn.execute("UPDATE runs SET quota_used = ?, notes = ? WHERE run_id = ?", (quota_used, notes, run_id))
        self.conn.commit()

    def save_raw(self, run_id: int | None, endpoint: str, params: dict, fetched_at: str, response: dict) -> None:
        clean = {k: v for k, v in params.items() if k.lower() != "key"}
        self.conn.execute(
            "INSERT INTO raw_responses (run_id, endpoint, params_json, fetched_at, response_json) VALUES (?, ?, ?, ?, ?)",
            (run_id, endpoint, json.dumps(clean, ensure_ascii=False), fetched_at, json.dumps(response, ensure_ascii=False)),
        )
        self.conn.commit()

    # -- observed --------------------------------------------------------
    def upsert_video(self, item: dict, fetched_at: str) -> None:
        sn, st, cd = item.get("snippet", {}), item.get("statistics", {}), item.get("contentDetails", {})
        self.conn.execute(
            """INSERT INTO videos (video_id, channel_id, title, description, published_at, duration_iso,
                                   default_language, tags_json, first_seen_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(video_id) DO UPDATE SET title=excluded.title, description=excluded.description,
                   duration_iso=excluded.duration_iso, tags_json=excluded.tags_json""",
            (
                item["id"], sn.get("channelId"), sn.get("title"), sn.get("description"), sn.get("publishedAt"),
                cd.get("duration"), sn.get("defaultLanguage") or sn.get("defaultAudioLanguage"),
                json.dumps(sn.get("tags", []), ensure_ascii=False), fetched_at,
            ),
        )
        self.conn.execute(
            "INSERT OR REPLACE INTO video_snapshots (video_id, fetched_at, view_count, like_count, comment_count) VALUES (?, ?, ?, ?, ?)",
            (item["id"], fetched_at, _int(st.get("viewCount")), _int(st.get("likeCount")), _int(st.get("commentCount"))),
        )
        self.conn.commit()

    def upsert_channel(self, item: dict, fetched_at: str) -> None:
        sn, st, cd = item.get("snippet", {}), item.get("statistics", {}), item.get("contentDetails", {})
        uploads = cd.get("relatedPlaylists", {}).get("uploads")
        self.conn.execute(
            """INSERT INTO channels (channel_id, title, country, uploads_playlist_id, first_seen_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(channel_id) DO UPDATE SET title=excluded.title, country=excluded.country,
                   uploads_playlist_id=excluded.uploads_playlist_id""",
            (item["id"], sn.get("title"), sn.get("country"), uploads, fetched_at),
        )
        subs = None if st.get("hiddenSubscriberCount") else _int(st.get("subscriberCount"))
        self.conn.execute(
            "INSERT OR REPLACE INTO channel_snapshots (channel_id, fetched_at, subscriber_count, video_count, view_count) VALUES (?, ?, ?, ?, ?)",
            (item["id"], fetched_at, subs, _int(st.get("videoCount")), _int(st.get("viewCount"))),
        )
        self.conn.commit()

    def add_discovery(self, video_id: str, run_id: int, query: str, region: str | None, discovered_at: str) -> None:
        self.conn.execute(
            "INSERT OR IGNORE INTO discoveries (video_id, run_id, query, region, discovered_at) VALUES (?, ?, ?, ?, ?)",
            (video_id, run_id, query, region or "", discovered_at),
        )
        self.conn.commit()

    def latest_run_started_at(self) -> str | None:
        row = self.conn.execute("SELECT MAX(started_at) AS t FROM runs").fetchone()
        return row["t"] if row else None

    def candidate_ids(self, since: str | None = None) -> list[str]:
        """Videos discovered by search at or after `since` (ISO); all discoveries if None."""
        if since is None:
            rows = self.query("SELECT DISTINCT video_id FROM discoveries ORDER BY video_id")
        else:
            rows = self.query("SELECT DISTINCT video_id FROM discoveries WHERE discovered_at >= ? ORDER BY video_id",
                              (since,))
        return [r["video_id"] for r in rows]

    def video(self, video_id: str) -> sqlite3.Row | None:
        return self.conn.execute("SELECT * FROM videos WHERE video_id = ?", (video_id,)).fetchone()

    def channel(self, channel_id: str) -> sqlite3.Row | None:
        return self.conn.execute(
            """SELECT c.*, s.subscriber_count, s.video_count FROM channels c
               LEFT JOIN channel_snapshots s ON s.channel_id = c.channel_id
               WHERE c.channel_id = ? ORDER BY s.fetched_at DESC LIMIT 1""",
            (channel_id,),
        ).fetchone()

    def video_ids_by_channel_country(self, countries: Iterable[str]) -> set[str]:
        """Videos whose channel's observed country is in `countries` (case-insensitive ISO codes)."""
        codes = [c.upper() for c in countries]
        if not codes:
            return set()
        marks = ", ".join("?" for _ in codes)
        rows = self.query(
            f"SELECT v.video_id FROM videos v JOIN channels c ON c.channel_id = v.channel_id "
            f"WHERE c.country IS NOT NULL AND upper(c.country) IN ({marks})", codes)
        return {r["video_id"] for r in rows}

    def latest_snapshot(self, video_id: str) -> sqlite3.Row | None:
        return self.conn.execute(
            "SELECT * FROM video_snapshots WHERE video_id = ? ORDER BY fetched_at DESC LIMIT 1", (video_id,)
        ).fetchone()

    def snapshots(self, video_id: str) -> list[sqlite3.Row]:
        return self.query("SELECT * FROM video_snapshots WHERE video_id = ? ORDER BY fetched_at", (video_id,))

    def channel_videos_with_latest_views(self, channel_id: str) -> list[sqlite3.Row]:
        return self.query(
            """SELECT v.video_id, v.published_at, v.duration_iso, s.view_count
               FROM videos v JOIN video_snapshots s ON s.video_id = v.video_id
               WHERE v.channel_id = ? AND s.fetched_at = (
                   SELECT MAX(fetched_at) FROM video_snapshots WHERE video_id = v.video_id)
               ORDER BY v.published_at DESC""",
            (channel_id,),
        )

    def discovery_queries(self, video_id: str) -> list[str]:
        rows = self.query("SELECT DISTINCT query, region FROM discoveries WHERE video_id = ?", (video_id,))
        return [f"{r['query']} ({r['region']})" if r["region"] else r["query"] for r in rows]

    # -- derived ---------------------------------------------------------
    def save_metrics(self, row: dict) -> None:
        cols = ", ".join(row)
        marks = ", ".join("?" for _ in row)
        self.conn.execute(f"INSERT OR REPLACE INTO metrics ({cols}) VALUES ({marks})", tuple(row.values()))
        self.conn.commit()

    def latest_metrics(self, video_id: str) -> sqlite3.Row | None:
        return self.conn.execute(
            "SELECT * FROM metrics WHERE video_id = ? ORDER BY computed_at DESC LIMIT 1", (video_id,)
        ).fetchone()

    def save_score(self, video_id: str, scored_at: str, weights_version: str, radar_score: float,
                   available_weight: float, components: dict, missing: list[str]) -> None:
        self.conn.execute(
            "INSERT OR REPLACE INTO scores VALUES (?, ?, ?, ?, ?, ?, ?)",
            (video_id, scored_at, weights_version, radar_score, available_weight,
             json.dumps(components, ensure_ascii=False), json.dumps(missing)),
        )
        self.conn.commit()

    def latest_score(self, video_id: str) -> sqlite3.Row | None:
        return self.conn.execute(
            "SELECT * FROM scores WHERE video_id = ? ORDER BY scored_at DESC LIMIT 1", (video_id,)
        ).fetchone()

    # -- judgment --------------------------------------------------------
    def add_judgment(self, video_id: str, dimension: str, value: float, source: str, created_at: str,
                     rationale: str = "", author: str | None = None) -> None:
        if not 0.0 <= float(value) <= 1.0:
            raise ValueError(f"judgment value must be within [0, 1], got {value}")
        self.conn.execute(
            "INSERT INTO judgments (video_id, dimension, value, source, rationale, author, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (video_id, dimension, float(value), source, rationale, author, created_at),
        )
        self.conn.commit()

    def judgments(self, video_id: str) -> list[sqlite3.Row]:
        return self.query("SELECT * FROM judgments WHERE video_id = ? ORDER BY created_at, id", (video_id,))

    def ensure_verification(self, video_id: str, now: str) -> None:
        self.conn.execute(
            "INSERT OR IGNORE INTO verification (video_id, status, updated_at) VALUES (?, 'unverified', ?)",
            (video_id, now),
        )
        self.conn.commit()

    def set_verification(self, video_id: str, status: str, now: str, sources: list[str] | None = None, note: str = "") -> None:
        if status not in VERIFICATION_STATUSES:
            raise ValueError(f"status must be one of {VERIFICATION_STATUSES}")
        if self.video(video_id) is None:
            raise ValueError(f"unknown video_id: {video_id}")
        self.conn.execute(
            """INSERT INTO verification (video_id, status, sources_json, note, updated_at) VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(video_id) DO UPDATE SET status=excluded.status, sources_json=excluded.sources_json,
                   note=excluded.note, updated_at=excluded.updated_at""",
            (video_id, status, json.dumps(sources or []), note, now),
        )
        self.conn.commit()

    def verification(self, video_id: str) -> sqlite3.Row | None:
        return self.conn.execute("SELECT * FROM verification WHERE video_id = ?", (video_id,)).fetchone()
