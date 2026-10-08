# Global Shorts Radar — 2026-10-03 06:00 UTC

> **FIXTURE MODE** — synthetic sample data, not real YouTube videos. Use for pipeline validation only.

> Viral videos are **idea signals, not information sources**. Every candidate below is **UNVERIFIED** until independent fact research is recorded. Do not copy, translate or re-upload source content — extract Story DNA and build an original Korean story.

Run #2 · searches: 0 · candidates: 8 · estimated quota used: 1

Weights `v0.1-live`: Outlier Ratio 25 · View Velocity 20 · Freshness 10 · Story Strength 15 · Korea Localization Gap 15 · Localization Potential 10 · Channel Fit 5

Score legend: metric dimensions are computed from observed API data; judgment dimensions show their source (`heuristic_v0` = keyword guess, low confidence · `manual` = human · `derived:kr_search_v0` = Korean YouTube search proxy). Missing dimensions score 0 (score is a lower bound, marked *provisional*).

Trend = views/hour between the last two observations ÷ the video's average views/hour before that (↑ ≥1.2x accelerating · → steady · ↓ ≤0.8x cooling · — needs `radar track`). Derived data shown for context; it is **not** part of the Radar Score.

Story = candidates whose titles describe the same event (`derived:title_cluster_v0`, derived from title overlap, not part of the score). The ranking shows one row per story (its best-scoring video); `×N` = N videos cover it. Every video is listed in the CSV.

## Ranking

