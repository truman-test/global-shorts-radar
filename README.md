# Global Shorts Radar

전 세계에서 빠르게 반응하고 있는 **디지털 관련 Shorts를 탐지**하고, 왜 반응했는지 분석할 수 있는 형태로 정리해
**한국 시장에서 독창적인 콘텐츠로 재창작할 가치가 있는 소재**를 찾는 Content Intelligence System입니다.

> 이 시스템은 영상을 복제하지 않습니다. 원본은 *Idea Signal*일 뿐이며, 가져오는 것은 콘텐츠가 아니라 Story DNA입니다.
> 다운로드 · 재업로드 · 대본 추출/번역 · 워터마크 제거 기능은 **의도적으로 존재하지 않습니다**.
> 수집기는 YouTube Data API의 메타데이터 엔드포인트(search, videos, channels, playlistItems)만 호출합니다.

## 현재 범위 (MVP v0.1)

```
Collectors → Raw Storage → Metrics → Scoring → Analysis(heuristic/manual) → Reports
```

| 계층 | 모듈 | 내용 |
|---|---|---|
| Collectors | `radar/collectors/youtube.py` | YouTube Data API v3 (HTTP만, scoring 없음). 재시도, quota 예산, 오류 시 API 키 마스킹 |
| | `radar/collectors/fixture.py` | 동일 인터페이스의 오프라인 수집기 (합성 샘플 데이터) |
| Raw Storage | `radar/storage/db.py` | SQLite. 원본 API 응답(`raw_responses`) 보존 |
| Metrics | `radar/metrics/compute.py` | 순수 함수: views/hour, outlier ratio, freshness, engagement, Shorts 판정 |
| Scoring | `radar/scoring/radar.py` | 0–100 Radar Score. 가중치는 `config/radar.toml` |
| Analysis | `radar/analysis/` | `heuristic_v0`(제목 키워드 기반 저신뢰 판단), 수동 CSV 판단 import, 한국 포화도 체크(opt-in) |
| Reports | `radar/reports/build.py` | Markdown 리포트 + CSV export |

### 데이터 원칙: Observed / Derived / Judgment 분리

| 구분 | 테이블 | 예 |
|---|---|---|
| Raw | `raw_responses` | API 응답 JSON 원본 (키 제외) |
| Observed | `videos`, `video_snapshots`, `channels`, `channel_snapshots`, `discoveries` | 조회수, 좋아요, 댓글, 구독자, 게시시각, 길이 |
| Derived (결정적 계산) | `metrics`, `scores` | views_per_hour, outlier_ratio, freshness, radar_score |
| Judgment (판단) | `judgments` | story_strength, localization_potential, channel_fit, korea_localization_gap — **모든 행에 `source` 기록** |
| Fact check | `verification` | 기본값 `unverified` |

`judgments.source` 우선순위: `manual` > `llm:*` > `derived:*` > `heuristic_v0`.
판단 값은 절대 observed 테이블에 섞이지 않으며, 리포트에서도 출처와 함께 표시됩니다.

### Radar Score

| 차원 | 가중치 | 유형 | 정규화 |
|---|---|---|---|
| Outlier Ratio | 25 | metric | `log(ratio)/log(50)`, 1x 이하 = 0 |
| View Velocity | 20 | metric | `log10(1+vph)/log10(1+100k)` |
| Freshness | 10 | metric | 반감기 48h 지수 감쇠 |
| Story Strength | 15 | judgment | heuristic_v0 / manual / (향후 LLM) |
| Korea Localization Gap | 15 | judgment | `--check-korea` 시 KR 검색 포화도 (opt-in) |
| Localization Potential | 10 | judgment | heuristic_v0 / manual |
| Channel Fit | 5 | judgment | heuristic_v0 / manual |

- **누락된 차원은 추정하지 않습니다.** 0점 처리 후 `missing`에 기록하고 리포트에 `*`(provisional)로 표시합니다 → 점수는 하한값.
- 가중치는 가설입니다. 바꿀 때는 `weights_version`을 올려 저장된 점수의 추적성을 유지하세요.

### Outlier 계산 세부

- `outlier_ratio = 현재 조회수 / 채널 최근 업로드 조회수 중앙값` (대상 영상 제외)
- 기준선은 **Shorts끼리 비교**를 우선합니다 (Shorts를 롱폼 중앙값과 비교하면 왜곡됨). Shorts가 부족하면 전체 포맷으로 대체.
- 게시 48시간 미만 업로드는 조회수가 쌓이지 않았으므로 기준선에서 제외.
- 기준선 영상이 3개 미만이면 ratio를 계산하지 않음 (`n/a`, 점수에서 누락 처리).
- views/hour·기준선은 **관측(snapshot) 시점** 기준으로 계산합니다. 나중에 `compute`를 다시 돌려도 값이 변하지 않습니다.
- Shorts 판정: 길이 ≤ 180초 (API에는 Shorts 여부 필드가 없음).

