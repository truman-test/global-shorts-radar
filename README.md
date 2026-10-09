# Global Shorts Radar

전 세계에서 빠르게 반응하고 있는 **디지털 관련 Shorts를 탐지**하고, 왜 반응했는지 분석할 수 있는 형태로 정리해
**한국 시장에서 독창적인 콘텐츠로 재창작할 가치가 있는 소재**를 찾는 Content Intelligence System입니다.

> 이 시스템은 영상을 복제하지 않습니다. 원본은 *Idea Signal*일 뿐이며, 가져오는 것은 콘텐츠가 아니라 Story DNA입니다.
> 다운로드 · 재업로드 · 대본 추출/번역 · 워터마크 제거 기능은 **의도적으로 존재하지 않습니다**.
> 수집기는 YouTube Data API의 메타데이터 엔드포인트(search, videos, channels, playlistItems)만 호출합니다.

## 현재 범위 (v0.2)

```
Collectors → Raw Storage → Metrics → Scoring → Analysis(heuristic/manual) → Reports
     ↑ track (반복 관측, 저비용) ─┘
```

| 계층 | 모듈 | 내용 |
|---|---|---|
| Collectors | `radar/collectors/youtube.py` | YouTube Data API v3 (HTTP만, scoring 없음). 키워드 검색 + seed 채널 최근 업로드. 재시도, quota 예산, 오류 시 API 키 마스킹 |
| | `radar/collectors/fixture.py` | 동일 인터페이스의 오프라인 수집기 (합성 샘플 데이터) |
| Raw Storage | `radar/storage/db.py` | SQLite. 원본 API 응답(`raw_responses`) 보존 |
| Metrics | `radar/metrics/compute.py` | 순수 함수: views/hour, outlier ratio, freshness, engagement, Shorts 판정 |
| Scoring | `radar/scoring/radar.py` | 0–100 Radar Score. 가중치는 `config/radar.toml` |
| Analysis | `radar/analysis/` | `heuristic_v0`(제목 키워드 기반 저신뢰 판단), 수동 CSV 판단 import, 한국 포화도 체크(opt-in), 제목 기반 같은 사건 묶기(`cluster.py`) |
| Reports | `radar/reports/build.py` | Markdown 리포트 + CSV export |

### 데이터 원칙: Observed / Derived / Judgment 분리

| 구분 | 테이블 | 예 |
|---|---|---|
| Raw | `raw_responses` | API 응답 JSON 원본 (키 제외) |
| Observed | `videos`, `video_snapshots`, `channels`, `channel_snapshots`, `discoveries` | 조회수, 좋아요, 댓글, 구독자, 게시시각, 길이, 발견 출처(`source`: keyword / seed_channel, `query`, `region`, `discovered_at`) |
| Derived (결정적 계산) | `metrics`, `scores` | views_per_hour, outlier_ratio, freshness, radar_score |
| Judgment (판단) | `judgments` | story_strength, localization_potential, channel_fit, korea_localization_gap — **모든 행에 `source` 기록** |
| Fact check | `verification` | 기본값 `unverified` |

`judgments.source` 우선순위: `manual` > `llm:*` > `derived:*` > `heuristic_v0`.
AI(LLM)가 내린 판단은 `radar judge --import x.csv --source llm:<모델명>`으로 넣습니다. 사람 판단(`manual`)보다 낮은 우선순위로 저장되고 리포트에 출처가 그대로 표시됩니다.
지금까지 들어간 판단 파일은 `judgments/`에 날짜·출처별로 보관합니다 (예: `judgments/2026-10-08_llm_claude-fable-5-1.csv`, 제목·설명·지표만 보고 내린 AI 판단, 영상 미시청).
판단 값은 절대 observed 테이블에 섞이지 않으며, 리포트에서도 출처와 함께 표시됩니다.

### Radar Score

| 차원 | 가중치 | 유형 | 정규화 |
|---|---|---|---|
| Outlier Ratio | 25 | metric | `log(ratio)/log(50)`, 1x 이하 = 0 |
| View Velocity | 20 | metric | `log10(1+vph)/log10(1+10k)` |
| Freshness | 10 | metric | 반감기 48h 지수 감쇠 |
| Story Strength | 15 | judgment | heuristic_v0 / manual / (향후 LLM) |
| Korea Localization Gap | 15 | judgment | `--check-korea` 시 KR 검색 포화도 (opt-in) |
| Localization Potential | 10 | judgment | heuristic_v0 / manual |
| Channel Fit | 5 | judgment | heuristic_v0 / manual |

