"""Offline collector with the same interface as YouTubeClient, backed by a JSON fixture.

Used for tests and for validating the pipeline without an API key. The fixture data is synthetic.
"""
from __future__ import annotations

import json
from pathlib import Path

from radar.collectors.youtube import QuotaTracker, RawSink

DEFAULT_FIXTURE = Path(__file__).resolve().parents[3] / "samples" / "youtube_sample.json"


class FixtureClient:
    def __init__(self, path: str | Path = DEFAULT_FIXTURE, raw_sink: RawSink | None = None, quota: QuotaTracker | None = None):
        self.path = Path(path)
        self.data = json.loads(self.path.read_text(encoding="utf-8"))
        self.raw_sink = raw_sink
        self.quota = quota or QuotaTracker(budget=10_000)

    @property
    def fixture_now(self) -> str | None:
        return self.data.get("fixture_now")

    def _emit(self, endpoint: str, params: dict, data: dict) -> dict:
        self.quota.charge(endpoint)
        if self.raw_sink:
            self.raw_sink(endpoint, params, data)
        return data

    def search_shorts(self, query, region_code=None, relevance_language=None, published_after=None, max_results=25, order="viewCount"):
        params = {"q": query, "regionCode": region_code, "relevanceLanguage": relevance_language, "publishedAfter": published_after}
        response = {"kind": "youtube#searchListResponse", "items": []}
        for entry in self.data.get("search", []):
            match = entry["match"]
            if match.get("q") == query and match.get("regionCode", region_code) == region_code:
                response = entry["response"]
                break
        response = {**response, "items": response.get("items", [])[:max_results]}
        return self._emit("search", params, response)

    def videos(self, video_ids):
        ids = list(dict.fromkeys(video_ids))
        items = [self.data["videos"][v] for v in ids if v in self.data["videos"]]
        self._emit("videos", {"id": ",".join(ids)}, {"items": items})
        return items

    def channels(self, channel_ids):
        ids = list(dict.fromkeys(channel_ids))
        items = [self.data["channels"][c] for c in ids if c in self.data["channels"]]
        self._emit("channels", {"id": ",".join(ids)}, {"items": items})
        return items

    def recent_upload_ids(self, uploads_playlist_id, n):
        ids = self.data.get("playlists", {}).get(uploads_playlist_id, [])[:n]
        data = {"items": [{"contentDetails": {"videoId": v}} for v in ids]}
        self._emit("playlistItems", {"playlistId": uploads_playlist_id}, data)
        return ids
