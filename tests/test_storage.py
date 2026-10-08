import json

import pytest


def item(vid="v1", views="100", likes="5"):
    stats = {"viewCount": views, "commentCount": "1"}
    if likes is not None:
        stats["likeCount"] = likes
    return {"id": vid, "snippet": {"channelId": "c1", "title": "t", "publishedAt": "2026-10-01T00:00:00Z"},
            "contentDetails": {"duration": "PT30S"}, "statistics": stats}


def test_snapshots_append_and_hidden_likes(db):
    db.upsert_video(item(views="100"), "2026-10-02T00:00:00Z")
    db.upsert_video(item(views="250", likes=None), "2026-10-03T00:00:00Z")
    snaps = db.query("SELECT * FROM video_snapshots ORDER BY fetched_at")
    assert [s["view_count"] for s in snaps] == [100, 250]
    assert db.latest_snapshot("v1")["like_count"] is None
    assert len(db.query("SELECT * FROM videos")) == 1


def test_raw_saved_without_key(db):
    db.save_raw(1, "videos", {"id": "a", "key": "SECRET"}, "2026-10-03T00:00:00Z", {"items": []})
    row = db.query("SELECT * FROM raw_responses")[0]
    assert "SECRET" not in row["params_json"] and json.loads(row["response_json"]) == {"items": []}


def test_observed_and_judgment_tables_are_separate(db):
    db.upsert_video(item(), "2026-10-03T00:00:00Z")
    db.add_judgment("v1", "story_strength", 0.7, "heuristic_v0", "2026-10-03T00:00:00Z", "cues")
    video_cols = {r["name"] for r in db.query("PRAGMA table_info(videos)")}
    snap_cols = {r["name"] for r in db.query("PRAGMA table_info(video_snapshots)")}
    assert not ({"story_strength", "value", "source"} & (video_cols | snap_cols))
    assert db.judgments("v1")[0]["source"] == "heuristic_v0"


def test_judgment_range_enforced(db):
    with pytest.raises(ValueError):
        db.add_judgment("v1", "story_strength", 1.5, "manual", "2026-10-03T00:00:00Z")


def test_verification_lifecycle(db):
    db.upsert_video(item(), "2026-10-03T00:00:00Z")
    db.ensure_verification("v1", "2026-10-03T00:00:00Z")
    assert db.verification("v1")["status"] == "unverified"
    db.set_verification("v1", "verified", "2026-10-04T00:00:00Z", ["https://police.example/notice"])
    assert db.verification("v1")["status"] == "verified"
    db.ensure_verification("v1", "2026-10-05T00:00:00Z")  # must not reset
    assert db.verification("v1")["status"] == "verified"
    with pytest.raises(ValueError):
        db.set_verification("v1", "probably", "2026-10-04T00:00:00Z")
    with pytest.raises(ValueError):
        db.set_verification("nope", "verified", "2026-10-04T00:00:00Z")


def test_migration_adds_columns_and_keeps_rows(tmp_path):
    import sqlite3

    from radar.storage.db import Database

    path = tmp_path / "old.db"
    conn = sqlite3.connect(path)  # MVP-era metrics table without trend columns
    conn.execute("""CREATE TABLE metrics (video_id TEXT NOT NULL, computed_at TEXT NOT NULL,
                    metric_version TEXT NOT NULL, outlier_ratio REAL, PRIMARY KEY (video_id, computed_at))""")
    conn.execute("INSERT INTO metrics VALUES ('v1', '2026-10-01T00:00:00Z', 'm1', 20.0)")
    conn.commit()
    conn.close()
    db = Database(path)
    db.init_schema()
    db.init_schema()  # idempotent
    cols = {r["name"] for r in db.query("PRAGMA table_info(metrics)")}
    assert {"recent_views_per_hour", "velocity_ratio", "trend_window_hours", "snapshot_count"} <= cols
    row = db.query("SELECT * FROM metrics")[0]
    assert row["outlier_ratio"] == 20.0 and row["velocity_ratio"] is None
    db.close()


def test_candidate_window(db):
    db.add_discovery("old", 1, "q", "US", "2026-09-28T00:00:00Z")
    db.add_discovery("new", 1, "q", "US", "2026-10-02T00:00:00Z")
    assert db.candidate_ids("2026-10-01T00:00:00Z") == ["new"]
    assert db.candidate_ids() == ["new", "old"]
