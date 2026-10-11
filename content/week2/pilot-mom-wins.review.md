# 팩트체크 리뷰: 2026-10-12-mom-wins (새 포맷 B '부모의 역관광' 시범, 아들 목소리 vs 우리 집 암호)

- 검토 대상: `content/scripts/2026-10-12-mom-wins.json` (훅 편집 반영본, `content/week2/pilot_hook_changes_20261011.md` ③)
- 사실 근거: `content/week1/Jf1239_V0mw.md`, 이전 리뷰 `content/week2/recreate-grandma-wins.review.md`
- 클린룸 비트 시트: `content/week2/recreate_AHM0QE7bC0o.md`
- 포맷 기준: `reports/근본검토_결정.md`, `reports/근본검토_스토리포맷.md` 포맷 B
- 검토일: 2026-10-11. 검토자: fact-checker(대본 작성·훅 편집에 참여하지 않음). `radar verify` 실행 안 함. 대본·DB 수정 안 함.
- 이날 직접 연 자료
  - 금융위 86250 본문(2026-02-10, 10계명 ❸ 본문과 금융위 관계자 발언)
  - FBI IC3 PSA241203 본문(2024-12-03)
  - FTC 소비자 경보(2023-03-20, Alvaro Puig). curl은 404를 돌려주지만 WebFetch로 본문·날짜 확인
- `radar script-check --allow-unverified`: 3장면, 약 25.9초. 경고 pilot 1건뿐, 오류 없음.
- 재연 표시: 고지 배지가 0프레임부터 마지막 대사·도장 장면(장면3)까지 유지됨(`video/src/Short.tsx` 470~477행).

## 1. 진술별 판정

| # | 위치 | 진술 | 판정 | 이유 | URL |
|---|---|---|---|---|---|
| 1 | title | 아들 목소리 보이스피싱, 엄마가 암호를 물었더니 | PASS | 수법(가족 목소리로 급한 돈 요구)은 FBI "impersonate a close relative in a crisis situation, asking for immediate financial assistance", 86250 ❸. '암호'는 FBI "Create a secret word or phrase with your family". 숫자·실제 사건 표현 없음. 장면1·2에서 회수됨. | https://www.ic3.gov/PSA/2024/PSA241203 |
| 2 | hook_title | 67살 엄마 vs 아들 목소리 | PASS (극 설정) | '67살'은 인물 나이 설정이며 통계·보도 수치가 아님. 근거 자료에 연령 수치가 없으므로 사실처럼 쓰면 안 되는데, 첫 프레임부터 재연 배지가 함께 보이고 설명란 2줄째가 재연임을 밝혀 실제 인물로 읽히지 않음. 본문·설명란에는 나이를 다시 쓰지 않음. | - |
| 3 | 장면1 발신 화면 | 모르는 번호 / 010-●●●●-●●●● | PASS | 번호 가림. 이전 리뷰의 명확성 지적('아들'로 뜨는 모르는 번호)이 해소됨. 장면3의 '아들 / 저장된 번호'와 대비가 분명함. | - |
| 4 | 장면1 가짜 아들 | 엄마, 나야. 사고 났어. / 급해, 돈 좀 보내 줘! | PASS | FBI "crisis situation, asking for immediate financial assistance", FTC "family emergency". 금액·송금 방법 없음. | 같음 |
| 5 | 장면1 엄마 | 어머, 다친 데는 없고? / 우리 집 암호부터 대 봐. | PASS | 앞은 극 반응. 뒤는 FBI 가족 비밀 단어 권고의 실천. | 같음 |
| 6 | 장면2 가짜 아들 | 암호? 그럴 시간 없어! | PASS | 극 대사. 서두르게 해 확인을 막는 압박은 86250 관계자 "급박한 상황을 연출", FTC 경보의 긴급 상황 연출과 맞음. | https://www.fsc.go.kr/no010101/86250 |
| 7 | 장면2 엄마 | 암호 모르는 아들은 없지. | PASS | 극 대사. 가족이 미리 암호를 정해 두었다는 설정 안에서만 성립하고, 설명란이 그 전제(FBI: 미리 정해 두기)를 밝힘. | - |
| 8 | 장면2 엄마 (안전 행동) | 끊고, 내 아들한테 직접 걸게. | PASS (안전) | 86250 ❸ "급박한 상황이더라도 일단 전화를 끊고 … 직접 확인", FTC "Call the person who supposedly contacted you and verify the story. Use a phone number you know is theirs." **시점이 안전함**: 돈을 보내기 전, 끊은 뒤 엄마 쪽에서 저장된 번호로 거는 것(장면3 '발신 전화'·'저장된 번호')이라 걸려 온 번호로 되거는 오해가 없음. 이전 문구 "네 번호로 걸게"의 모호함이 해소됨. | 같음 |
| 9 | 장면3 발신 화면 | 아들 / 저장된 번호 / 발신 전화 | PASS | FTC "a phone number you know is theirs"를 화면으로 보여 줌. | https://consumer.ftc.gov/consumer-alerts/2023/03/scammers-use-ai-enhance-their-family-emergency-schemes |
| 10 | 장면3 진짜 아들 / 엄마 | 엄마? 나 회사인데, 무슨 사고? / 가짜 아들이 암호를 모르더라. / 역시 우리 엄마! | PASS | 극 마무리. 피해 결과·금액 없음. 결말이 '암호 확인 + 끊고 저장된 번호로 확인'이라는 공식 권고 두 가지를 그대로 보여 주므로 효과를 잘못 말하지 않음. | - |
| 11 | 장면3 twist | 역관광! | PASS | 속어 효과 표시. 엄마는 사기꾼을 상대로 장난치거나 통화를 끌지 않고 끊었으므로 '사기꾼과 맞서 통화를 끌라'는 잘못된 메시지가 아님. | - |
| 12 | 음성 연출 | 가짜 아들과 진짜 아들이 같은 목소리(M3) | PASS | 복제 목소리를 표현한 연출. 사실 주장은 설명란의 FTC·86250 문장이 유보 표현('흉내 낼 수 있다', '들려줄 수 있으니')으로 받침. | - |
| 13 | description 1문 | "엄마, 나야. 사고 났어." 아들 목소리로 급한 돈 전화가 걸려 오자, 엄마는 우리 집 암호를 묻고 끊은 뒤 저장된 번호로 아들에게 직접 걸었습니다. | PASS | 극 요약이고 대사·장면과 일치. 바로 다음 줄이 재연 고지라 실제 사건으로 읽히지 않음. | - |
| 14 | description 2문 | 이 영상은 실제 수법을 바탕으로 각색한 재연입니다. | PASS | 이전 리뷰가 요구한 '실제 사례들' → '실제 수법' 수정이 반영됨. | - |
| 15 | description 3문 | 미국 연방거래위원회(FTC)는 사기범이 온라인에 올라온 짧은 음성으로 가족 목소리를 흉내 낼 수 있다고 경고했습니다(2023-03-20). | PASS | FTC "All he needs is a short audio clip of your family member's voice — which he could get from content posted online", 게시 2023-03-20. 유보 유지. | 같음(FTC) |
| 16 | description 4문 | 금융위원회·금융감독원 보이스피싱 피해예방 10계명(2026-02-10)은 자녀 목소리도 AI로 조작해 들려줄 수 있으니, 급박한 상황이라도 일단 끊고 직접 확인하라고 당부합니다. | PASS | 86250 ❸ "자녀의 목소리 등을 AI로 조작하여 들려주기도 하므로 … 급박한 상황이더라도 일단 전화를 끊고 … 직접 확인". ❸ 본문 예시는 미성년 자녀 납치 빙자지만, 같은 자료 관계자 발언 "자녀·친인척 음성을 AI 변조하여 급박한 상황을 연출"과 FBI 'close relative in a crisis'가 성인 아들 사고 상황까지 받침(이전 리뷰와 같은 판단). | https://www.fsc.go.kr/no010101/86250 |
| 17 | description 5문 | FTC는 연락해 온 가족에게 '내가 알고 있는 그 사람 번호'로 직접 걸어 확인하라고 안내하고, 미국 FBI는 가족끼리 비밀 단어(암호)를 정해 두라고 권고했습니다(2024-12-03). | PASS | FTC "Use a phone number you know is theirs." FBI PSA241203(December 3, 2024) "Create a secret word or phrase with your family to verify their identity." 둘 다 미국 기관 권고임을 밝힘. | https://www.ic3.gov/PSA/2024/PSA241203 |
| 18 | disclaimer | ※ 실제 수법을 바탕으로 각색한 재연입니다 | PASS | 14번과 같음. | - |
| 19 | tags | 보이스피싱 / AI 음성 복제 / 딥보이스 / 가족 암호 / 역관광 | PASS | 근거 자료 용어와 장르 용어. '딥보이스'는 일반 명칭. | - |
| 20 | sources | 86250, PSA241203, FTC(2023-03-20) | PASS | 10-11에 모두 열림(FTC는 봇 요청에 404, 브라우저형 요청으로 본문 확인). | - |