- **누락된 차원은 추정하지 않습니다.** 0점 처리 후 `missing`에 기록하고 리포트에 `*`(provisional)로 표시합니다 → 점수는 하한값.
- 가중치는 가설입니다. 바꿀 때는 `weights_version`을 올려 저장된 점수의 추적성을 유지하세요.
- `v0.1-live` (2026-10-08, 첫 live run 후): velocity 상한 100k → 10k (실측 p90 ≈ 2.3k, 최대 ≈ 35k), 검색에 `relevance_language = "en"` 추가. **효과는 미미했습니다**: 두 번째 live run의 발견 영상 149개 중 124개가 첫 run과 동일했고, 인도 채널 콘텐츠는 대부분 영어(`default_language=en`)라 언어 필터로는 걸러지지 않습니다 (regionCode도 지역 필터가 아님). 채널 국가(`channels.country`, observed 데이터) 기반 필터는 `exclude_channel_countries` 옵션으로 추가(기본 꺼짐), 키워드 `phone hack` → `phone hacked` (게임 치트·모드 APK 영상 유입).
- 두 번째 보정 (같은 날): 키워드 `cybercrime` → `data breach`, `phone hacked` → `phone spyware`. 두 번째 run에서 `cybercrime` 결과 25개 중 18개, `phone hacked` 13개가 인도 채널이었고 힌디어권 "hack hai ya nahi" 형식 영상이 주를 이뤘습니다. `AI scam`(미국 9, 인도 1)은 유지.
- 세 번째 보정 (같은 날): `deepfake` 키워드 제거 (사용자 결정). 4회의 run 모두 25개 중 16개가 인도 채널이었고, 그 주의 인도 배우 딥페이크 사건 하나가 결과를 채웠습니다. 딥페이크 소재는 `AI scam` 등 다른 키워드와 lexicon(`ai` 카테고리)을 통해 여전히 잡힙니다. 키워드는 5개, 기본 run 비용 약 520 units.

### Outlier 계산 세부

- `outlier_ratio = 현재 조회수 / 채널 최근 업로드 조회수 중앙값` (대상 영상 제외)
- 기준선은 **Shorts끼리 비교**를 우선합니다 (Shorts를 롱폼 중앙값과 비교하면 왜곡됨). Shorts가 부족하면 전체 포맷으로 대체.
- 게시 48시간 미만 업로드는 조회수가 쌓이지 않았으므로 기준선에서 제외.
- 기준선 영상이 3개 미만이면 ratio를 계산하지 않음 (`n/a`, 점수에서 누락 처리).
- 기준선 중앙값 하한 `min_baseline_median_views`(기본 1,000, metric `m3`): `outlier = views ÷ max(중앙값, 하한)`. 평소 10회 보는 채널의 1,164회 영상이 137배 outlier로 11위에 오른 live run 사례 때문입니다. 관측 중앙값은 그대로 저장하고 리포트에 "floored to 1,000"으로 표시합니다.
- views/hour·기준선은 **관측(snapshot) 시점** 기준으로 계산합니다. 나중에 `compute`를 다시 돌려도 값이 변하지 않습니다.
- Shorts 판정: 길이 ≤ 180초 (API에는 Shorts 여부 필드가 없음).

### 반복 관측과 Velocity Trend (v0.2)

views/hour(게시 후 평균)만으로는 "지금 가속 중인 영상"과 "어제 정점을 찍고 식는 영상"을 구분할 수 없습니다.
같은 후보를 다시 관측(`radar track`)하면 snapshot이 쌓이고 추세를 계산합니다.

- `recent_views_per_hour` = 최근 두 관측 사이 증가 조회수 ÷ 경과 시간 (최소 간격 1h)
- `velocity_ratio` = recent ÷ 직전 관측까지의 평균 views/hour → `↑` ≥1.2x 가속 · `→` 유지 · `↓` ≤0.8x 감속
- 조회수가 하향 보정된 경우(스팸 필터링 등)는 증가 0으로 처리
- **Radar Score에는 포함하지 않습니다.** 스펙의 View Velocity 정의(게시 후 평균)를 유지하고, 추세는 derived 데이터로 리포트에만 표시합니다. 실제 추적 데이터가 쌓인 뒤 점수 반영 여부를 결정하세요.

후보 window: 검색으로 발견된 후 `candidate_window_hours`(기본 72h) 동안 레이더에 남고, 이후 `run`/`track` 때마다 재관측됩니다.
window 기준 시각은 **마지막 관측 시각**이라서, 며칠 뒤에 `radar report`를 실행해도 마지막 수집 결과가 그대로 나옵니다.
후보는 **현재 설정된 키워드로 발견된 것만** 유효합니다. 키워드를 빼면 그 키워드로만 발견됐던 영상은 다음 `report`부터 바로 빠지고 `track`도 재관측하지 않습니다 (발견 기록은 삭제하지 않음).

기존 DB는 실행 시 자동으로 마이그레이션됩니다 (컬럼 추가만 하며, 데이터는 삭제하지 않음).

### 후보 발견 방식: 키워드 + Seed 채널

- **키워드**: `[collect] keywords` × `regions`로 `search.list` (100 units/호출).
- **Seed 채널**: `[collect] seed_channels = ["UC..."]`에 적은 채널의 최근 업로드(`recent_uploads_per_channel`개)를 검색 없이 가져옵니다 (채널당 약 3 units). `published_within_hours` 안의 업로드는 후보(`discoveries.source = seed_channel`)가 되고, 더 오래된 업로드는 그 채널의 기준선으로만 쓰입니다.
- 두 방식은 독립적으로 범위가 적용됩니다. 키워드·지역·seed 채널을 설정에서 빼면 그것으로만 발견됐던 후보는 다음 리포트부터 빠집니다.
- **어떤 채널을 seed로 넣을지**는 `radar suggest-seeds`가 저장된 데이터에서 규칙으로 뽑아 줍니다: 랭킹에 오른 후보 중 Radar Score ≥ 45이고 channel_fit ≥ 0.6(주제 맞음)인 영상을 낸 채널, 이미 seed인 채널 제외. 결과를 TOML 조각으로 출력하므로 검토 후 붙여 넣으면 됩니다. 현재 설정의 seed 목록은 2026-10-08 live 데이터에서 이 규칙으로 뽑은 것입니다.