## 설치

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env   # YOUTUBE_API_KEY 입력 (.env는 git에 포함되지 않음)
```

API 키: Google Cloud Console → YouTube Data API v3 활성화 → API 키 생성 (API 제한을 YouTube Data API v3로 걸어두는 것을 권장).

## 사용법

```bash
# 오프라인 검증 (API 키 불필요, 합성 데이터)
radar --db data/sample.db run --fixture
radar --db data/sample.db run --fixture --check-korea 5

# 실제 수집
radar run                      # collect → compute → judge(heuristic) → score → report
radar run --check-korea 5      # + 상위 5개 한국 포화도 체크 (후보당 ~101 units)

# 단계별 실행 (API 호출 없이 재계산 가능)
radar collect
radar compute
radar judge                                  # heuristic_v0
radar judge --import my_judgments.csv        # 사람 판단 (heuristic보다 우선)
radar score
radar report --out reports

# 팩트체크 상태 기록
radar verify <video_id> --status verified --source https://police.example/notice --note "경찰청 보도자료"
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
| search.list | 100 | 키워드 6 × 지역 1 = 600 |
| videos.list (50개 단위) | 1 | 소수 |
| channels.list | 1 | 소수 |
| playlistItems.list | 1 | 채널당 1 |
| `--check-korea N` | ~101 × N | **기본 꺼짐** |

`collect.quota_budget`(기본 2,000)에 도달하면 호출 전에 중단하고, 그때까지의 데이터는 보존합니다.
키워드·지역을 늘리면 비용이 선형으로 증가합니다.

## 리포트 읽는 법

- 상단: FIXTURE 여부, "UNVERIFIED / 복제 금지" 원칙, 가중치 버전
- Ranking 표: Score(`*`=provisional), Outlier, Views/h, Age, Topic fit(`core`/`partial`/`off-topic?`), 검증 상태
- 후보별: Observed / Derived / Score breakdown(차원별 출처·근거) / **Story DNA 체크리스트**(분석가 또는 향후 LLM이 채움) / 독립 출처 / 독창적 한국 각도

예시: [`samples/example_report.md`](samples/example_report.md) (합성 데이터로 생성).

## 테스트

```bash
pytest -q
```

metrics · scoring · collector(모킹된 HTTP) · storage · analysis · end-to-end(fixture → DB → 리포트 → CLI)를 다룹니다.
샘플 데이터 재생성: `python samples/build_sample.py`.

## 보안

- API 키는 환경 변수 또는 `.env`(gitignore)에서만 읽습니다.
- 키는 raw 저장, 오류 메시지(네트워크 예외의 URL 포함), `repr`, 리포트 어디에도 기록되지 않도록 마스킹되며 테스트로 검증합니다.

## 알려진 한계

- 실제 API로는 아직 검증되지 않았습니다 (개발 환경에 키 없음). 응답 형태는 공식 문서 기준으로 구현하고 합성 fixture로 검증했습니다.
- `heuristic_v0`는 제목 키워드 매칭일 뿐입니다. Story Strength를 실제로 판단하지 못하며 최대 0.9로 제한됩니다.
- Korea gap은 소규모 EN→KO 용어 사전 기반 검색 프록시입니다. 고유명사(예: Zelle)는 번역되지 않아 일반 주제("사기꾼")로 검색됩니다.
- YouTube search는 표본이지 전수 조사가 아닙니다. `order=viewCount` 검색은 큰 채널에 치우칠 수 있습니다.
- Views/hour는 게시 이후 평균입니다. 시간대별 가속도는 같은 영상을 여러 번 수집해 snapshot이 쌓여야 계산할 수 있습니다.
- 스펙 가중치(Channel Fit 5점)에서는 주제 밖이지만 강한 outlier(예: 요리 Short)가 상위에 올 수 있습니다. 필터링 대신 `off-topic?`로 표시합니다.

## 로드맵

1. 실제 API 키로 소규모 live run → 키워드/정규화 상한 보정
2. LLM 기반 Story DNA 추출 (`judgments.source = llm:<model>`, 제목·설명·공개 메타데이터만 사용, 대본 미사용)
3. 반복 수집 snapshot으로 velocity 가속도 계산, 스케줄 실행
4. Fact verification 워크플로우 (출처 우선순위: 공식 → 정부/경찰/기업 → 주요 언론 → 전문가 → 2차 → SNS)
5. Reddit / Google Trends / News RSS 수집기
6. YouTube Analytics 피드백 → Winner/Loser 분류 → 가중치 학습
