from radar.analysis.cluster import STOPWORDS, cluster_titles, title_tokens

DEEPFAKE_STORY = [
    ("v1", "Chuttamalle Song Fake AI Edit 😱 | Jr NTR & Janhvi Kapoor Deepfake Video 😮😮"),
    ("v2", "☠️💀 full strict warning ⚠️ Jr NTR Str Warning on AI Deepfake Video / Chuttamalle Video /"),
    ("v3", "Jr NTR AI Video Warning / Chuttamalle AI Video Song NTR serious / Jr NTR Tweet Today"),
    ("v4", "Janhvi Kapoor & Jr NTR AI Deepfake Controversy Explained! 🚨"),
]
OTHERS = [
    ("o1", "Can Someone HACK Your Phone Through Hotspot? 😳"),
    ("o2", "This Simple Water Trick Turns Your Phone Into an Eye Camera"),
    ("o3", "WhatsApp Hack Hai Ya Nahi Kaise Pata Kare? WhatsApp Security Check 2026"),
    ("o4", "Instagram Account HACK Hai Ya Nahi Kaise Pata Kare | How to check"),
    ("o5", "ASOS: thousands sent apparent hacker threat"),
    ("o6", "Hackers send message to Asos users saying platform has been hacked | ABC News"),
    ("o7", "Why your phone battery dies at 20% (it's not what you think)"),
    ("o8", "My mom got a call from 'me' — but it was an AI voice clone scam"),
    ("o9", "15-second garlic peeling trick"),
    ("o10", "iPhone 18 unboxing in 60 seconds"),
    ("o11", "Zelle scammers stole $2,000 from my grandma — here's how"),
]


def by_member(clusters):
    return {m: c for c in clusters for m in c.members}


def test_tokens_drop_noise_but_keep_hashtags_and_unicode():
    toks = title_tokens("chuttammalle song leaked ai deepfake #chuttamalle #devara #jrntr 2026 #shorts")
    assert {"chuttammalle", "chuttamalle", "devara", "jrntr", "leaked", "deepfake", "song"} <= toks
    assert "2026" not in toks and "shorts" not in toks and "ai" not in toks  # digits, stopword, too short
    assert title_tokens("スマホ乗っ取りの前兆は…") and title_tokens(None) == set()
    assert "hai" in STOPWORDS


def test_same_event_across_channels_is_one_cluster():
    clusters = cluster_titles(DEEPFAKE_STORY + OTHERS)
    m = by_member(clusters)
    assert {m[v].cluster_id for v, _ in DEEPFAKE_STORY} == {1}, "all four deepfake titles share a cluster"
    assert m["v1"].leader == "v1" and m["v1"].size == 4
    assert "chuttamalle" in m["v1"].shared_tokens or "ntr" in m["v1"].shared_tokens


def test_different_stories_stay_apart():
    clusters = cluster_titles(DEEPFAKE_STORY + OTHERS)
    m = by_member(clusters)
    assert m["o1"].size == 1 and m["o2"].size == 1 and m["o7"].size == 1
    # Shared Hindi function words and the generic "hack" do not glue WhatsApp and Instagram together.
    assert m["o3"].cluster_id != m["o4"].cluster_id
    # Two outlets on the same breach are linked by rare tokens (asos, hacker/hackers are different tokens).
    assert m["o5"].cluster_id == m["o6"].cluster_id


def test_cluster_order_follows_input_order_and_every_video_is_assigned():
    items = OTHERS + DEEPFAKE_STORY
    clusters = cluster_titles(items)
    assert [c.cluster_id for c in clusters] == list(range(1, len(clusters) + 1))
    assert clusters[0].leader == "o1"
    assert sorted(m for c in clusters for m in c.members) == sorted(v for v, _ in items)


def test_small_sets_do_not_overmerge_on_generic_words():
    items = [("a", "phone hack warning"), ("b", "phone hack trick"), ("c", "phone hack tutorial"), ("d", "phone hack news")]
    clusters = cluster_titles(items)
    # "phone" and "hack" occur in every title: not informative, so nothing links.
    assert all(c.size == 1 for c in clusters)


def test_empty_input():
    assert cluster_titles([]) == []


HASHTAG_SPAM = [  # one channel repeating the same hashtags on every upload
    ("h1", "Mobile Settings #cybersecurity #cybercrime #cyberpunk #cyberattack #safety #shorts", "UCspam"),
    ("h2", "Cyber Crime Ka Sabse bada Aadda..? #cybercrime #cybersecurity #cyberpunk #cyberattack #shorts", "UCspam"),
    ("h3", "Fraud Hone Par Kya Kare.? #cybercrime #cybersecurity #cyberpunk #cyberattack #cyberawareness", "UCspam"),
    ("h4", "SIM #cybercrime #cybersecurity #cyberpunk #cyberattack #awareness #safety #viral #shorts", "UCspam"),
]
BRIDGE = ("b1", "Janhvi Kapoor AI morphing video case #JanhviKapoor #Chuttamalle #CyberCrime #AI #Deepfake", "UCtelugu")


def test_channel_boilerplate_does_not_form_a_story():
    items = [(v, t, f"UC{v}") for v, t in DEEPFAKE_STORY] + HASHTAG_SPAM + [(v, t, f"UC{v}") for v, t in OTHERS]
    m = by_member(cluster_titles(items))
    assert all(m[h].size == 1 for h in ("h1", "h2", "h3", "h4")), "repeated channel hashtags are not a story"


def test_no_chaining_through_a_bridge_video():
    items = [(v, t, f"UC{v}") for v, t in DEEPFAKE_STORY] + [BRIDGE] + HASHTAG_SPAM + [(v, t, f"UC{v}") for v, t in OTHERS]
    m = by_member(cluster_titles(items, ignore_tokens={"deepfake"}))
    story = m["v1"]
    assert "b1" in story.members, "the bridge title links to the leader via janhvi/kapoor/chuttamalle"
    assert not any(h in story.members for h in ("h1", "h2", "h3", "h4")), "hashtag spam must not chain in via the bridge"
    assert story.leader == "v1"


def test_items_without_channel_still_work():
    assert by_member(cluster_titles(DEEPFAKE_STORY))["v4"].size == 4