### 후보 필터 (`[filter]`)

점수 계산 뒤 랭킹·Korea gap 대상·리포트에 적용됩니다. 저장된 데이터에는 손대지 않습니다. 기본값은 일부러 느슨합니다 (v0의 목적은 데이터를 **보는** 것).

| 설정 | 기본 | 의미 |
|---|---|---|
| `max_age_hours` | 240 | 게시 후 경과 시간 상한. 기준 시각은 **마지막 관측 시각**(후보 window와 동일)이라 며칠 뒤 `report`를 돌려도 마지막 수집 결과가 유지됨 |
| `min_views` | 100 | 조회수 하한 |
| `min_outlier_ratio` | 0 | 0이면 outlier 계산 불가(`n/a`)인 후보도 유지, 양수면 `n/a`는 탈락 |
| `min_radar_score` | 0 | CLI `--min-score`로 덮어쓸 수 있음 |
| `topic_categories` | `[]` | 비어 있으면 모두 허용. 지정하면 제목·설명이 해당 `[lexicon.topics]` 카테고리 용어와 하나 이상 일치해야 함 |
| `seed_uploads_need_topic_match` | `true` | seed 채널로**만** 발견된 업로드는 `[lexicon.topics]` 어느 카테고리든 용어 하나 이상 포함해야 함. 키워드 검색 결과는 주제가 보장되지만 seed 채널의 일상 업로드는 아니기 때문 (첫 live run에서 seed 채널의 신앙·장난감 영상이 상위에 올라옴) |

`radar run --top 10 --min-score 50`처럼 CLI에서 상위 개수와 점수 하한을 바로 바꿀 수 있습니다. 리포트 상단 `Filters:` 줄에 적용된 필터가 적힙니다.

### 같은 사건 묶기 (Story cluster)

첫 live run에서 인도 영화배우 딥페이크 사건 하나가 상위 20개 중 7개를 차지했습니다. 같은 사건을 여러 채널이 올린 것이라 소재로는 하나입니다.

- `radar/analysis/cluster.py`: 제목 토큰(NFKC 소문자, 불용어·숫자·2글자 이하 제거, 복수형 s 제거) 중 **후보 집합에서 드문 토큰**만 비교합니다. 검색 키워드와 lexicon 용어(hack, scam, phone …)는 항상 제외합니다. 한 채널이 3개 이상 영상에 반복하는 토큰(상용 해시태그)도 그 채널의 서명일 뿐이라 제외합니다. 랭킹 순서대로 내려가며 **클러스터 대표(최고 점수) 영상과** 2개 이상 공유하면서 작은 쪽 제목의 30% 이상을 덮거나 3개 이상 공유하면 합류시킵니다. 멤버끼리 연결하면 다리 영상을 통해 무관한 사건이 연쇄로 묶이므로(첫 실데이터에서 딥페이크 사건 + 해시태그 스팸 = 29개) 대표 연결만 씁니다.
- 보수적으로 설계했습니다. 잘못 합치는 것이 놓치는 것보다 해로우므로 단일 영상 클러스터가 대부분입니다.
- 리포트 Ranking 표는 **사건당 한 줄**(최고 점수 영상)만 보이고 `×N`으로 영상 수를 표시합니다. "Stories covered by several videos" 섹션에 나머지 영상이 나오고, CSV에는 모든 영상이 `story_cluster`·`cluster_size`·`cluster_leader` 열과 함께 들어갑니다.
- 점수에는 반영하지 않습니다 (`derived:title_cluster_v0`, 리포트 시점 계산, DB에 저장하지 않음).

### 채널 국가 제외 (opt-in)

