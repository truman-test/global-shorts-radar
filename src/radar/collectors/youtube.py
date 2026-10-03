"""YouTube Data API v3 collector.

Metadata endpoints only (search, videos, channels, playlistItems). This module never downloads
media, captions or transcripts, and contains no scoring logic: it returns raw API JSON.
"""
from __future__ import annotations

import re
import time
from typing import Any, Callable, Iterable

import requests

BASE_URL = "https://www.googleapis.com/youtube/v3"

# Estimated quota cost per call (https://developers.google.com/youtube/v3/determine_quota_cost)
QUOTA_COST = {"search": 100, "videos": 1, "channels": 1, "playlistItems": 1}

RawSink = Callable[[str, dict, dict], None]


class YouTubeAPIError(RuntimeError):
    pass


class QuotaExceededError(YouTubeAPIError):
    """YouTube reported the daily quota is exhausted."""


class QuotaBudgetError(YouTubeAPIError):
    """The local per-run budget would be exceeded; the call was not made."""


_KEY_PATTERN = re.compile(r"(key=)[^&\s'\"]+", re.IGNORECASE)


def redact(text: str, secret: str | None = None) -> str:
    text = _KEY_PATTERN.sub(r"\1***", text)
    if secret:
        text = text.replace(secret, "***")
    return text


class QuotaTracker:
    def __init__(self, budget: int):
        self.budget = budget
        self.used = 0

    def charge(self, endpoint: str) -> None:
        cost = QUOTA_COST.get(endpoint, 1)
        if self.used + cost > self.budget:
            raise QuotaBudgetError(
                f"local quota budget reached: used={self.used}, next {endpoint} costs {cost}, budget={self.budget}"
            )
        self.used += cost


def _chunks(items: list[str], size: int) -> Iterable[list[str]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


class YouTubeClient:
    def __init__(
        self,
        api_key: str,
        session: requests.Session | None = None,
        quota: QuotaTracker | None = None,
        raw_sink: RawSink | None = None,
        max_retries: int = 3,
        backoff_seconds: float = 1.0,
        timeout: float = 20.0,
        sleep: Callable[[float], None] = time.sleep,
    ):
        if not api_key:
            raise YouTubeAPIError("YOUTUBE_API_KEY is not set")
        self._api_key = api_key
        self.session = session or requests.Session()
        self.quota = quota or QuotaTracker(budget=10_000)
        self.raw_sink = raw_sink
        self.max_retries = max_retries
        self.backoff_seconds = backoff_seconds
        self.timeout = timeout
        self._sleep = sleep

    def __repr__(self) -> str:  # never expose the key
        return f"YouTubeClient(quota_used={self.quota.used})"

    # -- transport -------------------------------------------------------
    def _get(self, endpoint: str, params: dict[str, Any]) -> dict:
        self.quota.charge(endpoint)
        url = f"{BASE_URL}/{endpoint}"
        query = {**params, "key": self._api_key}
        last_error = "unknown error"
        for attempt in range(self.max_retries + 1):
            try:
                resp = self.session.get(url, params=query, timeout=self.timeout)
            except requests.RequestException as exc:
                last_error = redact(f"{type(exc).__name__}: {exc}", self._api_key)
            else:
                if resp.status_code == 200:
                    data = resp.json()
                    if self.raw_sink:
                        self.raw_sink(endpoint, dict(params), data)
                    return data
                reason, message = _error_reason(resp)
                if resp.status_code == 403 and reason in {"quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"}:
                    raise QuotaExceededError(f"YouTube quota exhausted ({reason})")
                if resp.status_code in (400, 401, 403, 404):
                    if reason in {"keyInvalid", "badRequest"} and "key" in message.lower():
                        raise YouTubeAPIError("YouTube API key is invalid")
                    raise YouTubeAPIError(
                        redact(f"{endpoint} failed: HTTP {resp.status_code} {reason}: {message}", self._api_key)
                    )
                last_error = f"HTTP {resp.status_code} {reason}"
            if attempt < self.max_retries:
                self._sleep(self.backoff_seconds * (2**attempt))
        raise YouTubeAPIError(f"{endpoint} failed after {self.max_retries + 1} attempts: {last_error}")

    # -- endpoints ------------------------------------------------------
    def search_shorts(
        self,
        query: str,
        region_code: str | None = None,
        relevance_language: str | None = None,
        published_after: str | None = None,
        max_results: int = 25,
        order: str = "viewCount",
    ) -> dict:
        params: dict[str, Any] = {
            "part": "snippet",
            "q": query,
            "type": "video",
            "videoDuration": "short",  # < 4 minutes; exact Shorts filter happens in metrics
            "order": order,
            "maxResults": max_results,
        }
        if region_code:
            params["regionCode"] = region_code
        if relevance_language:
            params["relevanceLanguage"] = relevance_language
        if published_after:
            params["publishedAfter"] = published_after
        return self._get("search", params)

    def videos(self, video_ids: list[str]) -> list[dict]:
        items: list[dict] = []
        for chunk in _chunks(list(dict.fromkeys(video_ids)), 50):
            data = self._get("videos", {"part": "snippet,statistics,contentDetails", "id": ",".join(chunk)})
            items.extend(data.get("items", []))
        return items

    def channels(self, channel_ids: list[str]) -> list[dict]:
        items: list[dict] = []
        for chunk in _chunks(list(dict.fromkeys(channel_ids)), 50):
            data = self._get("channels", {"part": "snippet,statistics,contentDetails", "id": ",".join(chunk)})
            items.extend(data.get("items", []))
        return items

    def recent_upload_ids(self, uploads_playlist_id: str, n: int) -> list[str]:
        data = self._get(
            "playlistItems",
            {"part": "contentDetails", "playlistId": uploads_playlist_id, "maxResults": min(max(n, 1), 50)},
        )
        return [it["contentDetails"]["videoId"] for it in data.get("items", []) if "contentDetails" in it]


def _error_reason(resp: requests.Response) -> tuple[str, str]:
    try:
        err = resp.json().get("error", {})
        errors = err.get("errors") or [{}]
        return str(errors[0].get("reason", "")), str(err.get("message", ""))
    except ValueError:
        return "", ""
