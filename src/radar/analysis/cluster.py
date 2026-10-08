"""Story clustering: group candidates whose titles describe the same event or topic.

Derived and deterministic: computed from observed titles only, at report time, with no I/O and
no model. One story covered by many channels is a stronger topic signal than a single video,
and collapsing it keeps one event from filling the whole ranking. Cluster membership is shown
next to the Radar Score; it is never added to it.

Conservative by design:
- Only *informative* tokens count: not stopwords, not search keywords or lexicon terms, not
  tokens common across the candidate set, and not a channel's own boilerplate (hashtags a
  channel repeats on most of its uploads say who posted it, not what happened).
- A video joins a story only if its title links to that story's *leader* (its best-ranked
  video). Linking members to members would chain unrelated stories together through bridges.
Missing a link is cheaper than merging two different stories, so singletons are common.
"""
from __future__ import annotations

import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Iterable

SOURCE = "derived:title_cluster_v0"

MIN_TOKEN_LEN = 3
MIN_SHARED = 2          # informative tokens a title must share with the leader to be linked ...
MIN_OVERLAP = 0.3       # ... and the share of the smaller title's informative tokens they cover
STRONG_SHARED = 3       # or this many shared tokens regardless of overlap
MAX_DOC_FREQ = 0.2      # tokens in more than this share of titles carry no story information
MIN_DOC_FREQ_ABS = 3    # ... but with few titles, allow up to this many occurrences
CHANNEL_BOILERPLATE = 3  # a token in this many titles of one channel is that channel's signature

# Generic words in Shorts titles: English function words and clickbait filler, platform jargon,
# and romanized Hindi function words that otherwise glue unrelated "X hack hai ya nahi" videos.
STOPWORDS = frozenset("""
the and for you your yours with this that these those from into onto out over under what when where
why how who whom which will would can could should shall may might must have has had was were are
is be been being not but nor yet so if then than too very just only also even still ever never
about after before again all any both each few more most other some such own same off
shorts short video videos viral trending subscribe like share comment follow new latest update
today now full part episode official reel reels tiktok youtube ytshorts fyp
check know find make made get got use using see watch learn tip tips trick tricks tutorial explained
guide best top secret secrets real true story stories thing things people world time day days year
years way ways one two three first last big small free easy simple amazing crazy shocking insane
need always everyone everything someone something anyone anything here there
hai nahi kaise pata kare kya aap apna apne mein hain yeh kyu kyun aur tha kar karo karein wala wale
""".split())

_TOKEN = re.compile(r"[^\W_]+", re.UNICODE)


def _stem(token: str) -> str:
    """Light plural stripping so 'hackers' and 'hacker' compare equal."""
    if len(token) > 4 and token.endswith("s") and not token.endswith("ss"):
        return token[:-1]
    return token


def title_tokens(title: str | None, ignore: Iterable[str] = ()) -> set[str]:
    """Lowercased, NFKC-normalized word tokens minus stopwords, digits, short words and `ignore`."""
    text = unicodedata.normalize("NFKC", title or "").lower()
    ignore = set(ignore)
    words = (w for w in _TOKEN.findall(text) if w not in STOPWORDS)  # before stemming: 'always', 'stories'
    return {t for t in (_stem(w) for w in words)
            if len(t) >= MIN_TOKEN_LEN and not t.isdigit() and t not in STOPWORDS and t not in ignore}


def generic_tokens(*term_lists: Iterable[str]) -> set[str]:
    """Tokens of search keywords / lexicon terms: present by construction, so never story-specific."""
    out: set[str] = set()
    for terms in term_lists:
        for term in terms:
            out |= title_tokens(term)
    return out


@dataclass
class Cluster:
    cluster_id: int
    members: list[str] = field(default_factory=list)   # video ids, in input order (best first)
    shared_tokens: list[str] = field(default_factory=list)  # tokens in >= 2 members, most common first

    @property
    def leader(self) -> str:
        return self.members[0]

    @property
    def size(self) -> int:
        return len(self.members)


def _informative(raw: dict[str, set[str]], channel_of: dict[str, str | None]) -> dict[str, set[str]]:
    n = len(raw)
    df = Counter(t for toks in raw.values() for t in toks)
    limit = max(MIN_DOC_FREQ_ABS, int(MAX_DOC_FREQ * n))
    per_channel: dict[str | None, Counter] = defaultdict(Counter)
    for vid, toks in raw.items():
        if channel_of.get(vid):
            per_channel[channel_of[vid]].update(toks)
    out = {}
    for vid, toks in raw.items():
        boilerplate = {t for t, c in per_channel[channel_of.get(vid)].items() if c >= CHANNEL_BOILERPLATE}
        out[vid] = {t for t in toks if df[t] <= limit and t not in boilerplate}
    return out


def _linked(a: set[str], b: set[str]) -> bool:
    if not a or not b:
        return False
    shared = len(a & b)
    if shared >= STRONG_SHARED:
        return True
    return shared >= MIN_SHARED and shared / min(len(a), len(b)) >= MIN_OVERLAP


def cluster_titles(items: list[tuple], ignore_tokens: Iterable[str] = ()) -> list[Cluster]:
    """items: (video_id, title[, channel_id]) in ranking order. Returns clusters ordered by their best member.

    Greedy leader linkage: walking down the ranking, each video joins the first existing cluster
    whose leader its title links to, else it starts a new cluster. Every video belongs to exactly
    one cluster; singletons are returned too so callers can treat membership uniformly.
    `ignore_tokens` (e.g. search keywords) never count as evidence.
    """
    ids = [it[0] for it in items]
    channel_of = {it[0]: (it[2] if len(it) > 2 else None) for it in items}
    raw = {it[0]: title_tokens(it[1], ignore_tokens) for it in items}
    tokens = _informative(raw, channel_of)

    clusters: list[Cluster] = []
    for vid in ids:
        for c in clusters:
            if _linked(tokens[c.leader], tokens[vid]):
                c.members.append(vid)
                break
        else:
            clusters.append(Cluster(len(clusters) + 1, [vid]))
    for c in clusters:
        if c.size > 1:
            counts = Counter(t for m in c.members for t in raw[m])
            c.shared_tokens = [t for t, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])) if n >= 2]
    return clusters
