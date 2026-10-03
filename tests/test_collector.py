import pytest
import requests

from radar.collectors.youtube import (QuotaBudgetError, QuotaExceededError, QuotaTracker, YouTubeAPIError,
                                      YouTubeClient, redact)

KEY = "AIzaSECRET-test-key"


class FakeResp:
    def __init__(self, status, payload):
        self.status_code, self._payload = status, payload

    def json(self):
        return self._payload


class FakeSession:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def get(self, url, params=None, timeout=None):
        self.calls.append((url, dict(params)))
        r = self.responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


def client(responses, budget=10_000, sink=None):
    s = FakeSession(responses)
    return YouTubeClient(KEY, session=s, quota=QuotaTracker(budget), raw_sink=sink, sleep=lambda _: None), s


def test_search_params_and_raw_sink_without_key():
    captured = []
    c, s = client([FakeResp(200, {"items": []})], sink=lambda e, p, d: captured.append((e, p, d)))
    c.search_shorts("AI scam", region_code="US", published_after="2026-09-26T00:00:00Z", max_results=10)
    url, params = s.calls[0]
    assert url.endswith("/search")
    assert params["videoDuration"] == "short" and params["type"] == "video" and params["regionCode"] == "US"
    assert params["maxResults"] == 10 and params["key"] == KEY
    assert captured[0][0] == "search" and "key" not in captured[0][1]
    assert c.quota.used == 100


def test_videos_batches_by_50_and_dedupes():
    ids = [f"v{i}" for i in range(120)] + ["v0"]
    c, s = client([FakeResp(200, {"items": [{"id": "x"}]})] * 3)
    items = c.videos(ids)
    assert len(s.calls) == 3 and len(items) == 3
    assert len(s.calls[0][1]["id"].split(",")) == 50 and len(s.calls[2][1]["id"].split(",")) == 20


def test_local_budget_stops_before_call():
    c, s = client([FakeResp(200, {})], budget=150)
    c.search_shorts("a")
    with pytest.raises(QuotaBudgetError):
        c.search_shorts("b")
    assert len(s.calls) == 1


def test_quota_exceeded_mapping():
    err = {"error": {"message": "quota", "errors": [{"reason": "quotaExceeded"}]}}
    c, _ = client([FakeResp(403, err)])
    with pytest.raises(QuotaExceededError):
        c.videos(["a"])


def test_invalid_key_message_has_no_key():
    err = {"error": {"message": "API key not valid. Please pass a valid API key.", "errors": [{"reason": "badRequest"}]}}
    c, _ = client([FakeResp(400, err)])
    with pytest.raises(YouTubeAPIError) as ei:
        c.videos(["a"])
    assert "invalid" in str(ei.value) and KEY not in str(ei.value)


def test_network_error_is_redacted_and_retried():
    boom = requests.ConnectionError(f"Max retries exceeded with url: /youtube/v3/videos?id=a&key={KEY}")
    c, s = client([boom] * 4)
    with pytest.raises(YouTubeAPIError) as ei:
        c.videos(["a"])
    assert len(s.calls) == 4 and KEY not in str(ei.value) and "key=***" in str(ei.value)


def test_retries_5xx_then_succeeds():
    c, s = client([FakeResp(503, {}), FakeResp(200, {"items": [{"id": "a"}]})])
    assert c.videos(["a"]) == [{"id": "a"}] and len(s.calls) == 2


def test_missing_key_rejected_and_repr_safe():
    with pytest.raises(YouTubeAPIError):
        YouTubeClient("")
    c, _ = client([])
    assert KEY not in repr(c)


def test_redact():
    assert redact("x?key=abc&y=1") == "x?key=***&y=1"
    assert redact("token abc here", "abc") == "token *** here"