## 2. 수법 단계와 순서

- 대본: 모르는 번호로 아들 목소리 → 사고 → 급한 돈 요구 → (엄마: 암호 확인 → 끊기 → 저장된 번호로 직접 확인).
- 근거: FBI "crisis situation, asking for immediate financial assistance", FTC 가족 긴급 상황 사기, 86250 ❸. 수법 단계가 원문과 같음. 이전 샘플의 '다른 계좌' 비트(근거 없는 극적 장치)는 빠짐. 금액·송금 수단 없음.

## 3. 범죄 교육, 조롱, 고정관념, 미화

- 범죄 교육: 음성 복제 방법·도구는 나오지 않음.
- 조롱: 없음. 엄마는 침착하고 현명한 인물. '67살' 설정이 고령층을 우습게 그리지 않음.
- 고정관념: 사기꾼 캐릭터에 국적·말투 표지 없음.
- 미화: 사기꾼은 암호에 막혀 실패. 보상 장면 없음.

## 4. 클린룸

- 비트 시트(AHM0QE7bC0o)의 '쓰지 말 것'(원작 대사, 개그맨 말투, 세뱃돈 대사, 이미지, 연애 수다) 없음. 원작의 핵심 반전이던 '다른 계좌' 비트도 이번 편에서 빠져 원작과의 거리가 더 멀어짐. "엄마, 나야."는 이 사기 유형의 정형구로 채널 승인본(family-password)에서 이미 썼음. 번역하거나 가깝게 바꿔 쓴 대사 없음.

## 5. 운영 메모 (대본 밖)

- `pilot` 필드는 승인 뒤 편성 전에 제거.
- 포맷 문서 초안의 "여우 vs 진순 여사(67)"처럼 인물 이름을 화면에 붙이는 확장을 할 경우, 실존 인물로 읽히지 않는 이름인지 다시 검토할 것(이번 대본에는 이름 없음).

## 종합 판정: **승인** (필수 수정 없음)

## 수정안

- 필수·권장 수정 없음. 이전 리뷰(recreate-grandma-wins)의 필수 2건(고지 '실제 수법', 설명란 재연 명시)과 선택 1건(발신 화면 '모르는 번호')이 모두 반영된 상태임.