`[collect] exclude_channel_countries = ["IN"]`처럼 지정하면 해당 국가 채널의 영상은 판단·점수·랭킹에서 빠집니다 (수집·저장은 그대로). 채널 국가가 비어 있는 경우(live run 기준 약 25%)는 항상 유지됩니다. "전 세계 탐지"라는 목표를 좁히는 설정이라 코드 기본값은 비어 있지만, 이 저장소의 `config/radar.toml`은 2026-10-08부터 `["IN"]`을 켜 두었습니다 (live run #1~#4에서 인도 채널이 상위권을 독점). 끄려면 빈 리스트로 바꾸세요.

## 설치

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env   # YOUTUBE_API_KEY 입력 (.env는 git에 포함되지 않음)
```

API 키: Google Cloud Console → YouTube Data API v3 활성화 → API 키 생성 (API 제한을 YouTube Data API v3로 걸어두는 것을 권장).

키는 `.env`(로컬) 또는 환경 변수 `YOUTUBE_API_KEY`로만 전달합니다. 환경 변수가 `.env`보다 우선합니다.

**Codex Cloud / CI에서 실행할 때**: 저장소에는 키를 절대 넣지 말고, 실행 환경의 Secret으로 `YOUTUBE_API_KEY`를 등록하세요. Codex Cloud는 프로젝트 설정의 *Environment → Secrets*에 `YOUTUBE_API_KEY`를 추가하면 작업 실행 시 환경 변수로 주입됩니다 (GitHub Actions라면 *Settings → Secrets and variables → Actions*, 워크플로에서 `env: YOUTUBE_API_KEY: ${{ secrets.YOUTUBE_API_KEY }}`). 키가 없으면 `radar run`은 `--fixture` 안내와 함께 종료 코드 2로 멈춥니다.

## 사용법

```bash
# 오프라인 검증 (API 키 불필요, 합성 데이터)
radar --db data/sample.db run --fixture
radar --db data/sample.db run --fixture --check-korea 5
radar --db data/sample.db track --fixture     # 샘플 기준 6시간 뒤 재관측 → Trend 표시

# 실제 수집
radar run                      # collect → compute → judge(heuristic) → score → report
radar run --check-korea 5      # + 상위 5개 *사건*(클러스터 대표 영상) 한국 포화도 체크 (사건당 ~101 units, 같은 한국어 질의는 한 번만 호출)
radar track                    # window 내 후보만 재관측 (검색 없음, 50개당 1 unit) → 리포트

# 단계별 실행 (API 호출 없이 재계산 가능)
radar collect
radar compute
radar judge                                  # heuristic_v0
radar worksheet --top 10                     # 상위 10개 사건의 판단 워크시트(md) + 판단 CSV 템플릿
radar judge --import reports/judgments_YYYYMMDD_HHMM.csv   # 사람 판단 (heuristic보다 우선, 빈칸은 건너뜀)
radar score
radar report --out reports
radar report --since 2026-10-08T06:00:00Z   # 그 시각 이후 발견된 후보만 (키워드 변경 직후 깨끗한 비교용)

# 팩트체크 상태 기록
radar verify <video_id> --status verified --source https://police.example/notice --note "경찰청 보도자료"
```

### 사람 판단 넣기 (워크시트)

점수 가중치와 키워드는 전부 가설입니다. 이를 검증할 정답 데이터는 **사람의 판단**뿐이며, `manual` 판단은 heuristic보다 우선합니다.

1. `radar worksheet --top 10` → `reports/worksheet_*.md`(읽고 판단할 자료, 한국어 판단 기준 포함)와 `reports/judgments_*.csv`(영상×차원 한 줄씩, `value` 빈칸)
2. CSV의 `value`에 0~1 값을 적습니다. 모르는 칸은 비워 둡니다 (import 때 건너뜀). `rationale`, `author`는 선택.
3. `radar judge --import reports/judgments_*.csv` 후 `radar score` · `radar report`

### Story DNA 분석 (사람 또는 LLM 에이전트)

원본에서 가져오는 것은 콘텐츠가 아니라 구조입니다. 분석 결과는 `story_dna` 테이블(judgment 계층)에 출처와 함께 저장됩니다.

1. `radar story-dna --export 10 --out reports/story_dna_bundle.json` → 상위 10개 사건의 **공개 메타데이터만**(제목·설명·태그·지표·현재 판단) 담은 JSON. 대본·영상은 포함되지 않습니다.
2. 분석가(사람 또는 에이전트)가 각 항목에 대해 JSON을 작성합니다: `topic, hook, curiosity_gap, conflict, emotion, story_progression, reveal, payoff, audience_desire_fear, why_viral, korean_angle`(텍스트), `judgments`(차원별 0~1 값과 근거), `independent_sources`(`url`, `type`, `note`).
3. `radar story-dna --import analyses.json --source llm:<모델명>` (사람이면 `--source manual`). 판단 값은 같은 출처로 `judgments`에, 출처 URL이 있으면 `verification`이 `unverified`인 경우에만 `in_progress`로 바뀝니다. **에이전트는 `verified`로 만들 수 없습니다.** 사람이 `radar verify`로 확정합니다.
4. 리포트의 후보 섹션에 Story DNA가 출처·날짜와 함께 채워져 나옵니다. 사람 분석이 LLM 분석보다 우선합니다.

이 세션형 에이전트 워크플로(오케스트레이터가 후보별 분석 에이전트를 병렬로 띄우고 결과를 import)는 API 비용이 없고, 결과가 쌓이면 파이프라인 내 자동 호출(유료)로 옮길지 결정합니다.

첫 실행 결과(2026-10-08, 상위 10개, 에이전트 5개 병렬): `judgments/2026-10-08_story_dna_llm_claude-agents.json`. 출처 58건 중 55건이 실제 응답했고(3건은 봇 차단 403), 원본 사건을 특정할 수 없는 2건(리액션 클립, 설명 없는 영상)은 출처 0건으로 정직하게 남겼습니다. **주의**: 이 1차 실행의 번들에는 오케스트레이터의 이전 LLM 판단이 포함돼 있어 에이전트 판단이 그 값에 앵커링됐습니다(평균 차이 0.03). 이후 `--export`는 휴리스틱·파생 값만 노출하므로 다음 실행부터는 독립적인 2차 의견이 됩니다.

### 제작 브리프와 제작 기록

- `radar brief --top 3` → `reports/brief_*.md`: Story DNA가 채워진 사건 중 **검증된 것 우선, 점수순**으로 한국어 한 페이지. 왜 지금(관측 지표), 사실 확인 상태와 출처, 한국형 각도, Story DNA에서 뽑은 30초 구조 템플릿. 원본 대본은 포함되지 않습니다. 검증되지 않은 소재에는 "제작 전 확인" 경고가 붙습니다.
- `radar publish-log <video_id> --url <내 영상 URL> --title ...`: 어떤 후보에서 어떤 영상을 만들었는지 기록(`published` 테이블). 다음 브리프에서 제외되고, 성과 피드백(로드맵 6)의 기준이 됩니다.
- 30일 실행 계획: [`docs/plan_1k_subscribers.md`](docs/plan_1k_subscribers.md)

### 우리 영상 만들기 (대본 → 음성 → 자막 → 장면 카드 → mp4)

원칙: 남의 영상·음성·이미지는 쓰지 않습니다. 대본은 Story DNA와 **검증된 독립 출처**만으로 새로 쓰고, 화면은 로컬에서 그린 타이포그래피 카드입니다 (스톡 영상은 내레이션과 어긋나는 것이 자동 생성기의 공통 실패 원인이라 기본으로 쓰지 않음).

```bash
pip install -e ".[produce]"                          # Pillow, imageio-ffmpeg(ffmpeg 바이너리 포함), edge-tts
radar script-check content/scripts/2026-10-08-family-password.json   # QA 게이트 + 실제로 읽힐 문장 출력
radar produce content/scripts/2026-10-08-family-password.json                    # 게시용: Supertonic 3 (로컬, 무료, 기본값)
radar produce content/scripts/2026-10-08-family-password.json --backend edge   # 로컬 미리보기 전용
radar produce content/scripts/2026-10-08-family-password.json --backend google # 게시용 대안 (GOOGLE_TTS_API_KEY, 유료 구간 있음)
```

- **대본 형식**: `content/scripts/*.json` — 장면별 `narration`(자막·음성), `headline`·`sub`(카드 문구), `icon`(phone, voice, shield, lock, family, warning, money, check, video, update), `accent`, 그리고 `disclaimer`, `sources`, `title`, `description`, `tags`. 형식 설명은 `radar/production/script.py` 상단.
- **QA 게이트** (`radar script-check`, `produce`가 먼저 실행): 출처 URL 필수, 재연 고지문 필수, 원본 신호가 `verified`가 아니면 거부(`--allow-unverified`로 경고만), `false` 판정 소재 거부, 화면·내레이션에 URL 금지, TTS가 잘못 읽을 숫자·영문 잔존 시 거부, 한국어 비율, 예상 길이 12~50초.
- **읽기 정규화**: 자막에는 "2024년 · 340억 원 · FBI"를 그대로 쓰고, 음성에는 "이천이십사년 · 삼백사십억 원 · 에프비아이"로 바꿔 넣습니다 (`textnorm.py`, 세 명·두 시간처럼 고유어 수사 처리 포함).
- **음성 (기본: Supertonic 3, 로컬·무료)**: 내 PC CPU에서 돌아가는 오픈 가중치 한국어 음성입니다 (약 385MB, 실시간보다 약 3배 빠름, 인터넷·과금 없음). 라이선스는 OpenRAIL-M으로 **상업 이용 가능**하지만 두 가지를 지켜야 합니다: ① AI로 만든 음성임을 분명히 밝힐 것 → 화면 상단에 항상 "AI 음성" 배지, 설명란에 "AI 합성 음성 (실제 인물의 목소리가 아닙니다)"를 자동으로 넣습니다. ② 실제 인물 흉내 금지. 라이선스 원문 스냅샷: `assets/licenses/supertonic3_openrail_m.txt`. 문장마다 따로 합성해 문장 경계 시간을 정확히 얻고, 문장 안의 단어는 글자 수 비례로 나눕니다. 목소리는 `--voice F1`(기본)·F2·F3·M1·M2·M3, 속도는 `[production] supertonic_speed`.
  - 설치 (최초 1회, Python 3.12 별도 가상환경 — supertonic이 3.14를 아직 지원하지 않음):
    ```bash
    pip install uv
    uv venv .venv-tts --python 3.12
    uv pip install --python .venv-tts/Scripts/python.exe supertonic==1.3.1 soundfile
    ```
    첫 실행 때 모델을 `~/.cache/supertonic3`에 자동으로 받습니다. 메인 프로그램은 `tools/supertonic_worker.py`를 이 가상환경으로 실행합니다 (`[production] tts_python`).
  - 그 밖의 음성: `google`(Google Cloud TTS, 상업 이용 가능, Neural2 월 100만 자 무료 후 유료, 결제 등록 필요). `edge`(edge-tts)는 Microsoft가 상업 이용을 허가한 적이 없어 **로컬 미리보기 전용**이며 `meta.json`에 `publishable: false`로 기록됩니다. 후보 비교: [`docs/research_로컬_한국어_TTS.md`](docs/research_로컬_한국어_TTS.md).
- **화면**: 1080×1920, 상단 채널명과 첫 장면 재연 배지, 아이콘, 두 줄로 균형 있게 나눈 헤드라인, 화면 66~78% 높이에 굵은 자막(10자 단위, 자동 줄바꿈), 상단 진행 바. 하단 20%와 오른쪽 버튼 영역은 비워 둡니다.
- **산출물**: `media/<script id>/video.mp4`, `thumb.png`, `meta.json`(제목, 고지·출처·해시태그가 들어간 설명, 태그, 길이, 음성 백엔드, `publishable`). `media/`는 git에 포함되지 않습니다.

### 움직이는 영상 엔진 (Remotion, 기본값)

정지 카드(ffmpeg 엔진)는 "슬라이드쇼"처럼 보여서, 기본 엔진을 Remotion(React로 프레임을 그리는 영상 엔진, 개인·3인 이하 회사 무료)으로 바꿨습니다. ffmpeg 엔진은 `--engine ffmpeg`로 계속 쓸 수 있습니다.

```bash
cd video && npm install && node scripts/prepare-assets.mjs && cd ..   # 최초 1회 (Node.js 20+)
radar produce content/scripts/2026-10-08-family-password.json          # [production] engine = "remotion"
```

- **화면**: 장면 색에 따라 바뀌는 은은한 배경 빛과 흐르는 격자, 맥박 치듯 떠 있는 아이콘 배지(lucide, ISC), 단어가 하나씩 튀어나오는 굵은 제목(Pretendard Black, OFL), 자라나는 강조선, 장면 진입 슬라이드, 상단 진행 바. `"layout": "call"` 장면은 실제 제조사 UI를 베끼지 않은 가상의 **전화 수신 화면**(발신자 이름, 진동하는 아바타, 수락·거절 버튼)입니다.
- **장면 레이아웃** (`"layout"`, 모두 headline/sub/icon/accent 유지, 실제 앱을 베끼지 않은 가상 UI):

  | layout | 필드 | 화면 |
  |---|---|---|
  | `card` | (기본) | 아이콘 배지 + 큰 제목 |
  | `call` | `caller`, `caller_sub`, `call_label` | 전화 수신 화면 (벨이 0.9초 먼저) |
  | `chat` | `chat_title`, `messages: [{"from": "them"\|"me", "text"}]` (최대 5개, 각 40자) | 메신저 대화, 말풍선이 대사에 맞춰 하나씩 (상대 말풍선 앞에 입력 중 점), 말풍선마다 팝 |
  | `sms` | `sender`, `sms_text` (100자, 링크는 24자 이내) | 문자 화면, 가린 링크(`http://●●●●.kr/…`)에 빨간 박스와 깜박이는 "의심 링크" 표시 |
  | `alert` | `app_label`(일반 명칭, 예: "은행 앱"), `alert_text` (70자) | 잠금화면 위로 푸시 배너가 내려오고 화면이 어두워짐, 진동+딩 (0.5초 먼저) |
  | `stat` | `stat_value`(예: "6,581억 원"), `stat_label` | 큰 숫자가 0부터 올라가고 아래 막대가 함께 참 |
  | `timeline` | `steps: [{"when": "1일차", "text"}]` (2-4개) | 세로 타임라인, 대사에 맞춰 단계가 하나씩 |
  | `checklist` | `items: ["..."]` (2-4개, 각 22자) | 할 일 목록, 대사에 맞춰 하나씩 체크 (마지막 장면이면 마지막 체크에 딩) |
  | `compare` | `real`/`fake`: `{"label", "title"(20자), "points"(0-3줄, 각 14자)}` | 진짜 vs 가짜 노트 두 장, 진짜에 초록 체크·가짜에 빨간 X를 손으로 그리고 가짜 제목에 동그라미 |
  | `toggle` | `path: ["보안", "결제 인증"]`(1-3단계, 각 10자), `setting`(14자), `toggle_to`: on/off | 가상 설정 화면, 손가락이 경로를 탭하고 스위치를 켠 뒤 그 줄을 살짝 키워 손그림 동그라미 |
  | `flow` | `nodes: [{"text"(16자), "yes"\|"no"(10자, 하나만)}]` (3-5개) | 노트 위 손그림 흐름도, 노드·화살표가 대사에 맞춰 차례로 그려지고 마지막 노드에 형광펜 |
  | `dots` | `total`(10-1,000,000), `stages: [{"label", "count"}]`(2-4개, 깔때기: 앞 단계 이하), `unit` | 시드 고정 점 시뮬레이션, 단계마다 일부 점의 색이 바뀌고 숫자가 굴러감 (숫자는 반드시 출처에서) |

  모든 장면은 `"mark"`(제목 속 핵심 구절)로 형광펜·밑줄 위치를 정할 수 있습니다 (없으면 쉼표 뒤 / 숫자 / 마지막 어절).
- **무대와 고정 요소** (`video/src/tokens.json`, 대비 검사 `tests/test_design_tokens.py`): 모든 편에서 **흰 노트 카드**(제목·핵심 글자가 놓이는 면, 접힌 모서리), 자막, 위험·주의·안전 색, 글자 크기, 브랜드 줄(카테고리 태그 + 채널명 + AI 음성)은 고정합니다. 편마다 바뀌는 것은 **무대**(다크 경보: pulse·circuit·scan·aurora·dots / 종이 노트: paper 줄노트·graph 모눈)와 **카테고리 색**(AI·딥페이크 보라, 폰 보안·설정 파랑, 스미싱·문자 마젠타, 보이스피싱·전화 인디고)입니다. 무대는 주제와 일정으로 정해집니다: 같은 무대 3일 연속 금지, 7일 중 다크 경보 3일 이하 (`radar.production.themes`). 대본의 `"theme"`·`"category"`가 있으면 그것이 우선입니다. `radar produce`는 편마다 무대·테마·장면 순서를 `content/style_log.json`에 남기고, `radar script-check`는 가운데 장면 순서가 직전 편과 같으면 경고합니다.

  목업 안 글자는 QA에서 막습니다: 가리지 않은 링크, 실제처럼 보이는 전화·계좌 번호(`010-●●●●-●●●●`처럼 가릴 것), 실제 은행·앱·플랫폼 이름. ffmpeg 엔진은 새 레이아웃을 일반 카드로 그립니다.
- **자막**: 음성 엔진이 주는 어절 단위 시간으로, 지금 말하는 단어만 노랗게 강조합니다 (edge-tts는 어절마다 정확한 시간을 줌, Supertonic은 문장 경계가 정확하고 문장 안 단어는 글자 수 비례).
- **배경음악**: 대본의 `"music"`(tense, explainer, uplifting, tech, suspense)에 맞는 곡을 `assets/manifest.json`에서 고릅니다. 대사 중에는 자동으로 약 −21 dB로 낮추고(덕킹) 대사 사이에는 약 −13 dB, 시작·끝은 페이드합니다. 렌더 후 전체를 −14 LUFS로 맞춥니다. 곡 파일은 git에 올리지 않고 `radar assets fetch`로 받습니다 (출처·라이선스·원문 스냅샷·SHA-256을 장부에 기록, 현재 Mixkit 무료 라이선스 5곡, 출처 표기 불필요).
- **효과음**: 전화벨·진동·휙·팝·딩을 ffmpeg로 **직접 합성**합니다 (내려받은 소재 없음 → 라이선스 문제 없음). 전화 장면은 벨이 0.9초 먼저 울린 뒤 대사가 시작됩니다.
- **속도**: 이 PC(Ryzen 5 5600X)에서 35초 영상 렌더 약 3.5분 (음성 합성 포함).
- 소재 라이선스 근거: [`docs/research_무료_소재_라이선스.md`](docs/research_무료_소재_라이선스.md), 엔진 선택 근거: [`docs/research_Shorts_영상_화질_개선.md`](docs/research_Shorts_영상_화질_개선.md)

### 정기 실행 예시 (Windows 작업 스케줄러)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\register_windows_tasks.ps1 -DryRun   # 등록될 명령만 출력
powershell -ExecutionPolicy Bypass -File scripts\register_windows_tasks.ps1           # 매일 09:10 run, 6시간마다 track
powershell -ExecutionPolicy Bypass -File scripts\register_windows_tasks.ps1 -Unregister
```

작업은 `scripts\radar_task.cmd`를 호출하며 로그는 `data\cron.log`에 쌓입니다. 하루 비용은 run 약 520 units + Korea gap 3건 약 300 units + track 4회 약 16 units입니다.

### 정기 실행 예시 (cron)

이 저장소는 스케줄을 자동으로 등록하지 않습니다. 필요하면 직접 crontab에 추가하세요 (UTC 기준 예시):

```cron
# 매일 1회 전체 수집 (~620 units)
10 0 * * *    cd /path/to/global-shorts-radar && .venv/bin/radar run   >> data/cron.log 2>&1
# 6시간마다 재관측 (~1–4 units)
40 */6 * * *  cd /path/to/global-shorts-radar && .venv/bin/radar track >> data/cron.log 2>&1
```

`python -m radar ...`로도 실행 가능합니다. 리포트는 `reports/radar_YYYYMMDD_HHMM.{md,csv}`로 생성됩니다.

수동 판단 CSV 형식 (값은 0–1):

```csv
video_id,dimension,value,rationale,author
abc123,story_strength,0.8,"반전이 명확하고 끝까지 볼 이유가 있음",kim
abc123,korea_localization_gap,0.7,"국내 유사 콘텐츠 거의 없음",kim
```

허용 차원: `story_strength`, `korea_localization_gap`, `localization_potential`, `channel_fit`.

## Quota / 비용

무료 할당량은 하루 10,000 units입니다. 유료 서비스는 사용하지 않습니다.

| 호출 | 비용 | 기본 설정에서 |
|---|---|---|
| search.list | 100 | 키워드 5 × 지역 1 = 500 |
| videos.list (50개 단위) | 1 | 소수 |
| channels.list | 1 | 소수 |
| playlistItems.list | 1 | 채널당 1 |
| `--check-korea N` | ~101 × N | **기본 꺼짐** |
| `radar track` | 1 / 50개 | window 내 후보 수에 비례, 검색 없음 |

`collect.quota_budget`(기본 2,000)에 도달하면 호출 전에 중단하고, 그때까지의 데이터는 보존합니다.
키워드·지역을 늘리면 비용이 선형으로 증가합니다.

## 데이터베이스 구조

SQLite 파일 하나(`data/radar.db`, 기본값). 테이블은 데이터 성격별로 분리되며 서로 섞이지 않습니다.

| 테이블 | 성격 | 키 | 내용 |
|---|---|---|---|
| `runs` | 메타 | run_id | 실행 시각, 모드(live/fixture/track), 사용 quota, 경고 |
| `raw_responses` | raw | id | API 응답 JSON 원본 (키 제거), 엔드포인트, 파라미터 |
| `videos` | observed | video_id | 제목, 설명, 게시시각, 길이, 채널, 태그 |
| `video_snapshots` | observed | (video_id, fetched_at) | 관측 시각별 조회수·좋아요·댓글. 재수집 시 덮어쓰지 않고 행이 추가됨 |
| `channels` | observed | channel_id | 채널명, 국가, 업로드 재생목록 |
| `channel_snapshots` | observed | (channel_id, fetched_at) | 구독자·총 조회수·영상 수 |
| `discoveries` | observed | (video_id, run_id, query, region) | 어떤 run에서 어떤 키워드/seed 채널로 발견됐는지 (`source`) |
| `metrics` | derived | (video_id, computed_at) | views/hour, 기준선 중앙값, outlier ratio, freshness, trend |
| `scores` | derived | (video_id, scored_at) | Radar Score, 가중치 버전, 차원별 점수·출처 JSON, 누락 차원 |
| `judgments` | judgment | id | 차원, 값(0~1), **출처**(manual / llm:* / derived:* / heuristic_v0), 근거, 작성자 |
| `story_dna` | judgment | id | Story DNA 11개 필드(텍스트), 독립 출처 목록, **출처**(manual / llm:*), 작성자 |
| `verification` | judgment | video_id | 팩트체크 상태, 출처 URL, 메모 |
| `published` | 메타 | id | 후보 → 우리 영상 URL 매핑 (제작 기록, 성과 피드백 기준) |

스키마 변경은 `ALTER TABLE ADD COLUMN`만 사용하는 마이그레이션으로 기존 DB에 그대로 적용됩니다 (`storage/db.py`의 `MIGRATIONS`).

## 리포트 읽는 법

- 상단: FIXTURE 여부, "UNVERIFIED / 복제 금지" 원칙, 가중치 버전
- Ranking 표: Score(`*`=provisional), Story(`×N` = 같은 사건을 다룬 영상 수, 사건당 한 줄), Outlier, Median(채널 기준선 중앙값), Views/h, Trend(`↑`/`→`/`↓`, 재관측 전에는 `—`), Age, Topic fit(`core`/`partial`/`off-topic?`), 검증 상태
- 후보별: **Why** 한 줄(계산된 지표만으로 설명: `20.0x channel baseline · 50,000 views/hour · published 20h ago`) / Observed / Derived / Score breakdown(차원별 출처·근거) / **Story DNA 체크리스트**(분석가 또는 향후 LLM이 채움) / 독립 출처 / 독창적 한국 각도

예시: [`samples/example_report.md`](samples/example_report.md) (합성 데이터로 생성).

## 테스트

```bash
pytest -q
```

metrics · scoring · collector(모킹된 HTTP) · storage · analysis · end-to-end(fixture → DB → 리포트 → CLI)를 다룹니다.
샘플 데이터 재생성: `python samples/build_sample.py`.

예시 리포트(`samples/example_report.{md,csv}`)는 fixture로 `run` 뒤 `track`을 한 번 실행한 상태를 결정적으로 재생성합니다.
리포트 포맷이나 metric을 바꾼 뒤에는 다음으로 골든 파일과 비교하세요 (`--strip-trailing-cr`는 Windows 줄바꿈 무시용):

```bash
radar --db /tmp/golden.db run --fixture --check-korea 5 --out /tmp/golden
radar --db /tmp/golden.db track --fixture --out /tmp/golden
diff --strip-trailing-cr samples/example_report.md /tmp/golden/radar_20261003_0600.md
diff --strip-trailing-cr samples/example_report.csv /tmp/golden/radar_20261003_0600.csv
```

## 보안

- API 키는 환경 변수 또는 `.env`(gitignore)에서만 읽습니다.
- 키는 raw 저장, 오류 메시지(네트워크 예외의 URL 포함), `repr`, 리포트 어디에도 기록되지 않도록 마스킹되며 테스트로 검증합니다.

## 알려진 한계

- 실제 API로는 아직 검증되지 않았습니다 (개발 환경에 키 없음). 응답 형태는 공식 문서 기준으로 구현하고 합성 fixture로 검증했습니다.
- `heuristic_v0`는 제목 키워드 매칭일 뿐입니다. Story Strength를 실제로 판단하지 못하며 최대 0.9로 제한됩니다.
- Korea gap은 소규모 EN→KO 용어 사전 기반 검색 프록시입니다. 고유명사(예: Zelle)는 번역되지 않아 일반 주제("사기꾼")로 검색됩니다.
- YouTube search는 표본이지 전수 조사가 아닙니다. `order=viewCount` 검색은 큰 채널에 치우칠 수 있습니다.
- Trend는 최근 두 관측만 비교합니다. 관측 간격이 길면 그 사이의 급등·급락이 평균으로 묻힙니다.
- `track`은 후보 영상만 재관측합니다. 채널 기준선 영상은 발견 시점 값이라, 시간이 지나면 outlier ratio가 다소 높게 나올 수 있습니다.
- 스펙 가중치(Channel Fit 5점)에서는 주제 밖이지만 강한 outlier(예: 요리 Short)가 상위에 올 수 있습니다. 필터링 대신 `off-topic?`로 표시합니다.

## 로드맵

1. 실제 API 키로 소규모 live run → 키워드/정규화 상한 보정
2. LLM 기반 Story DNA 추출 (`judgments.source = llm:<model>`, 제목·설명·공개 메타데이터만 사용, 대본 미사용)
3. ~~반복 수집 snapshot으로 velocity 추세 계산~~ (v0.2 완료) → 실제 데이터로 Trend를 점수에 반영할지 결정
4. Fact verification 워크플로우 (출처 우선순위: 공식 → 정부/경찰/기업 → 주요 언론 → 전문가 → 2차 → SNS)
5. Reddit / Google Trends / News RSS 수집기
6. YouTube Analytics 피드백 → Winner/Loser 분류 → 가중치 학습
