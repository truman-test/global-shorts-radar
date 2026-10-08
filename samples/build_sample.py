"""Generate samples/youtube_sample.json — SYNTHETIC data shaped like YouTube Data API v3 responses.

Scenarios covered:
  A1  small channel, 1,000,000 views vs 50,000 Shorts median  -> 20x outlier (spec example)
  B1  huge channel, most raw views but ~1.25x its normal      -> NOT an outlier
  C1  new channel with only 2 prior uploads                    -> outlier ratio not computable
  D1  10x outlier on a universal topic, but KR topic saturated
  E1  8x outlier on a US-specific topic (Zelle)                -> low localization potential
  F1  15x outlier, off-topic (cooking)                         -> low channel fit
  G1  3m40s video returned by search                           -> excluded (not a Short)
  H1  very fresh (6h), 8x outlier, high velocity
Second observation 6h later (stats_timeline, used by `radar track`):
  A1, H1 accelerating · E1, C1 steady · B1, D1, F1 cooling down
Run: python samples/build_sample.py
"""
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from radar.analysis.korea_gap import korean_query  # noqa: E402
from radar.config import load_settings  # noqa: E402

NOW = datetime(2026, 10, 3, 0, 0, tzinfo=timezone.utc)


def iso(hours_ago: float) -> str:
    return (NOW - timedelta(hours=hours_ago)).strftime("%Y-%m-%dT%H:%M:%SZ")


videos, channels, playlists = {}, {}, {}


def channel(cid, title, subs, country="US"):
    channels[cid] = {
        "kind": "youtube#channel", "id": cid,
        "snippet": {"title": title, "country": country},
        "statistics": {"subscriberCount": str(subs), "videoCount": "120", "viewCount": str(subs * 40),
                       "hiddenSubscriberCount": False},
        "contentDetails": {"relatedPlaylists": {"uploads": "UU" + cid[2:]}},
    }
    playlists["UU" + cid[2:]] = []


def video(vid, cid, title, views, hours_ago, duration="PT45S", likes=True, desc="", in_uploads=True):
    stats = {"viewCount": str(views), "commentCount": str(int(views * 0.002))}
    if likes:
        stats["likeCount"] = str(int(views * 0.04))
    videos[vid] = {
        "kind": "youtube#video", "id": vid,
        "snippet": {"publishedAt": iso(hours_ago), "channelId": cid, "title": title, "description": desc,
                    "channelTitle": channels[cid]["snippet"]["title"] if cid in channels else "", "tags": []},
        "contentDetails": {"duration": duration},
        "statistics": stats,
    }
    if in_uploads and cid in channels:
        playlists["UU" + cid[2:]].append(vid)


def baseline(cid, prefix, views_list, start_hours=72, duration="PT40S"):
    for i, v in enumerate(views_list):
        video(f"{prefix}_b{i:02d}", cid, f"{channels[cid]['snippet']['title']} short #{i}", v, start_hours + i * 30, duration)


# A: spec example — 20x outlier
channel("UCbytesized", "ByteSized Mysteries", 82_000)
video("smpl_A1", "UCbytesized", "My mom got a call from 'me' — but it was an AI voice clone scam", 1_000_000, 20,
      desc="How a 3-second clip of my voice was enough. What we learned and how to protect your family.")
video("smpl_A_new", "UCbytesized", "Quick update short", 2_000, 10)  # too new for baseline
baseline("UCbytesized", "A", [38_000, 42_000, 45_000, 47_000, 50_000, 50_000, 53_000, 55_000, 61_000, 70_000])
for i in range(3):  # long-form uploads with much higher views -> must not pollute Shorts baseline
    video(f"A_long{i}", "UCbytesized", f"Deep dive episode {i}", 300_000, 200 + i * 50, duration="PT12M30S")

# B: big channel, not an outlier
channel("UCtechgiant", "TechGiant Daily", 5_200_000)
video("smpl_B1", "UCtechgiant", "iPhone 18 unboxing in 60 seconds", 2_500_000, 30)
baseline("UCtechgiant", "B", [1_600_000, 1_800_000, 2_000_000, 2_000_000, 2_200_000, 2_400_000])

# C: insufficient history
channel("UCnewlab", "NewChannel Lab", 1_200)
video("smpl_C1", "UCnewlab", "This app tracked my location for 3 years and I never noticed", 300_000, 40)
baseline("UCnewlab", "C", [900, 1_400])

# D: universal topic, 10x
channel("UCphonefix", "PhoneFixLab", 410_000)
video("smpl_D1", "UCphonefix", "Why your phone battery dies at 20% (it's not what you think)", 400_000, 70)
baseline("UCphonefix", "D", [30_000, 35_000, 38_000, 40_000, 40_000, 44_000, 52_000])

# E: US-specific, 8x
channel("UCmoneysafe", "MoneySafe USA", 150_000)
video("smpl_E1", "UCmoneysafe", "Zelle scammers stole $2,000 from my grandma — here's how", 600_000, 50)
baseline("UCmoneysafe", "E", [60_000, 70_000, 75_000, 75_000, 80_000, 90_000])

