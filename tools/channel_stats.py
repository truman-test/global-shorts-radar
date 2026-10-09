"""Observe OUR channel (public data, API key from .env) and keep the upload schedule in sync.

    .venv/Scripts/python.exe tools/channel_stats.py

- Lists every upload with views/likes/comments and the channel subscriber count (~3 quota units).
- Matches uploads to content/schedule.json entries by exact title; newly matched entries become
  "published" (url filled) and are recorded with `radar publish-log` against the script's source candidate.
- Appends a snapshot to data/channel_stats.jsonl and prints a short Korean table.
The key is read from .env and never printed.
"""
from __future__ import annotations

import json
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEDULE = ROOT / "content" / "schedule.json"
SNAPSHOTS = ROOT / "data" / "channel_stats.jsonl"
API = "https://www.googleapis.com/youtube/v3/"


def api_key() -> str:
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("YOUTUBE_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("YOUTUBE_API_KEY missing in .env")


def get(endpoint: str, **params) -> dict:
    params["key"] = api_key()
    try:
        with urllib.request.urlopen(API + endpoint + "?" + urllib.parse.urlencode(params), timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:  # never echo the URL (it contains the key)
        raise SystemExit(f"YouTube API {endpoint}: HTTP {e.code}") from None


def channel_id() -> str:
    import tomllib
    return tomllib.loads((ROOT / "config" / "radar.toml").read_text(encoding="utf-8"))["channel"]["channel_id"]


def main() -> int:
    cid = channel_id()
    ch = get("channels", part="statistics", id=cid)["items"][0]["statistics"]
    ids: list[str] = []
    try:
        items = get("playlistItems", part="contentDetails", playlistId="UU" + cid[2:], maxResults=50).get("items", [])
        ids = [i["contentDetails"]["videoId"] for i in items]
    except SystemExit as e:
        if "HTTP 404" not in str(e):
            raise
    videos = get("videos", part="snippet,statistics,status", id=",".join(ids)).get("items", []) if ids else []
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    rows = [{"id": v["id"], "title": v["snippet"]["title"], "published_at": v["snippet"]["publishedAt"],
             "privacy": v["status"]["privacyStatus"], **{k: int(v["statistics"].get(k, 0))
             for k in ("viewCount", "likeCount", "commentCount")}} for v in videos]
    snap = {"at": now, "subscribers": int(ch.get("subscriberCount", 0)), "hidden_subs": ch.get("hiddenSubscriberCount"),
            "channel_views": int(ch.get("viewCount", 0)), "videos": rows}
    SNAPSHOTS.parent.mkdir(parents=True, exist_ok=True)
    with SNAPSHOTS.open("a", encoding="utf-8") as f:
        f.write(json.dumps(snap, ensure_ascii=False) + "\n")

    plan = json.loads(SCHEDULE.read_text(encoding="utf-8"))
    by_title = {r["title"]: r for r in rows}
    changed = False
    for e in plan["entries"]:
        meta = ROOT / "media" / "final" / e["script"] / "meta.json"
        script = ROOT / "content" / "scripts" / f"{e['script']}.json"
        if not meta.is_file() or not script.is_file():
            continue
        title = json.loads(meta.read_text(encoding="utf-8"))["title"]
        hit = by_title.get(title)
        if hit and e.get("status") != "published":
            url = f"https://www.youtube.com/shorts/{hit['id']}"
            src = json.loads(script.read_text(encoding="utf-8"))["source_video_id"]
            subprocess.run([str(ROOT / ".venv" / "Scripts" / "radar.exe"), "publish-log", src, "--url", url,
                            "--title", title, "--note", f"script {e['script']}; detected by channel_stats {now}"],
                           cwd=ROOT, check=True)
            e.update(status="published", url=url, uploaded_at=hit["published_at"])
            changed = True
    if changed:
        SCHEDULE.write_text(json.dumps(plan, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    print(f"{now}  구독자 {snap['subscribers']}  채널 조회수 {snap['channel_views']}  영상 {len(rows)}편")
    for r in sorted(rows, key=lambda r: r["published_at"]):
        print(f"  {r['published_at'][:16]}  조회 {r['viewCount']:>7}  좋아요 {r['likeCount']:>5}  댓글 {r['commentCount']:>4}  "
              f"{r['privacy']:<8} {r['title'][:40]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
