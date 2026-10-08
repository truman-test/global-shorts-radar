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

### 후보 필터 (`[filter]`)

점수 계산 뒤 랭킹·Korea gap 대상·리포트에 적용됩니다. 저장된 데이터에는 손대지 않습니다. 기본값은 일부러 느슨합니다 (v0의 목적은 데이터를 **보는** 것).

| 설정 | 기본 | 의미 |
|---|---|---|
| `max_age_hours` | 240 | 게시 후 경과 시간 상한. 기준 시각은 **마지막 관측 시각**(후보 window와 동일)이라 며칠 뒤 `report`를 돌려도 마지막 수집 결과가 유지됨 |
| `min_views` | 100 | 조회수 하한 |
| `min_outlier_ratio` | 0 | 0이면 outlier 계산 불가(`n/a`)인 후보도 유지, 양수면 `n/a`는 탈락 |
| `min_radar_score` | 0 | CLI `--min-score`로 덮어쓸 수 있음 |
| `topic_categories` | `[]` | 비어 있으면 모두 허용. 지정하면 제목·설명이 해당 `[lexicon.topics]` 카테고리 용어와 하나 이상 일치해야 함 |

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
| `verification` | judgment | video_id | 팩트체크 상태, 출처 URL, 메모 |

스키마 변경은 `ALTER TABLE ADD COLUMN`만 사용하는 마이그레이션으로 기존 DB에 그대로 적용됩니다 (`storage/db.py`의 `MIGRATIONS`).

## 리포트 읽는 법

- 상단: FIXTURE 여부, "UNVERIFIED / 복제 금지" 원칙, 가중치 버전
- Ranking 표: Score(`*`=provisional), Story(`×N` = 같은 사건을 다룬 영상 수, 사건당 한 줄), Outlier, Views/h, Trend(`↑`/`→`/`↓`, 재관측 전에는 `—`), Age, Topic fit(`core`/`partial`/`off-topic?`), 검증 상태
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