# F: off-topic, 15x, likes hidden
channel("UCkitchen", "Kitchen Speedruns", 900_000)
video("smpl_F1", "UCkitchen", "15-second garlic peeling trick", 3_000_000, 30, likes=False)
baseline("UCkitchen", "F", [150_000, 180_000, 200_000, 200_000, 220_000, 260_000])

# G: not a Short (3m40s)
channel("UCdeepdoc", "Deep Doc", 640_000)
video("smpl_G1", "UCdeepdoc", "The full story of the biggest crypto exchange hack", 800_000, 60, duration="PT3M40S")
baseline("UCdeepdoc", "G", [100_000, 120_000, 150_000], duration="PT3M50S")

# H: very fresh, high velocity
channel("UCsignal", "Signal Noise", 60_000)
video("smpl_H1", "UCsignal", "Hackers can open your car with a $30 gadget?", 250_000, 6)
baseline("UCsignal", "H", [25_000, 28_000, 30_000, 30_000, 33_000, 41_000])


def search_response(ids):
    return {"kind": "youtube#searchListResponse",
            "items": [{"kind": "youtube#searchResult", "id": {"kind": "youtube#video", "videoId": v}} for v in ids]}


search = [
    {"match": {"q": "AI scam", "regionCode": "US"}, "response": search_response(["smpl_A1", "smpl_E1"])},
    {"match": {"q": "phone hack", "regionCode": "US"}, "response": search_response(["smpl_B1", "smpl_D1", "smpl_H1"])},
    {"match": {"q": "cybercrime", "regionCode": "US"}, "response": search_response(["smpl_G1", "smpl_E1"])},
    {"match": {"q": "deepfake", "regionCode": "US"}, "response": search_response(["smpl_A1"])},
    {"match": {"q": "weird technology", "regionCode": "US"}, "response": search_response(["smpl_F1", "smpl_C1"])},
    {"match": {"q": "internet mystery", "regionCode": "US"}, "response": search_response(["smpl_C1"])},
]

# Korean-market search results for the opt-in Korea gap check (queries built by the real code).
settings = load_settings(ROOT / "config" / "radar.toml", env={})
kr_channel = "UCkrsample"
channel(kr_channel, "KR Sample Channel", 300_000, country="KR")
kr_plan = {
    "smpl_A1": [12_000, 8_000],                                        # barely covered in KR -> big gap
    "smpl_D1": [900_000, 1_200_000, 700_000, 2_000_000, 1_500_000, 800_000],  # saturated
    "smpl_H1": [150_000, 90_000, 60_000],
    "smpl_E1": [400_000, 650_000, 300_000, 900_000],                     # generic scam topic well covered
}
for vid, view_list in kr_plan.items():
    q = korean_query(videos[vid]["snippet"]["title"], settings.korean_terms)
    ids = []
    for i, v in enumerate(view_list):
        kid = f"kr_{vid[-2:]}_{i}"
        video(kid, kr_channel, f"[KR] {q} #{i}", v, 100 + i * 24, in_uploads=False)
        ids.append(kid)
    search.append({"match": {"q": q, "regionCode": "KR"}, "response": search_response(ids)})

# Views 6 hours after NOW. Lifetime average at NOW -> views gained in the next 6h:
#   A1 50k/h -> 75k/h (1.5x)   H1 41.7k/h -> 66.7k/h (1.6x)   E1 12k/h -> 12k/h   C1 7.5k/h -> 7.5k/h
#   B1 83k/h -> 20k/h (0.24x)  D1 5.7k/h -> 1.7k/h (0.29x)    F1 100k/h -> 50k/h (0.5x)
TRACK_NOW = NOW + timedelta(hours=6)
later_views = {"smpl_A1": 1_450_000, "smpl_H1": 650_000, "smpl_E1": 672_000, "smpl_C1": 345_000,
               "smpl_B1": 2_620_000, "smpl_D1": 410_000, "smpl_F1": 3_300_000, "smpl_G1": 830_000}
stats_timeline = {}
for vid, views in later_views.items():
    later = dict(videos[vid]["statistics"], viewCount=str(views), commentCount=str(int(views * 0.002)))
    if "likeCount" in later:
        later["likeCount"] = str(int(views * 0.04))
    stats_timeline[vid] = [{"at": TRACK_NOW.strftime("%Y-%m-%dT%H:%M:%SZ"), "statistics": later}]

out = {
    "_note": "SYNTHETIC fixture for offline pipeline validation. Not real YouTube data.",
    "fixture_now": NOW.strftime("%Y-%m-%dT%H:%M:%SZ"),
    "fixture_track_now": TRACK_NOW.strftime("%Y-%m-%dT%H:%M:%SZ"),
    "search": search, "videos": videos, "channels": channels, "playlists": playlists,
    "stats_timeline": stats_timeline,
}
# Newest uploads first, like the real uploads playlist.
for pl, ids in playlists.items():
    ids.sort(key=lambda v: videos[v]["snippet"]["publishedAt"], reverse=True)
(ROOT / "samples" / "youtube_sample.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"wrote {len(videos)} videos, {len(channels)} channels, {len(search)} searches")