| # | Score | Story | Outlier | Views/h | Trend | Age (h) | Views | Topic fit | Title | Channel | Verified |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 85.6 |  | 29.0x | 55,769 | ↑1.5x/6h | 26 | 1,450,000 | core | [My mom got a call from 'me' — but it was an AI voice clone scam](https://www.youtube.com/shorts/smpl_A1) | ByteSized Mysteries | UNVERIFIED |
| 2 | 76.1 |  | 21.7x | 54,167 | ↑1.6x/6h | 12 | 650,000 | partial | [Hackers can open your car with a $30 gadget?](https://www.youtube.com/shorts/smpl_H1) | Signal Noise | UNVERIFIED |
| 3 | 55.3 |  | 9.0x | 12,000 | →1.0x/6h | 56 | 672,000 | partial | [Zelle scammers stole $2,000 from my grandma — here's how](https://www.youtube.com/shorts/smpl_E1) | MoneySafe USA | UNVERIFIED |
| 4 | 54.0 |  | 10.2x | 5,395 | ↓0.3x/6h | 76 | 410,000 | partial | [Why your phone battery dies at 20% (it's not what you think)](https://www.youtube.com/shorts/smpl_D1) | PhoneFixLab | UNVERIFIED |
| 5 | 53.7* |  | 16.5x | 91,667 | ↓0.5x/6h | 36 | 3,300,000 | off-topic? | [15-second garlic peeling trick](https://www.youtube.com/shorts/smpl_F1) | Kitchen Speedruns | UNVERIFIED |
| 6 | 44.9* |  | n/a | 7,500 | →1.0x/6h | 46 | 345,000 | core | [This app tracked my location for 3 years and I never noticed](https://www.youtube.com/shorts/smpl_C1) | NewChannel Lab | UNVERIFIED |
| 7 | 43.0* |  | 1.3x | 72,778 | ↓0.2x/6h | 36 | 2,620,000 | partial | [iPhone 18 unboxing in 60 seconds](https://www.youtube.com/shorts/smpl_B1) | TechGiant Daily | UNVERIFIED |

`*` = provisional (some dimensions missing).

## Candidates

### 1. My mom got a call from 'me' — but it was an AI voice clone scam

- Link: https://www.youtube.com/shorts/smpl_A1 · Channel: ByteSized Mysteries · Found by: AI scam (US), deepfake (US)
- Fact status: **UNVERIFIED** — the story's claims have not been checked against official/news sources
- Radar Score: **85.6** / 100

**Observed** (YouTube Data API, as of 2026-10-03T06:00:00Z)

views 1,450,000 · likes 58,000 · comments 2,900 · channel subscribers 82,000 · published 2026-10-02T04:00:00Z · duration 45s

**Derived** (deterministic)

outlier ratio 29.0x (baseline: 50,000 median over 10 recent Shorts) · views/hour 55,769 · age 26h · freshness 0.69 · engagement 4.2%

trend ↑1.5x/6h: 75,000 views/hour over the last 6h (2 observations)

**Score breakdown**

| Dimension | Type | Value | Points | Source / rationale |
|---|---|---|---|---|
| Outlier Ratio | metric | 0.86 | 21.5/25 | derived:metrics |
| View Velocity | metric | 1.00 | 20.0/20 | derived:metrics |
| Freshness | metric | 0.69 | 6.9/10 | derived:metrics |
| Story Strength | judgment | 0.68 | 10.2/15 | heuristic_v0: title hook cues: number, curiosity, conflict, personal |
| Korea Localization Gap | judgment | 1.00 | 15.0/15 | derived:kr_search_v0: KR search '목소리 복제 사기 AI': 2 results, 20,000 total views |
| Localization Potential | judgment | 0.75 | 7.5/10 | heuristic_v0: universal: ai, scam, voice |
| Channel Fit | judgment | 0.90 | 4.5/5 | heuristic_v0: topic categories matched (2): ai: ai, voice clone; scam: scam |

**Story DNA — to fill by analyst/LLM (do not transcribe the source)**

- [ ] Topic:
- [ ] Hook:
- [ ] Curiosity Gap:
- [ ] Conflict:
- [ ] Emotion:
- [ ] Story Progression:
- [ ] Reveal:
- [ ] Payoff:
- [ ] Audience Desire/Fear:
- [ ] Why It Went Viral:
- [ ] Independent sources found (official → police/company → major news → specialist):
- [ ] Original Korean angle (must stand on its own without the source video):

### 2. Hackers can open your car with a $30 gadget?

- Link: https://www.youtube.com/shorts/smpl_H1 · Channel: Signal Noise · Found by: phone spyware (US)
- Fact status: **UNVERIFIED** — the story's claims have not been checked against official/news sources
- Radar Score: **76.1** / 100

**Observed** (YouTube Data API, as of 2026-10-03T06:00:00Z)

views 650,000 · likes 26,000 · comments 1,300 · channel subscribers 60,000 · published 2026-10-02T18:00:00Z · duration 45s

**Derived** (deterministic)

outlier ratio 21.7x (baseline: 30,000 median over 6 recent Shorts) · views/hour 54,167 · age 12h · freshness 0.84 · engagement 4.2%

trend ↑1.6x/6h: 66,667 views/hour over the last 6h (2 observations)

**Score breakdown**

| Dimension | Type | Value | Points | Source / rationale |
|---|---|---|---|---|
| Outlier Ratio | metric | 0.79 | 19.7/25 | derived:metrics |
| View Velocity | metric | 1.00 | 20.0/20 | derived:metrics |
| Freshness | metric | 0.84 | 8.4/10 | derived:metrics |
| Story Strength | judgment | 0.56 | 8.4/15 | heuristic_v0: title hook cues: question, number, conflict |
| Korea Localization Gap | judgment | 0.61 | 9.2/15 | derived:kr_search_v0: KR search '해커': 3 results, 300,000 total views |
| Localization Potential | judgment | 0.75 | 7.5/10 | heuristic_v0: universal: hacker |
| Channel Fit | judgment | 0.60 | 3.0/5 | heuristic_v0: topic categories matched (1): cybercrime: hacker, hackers |

**Story DNA — to fill by analyst/LLM (do not transcribe the source)**

- [ ] Topic:
- [ ] Hook:
- [ ] Curiosity Gap:
- [ ] Conflict:
- [ ] Emotion:
- [ ] Story Progression:
- [ ] Reveal:
- [ ] Payoff:
- [ ] Audience Desire/Fear:
- [ ] Why It Went Viral:
- [ ] Independent sources found (official → police/company → major news → specialist):
- [ ] Original Korean angle (must stand on its own without the source video):

### 3. Zelle scammers stole $2,000 from my grandma — here's how

- Link: https://www.youtube.com/shorts/smpl_E1 · Channel: MoneySafe USA · Found by: AI scam (US), data breach (US)
- Fact status: **UNVERIFIED** — the story's claims have not been checked against official/news sources
- Radar Score: **55.3** / 100

**Observed** (YouTube Data API, as of 2026-10-03T06:00:00Z)

views 672,000 · likes 26,880 · comments 1,344 · channel subscribers 150,000 · published 2026-09-30T22:00:00Z · duration 45s

**Derived** (deterministic)

outlier ratio 9.0x (baseline: 75,000 median over 6 recent Shorts) · views/hour 12,000 · age 56h · freshness 0.45 · engagement 4.2%

trend →1.0x/6h: 12,000 views/hour over the last 6h (2 observations)

**Score breakdown**

| Dimension | Type | Value | Points | Source / rationale |
|---|---|---|---|---|
| Outlier Ratio | metric | 0.56 | 14.0/25 | derived:metrics |
| View Velocity | metric | 1.00 | 20.0/20 | derived:metrics |
| Freshness | metric | 0.45 | 4.5/10 | derived:metrics |
| Story Strength | judgment | 0.68 | 10.2/15 | heuristic_v0: title hook cues: number, curiosity, conflict, personal |
| Korea Localization Gap | judgment | 0.17 | 2.6/15 | derived:kr_search_v0: KR search '사기꾼': 4 results, 2,250,000 total views |
| Localization Potential | judgment | 0.10 | 1.0/10 | heuristic_v0: region-specific (hard to localize): zelle |
| Channel Fit | judgment | 0.60 | 3.0/5 | heuristic_v0: topic categories matched (1): scam: scammer, scammers, stole |

**Story DNA — to fill by analyst/LLM (do not transcribe the source)**

- [ ] Topic:
- [ ] Hook:
- [ ] Curiosity Gap:
- [ ] Conflict:
- [ ] Emotion:
- [ ] Story Progression:
- [ ] Reveal:
- [ ] Payoff:
- [ ] Audience Desire/Fear:
- [ ] Why It Went Viral:
- [ ] Independent sources found (official → police/company → major news → specialist):
- [ ] Original Korean angle (must stand on its own without the source video):

### 4. Why your phone battery dies at 20% (it's not what you think)

- Link: https://www.youtube.com/shorts/smpl_D1 · Channel: PhoneFixLab · Found by: phone spyware (US)
- Fact status: **UNVERIFIED** — the story's claims have not been checked against official/news sources
- Radar Score: **54.0** / 100

**Observed** (YouTube Data API, as of 2026-10-03T06:00:00Z)

views 410,000 · likes 16,400 · comments 820 · channel subscribers 410,000 · published 2026-09-30T02:00:00Z · duration 45s

**Derived** (deterministic)

outlier ratio 10.2x (baseline: 40,000 median over 7 recent Shorts) · views/hour 5,395 · age 76h · freshness 0.33 · engagement 4.2%

trend ↓0.3x/6h: 1,667 views/hour over the last 6h (2 observations)

**Score breakdown**

| Dimension | Type | Value | Points | Source / rationale |
|---|---|---|---|---|
| Outlier Ratio | metric | 0.59 | 14.9/25 | derived:metrics |
| View Velocity | metric | 0.93 | 18.7/20 | derived:metrics |
| Freshness | metric | 0.33 | 3.3/10 | derived:metrics |
| Story Strength | judgment | 0.44 | 6.6/15 | heuristic_v0: title hook cues: number, curiosity |
| Korea Localization Gap | judgment | 0.00 | 0.0/15 | derived:kr_search_v0: KR search '배터리 휴대폰': 6 results, 7,100,000 total views |
| Localization Potential | judgment | 0.75 | 7.5/10 | heuristic_v0: universal: phone, battery |
| Channel Fit | judgment | 0.60 | 3.0/5 | heuristic_v0: topic categories matched (1): smartphone: phone, battery |

**Story DNA — to fill by analyst/LLM (do not transcribe the source)**

- [ ] Topic:
- [ ] Hook:
- [ ] Curiosity Gap:
- [ ] Conflict:
- [ ] Emotion:
- [ ] Story Progression:
- [ ] Reveal:
- [ ] Payoff:
- [ ] Audience Desire/Fear:
- [ ] Why It Went Viral:
- [ ] Independent sources found (official → police/company → major news → specialist):
- [ ] Original Korean angle (must stand on its own without the source video):

### 5. 15-second garlic peeling trick

- Link: https://www.youtube.com/shorts/smpl_F1 · Channel: Kitchen Speedruns · Found by: weird technology (US)
- Fact status: **UNVERIFIED** — the story's claims have not been checked against official/news sources
- Radar Score: **53.7** / 100 — provisional, missing: Korea Localization Gap

**Observed** (YouTube Data API, as of 2026-10-03T06:00:00Z)

views 3,300,000 · likes hidden · comments 6,600 · channel subscribers 900,000 · published 2026-10-01T18:00:00Z · duration 45s

**Derived** (deterministic)

outlier ratio 16.5x (baseline: 200,000 median over 6 recent Shorts) · views/hour 91,667 · age 36h · freshness 0.59 · engagement 0.2%

trend ↓0.5x/6h: 50,000 views/hour over the last 6h (2 observations)

**Score breakdown**

| Dimension | Type | Value | Points | Source / rationale |
|---|---|---|---|---|
| Outlier Ratio | metric | 0.72 | 17.9/25 | derived:metrics |
| View Velocity | metric | 1.00 | 20.0/20 | derived:metrics |
| Freshness | metric | 0.59 | 6.0/10 | derived:metrics |
| Story Strength | judgment | 0.32 | 4.8/15 | heuristic_v0: title hook cues: number |
| Korea Localization Gap | judgment | — | 0.0/15 | missing |
| Localization Potential | judgment | 0.45 | 4.5/10 | heuristic_v0: no localization cues |
| Channel Fit | judgment | 0.10 | 0.5/5 | heuristic_v0: topic categories matched (0): no digital-topic terms |

**Story DNA — to fill by analyst/LLM (do not transcribe the source)**

- [ ] Topic:
- [ ] Hook:
- [ ] Curiosity Gap:
- [ ] Conflict:
- [ ] Emotion:
- [ ] Story Progression:
- [ ] Reveal:
- [ ] Payoff:
- [ ] Audience Desire/Fear:
- [ ] Why It Went Viral:
- [ ] Independent sources found (official → police/company → major news → specialist):
- [ ] Original Korean angle (must stand on its own without the source video):

### 6. This app tracked my location for 3 years and I never noticed

- Link: https://www.youtube.com/shorts/smpl_C1 · Channel: NewChannel Lab · Found by: internet mystery (US), weird technology (US)
- Fact status: **UNVERIFIED** — the story's claims have not been checked against official/news sources
- Radar Score: **44.9** / 100 — provisional, missing: Outlier Ratio, Korea Localization Gap

**Observed** (YouTube Data API, as of 2026-10-03T06:00:00Z)

views 345,000 · likes 13,800 · comments 690 · channel subscribers 1,200 · published 2026-10-01T08:00:00Z · duration 45s

**Derived** (deterministic)

outlier ratio n/a (baseline: not enough channel history (2 eligible uploads)) · views/hour 7,500 · age 46h · freshness 0.51 · engagement 4.2%

trend →1.0x/6h: 7,500 views/hour over the last 6h (2 observations)

**Score breakdown**

| Dimension | Type | Value | Points | Source / rationale |
|---|---|---|---|---|
| Outlier Ratio | metric | — | 0.0/25 | derived:metrics |
| View Velocity | metric | 0.97 | 19.4/20 | derived:metrics |
| Freshness | metric | 0.51 | 5.2/10 | derived:metrics |
| Story Strength | judgment | 0.56 | 8.4/15 | heuristic_v0: title hook cues: number, negation/warning, personal |
| Korea Localization Gap | judgment | — | 0.0/15 | missing |
| Localization Potential | judgment | 0.75 | 7.5/10 | heuristic_v0: universal: app |
| Channel Fit | judgment | 0.90 | 4.5/5 | heuristic_v0: topic categories matched (2): apps_social: app; privacy: tracked, location |

**Story DNA — to fill by analyst/LLM (do not transcribe the source)**

- [ ] Topic:
- [ ] Hook:
- [ ] Curiosity Gap:
- [ ] Conflict:
- [ ] Emotion:
- [ ] Story Progression:
- [ ] Reveal:
- [ ] Payoff:
- [ ] Audience Desire/Fear:
- [ ] Why It Went Viral:
- [ ] Independent sources found (official → police/company → major news → specialist):
- [ ] Original Korean angle (must stand on its own without the source video):

### 7. iPhone 18 unboxing in 60 seconds

- Link: https://www.youtube.com/shorts/smpl_B1 · Channel: TechGiant Daily · Found by: phone spyware (US)
- Fact status: **UNVERIFIED** — the story's claims have not been checked against official/news sources
- Radar Score: **43.0** / 100 — provisional, missing: Korea Localization Gap

**Observed** (YouTube Data API, as of 2026-10-03T06:00:00Z)

views 2,620,000 · likes 104,800 · comments 5,240 · channel subscribers 5,200,000 · published 2026-10-01T18:00:00Z · duration 45s

**Derived** (deterministic)

outlier ratio 1.3x (baseline: 2,000,000 median over 6 recent Shorts) · views/hour 72,778 · age 36h · freshness 0.59 · engagement 4.2%

trend ↓0.2x/6h: 20,000 views/hour over the last 6h (2 observations)

**Score breakdown**

| Dimension | Type | Value | Points | Source / rationale |
|---|---|---|---|---|
| Outlier Ratio | metric | 0.07 | 1.7/25 | derived:metrics |
| View Velocity | metric | 1.00 | 20.0/20 | derived:metrics |
| Freshness | metric | 0.59 | 6.0/10 | derived:metrics |
| Story Strength | judgment | 0.32 | 4.8/15 | heuristic_v0: title hook cues: number |
| Korea Localization Gap | judgment | — | 0.0/15 | missing |
| Localization Potential | judgment | 0.75 | 7.5/10 | heuristic_v0: universal: iphone |
| Channel Fit | judgment | 0.60 | 3.0/5 | heuristic_v0: topic categories matched (1): smartphone: iphone |

**Story DNA — to fill by analyst/LLM (do not transcribe the source)**

- [ ] Topic:
- [ ] Hook:
- [ ] Curiosity Gap:
- [ ] Conflict:
- [ ] Emotion:
- [ ] Story Progression:
- [ ] Reveal:
- [ ] Payoff:
- [ ] Audience Desire/Fear:
- [ ] Why It Went Viral:
- [ ] Independent sources found (official → police/company → major news → specialist):
- [ ] Original Korean angle (must stand on its own without the source video):
