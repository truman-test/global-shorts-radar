# LNOSVdWdwFY — 팩트체크 리뷰 (디스코드 인증 봇 '더블 카운터' 해킹)

- 대상 대본: `content/scripts/2026-10-09-discord-bot-breach.json`
- 팩트시트: `content/week1/LNOSVdWdwFY.md`
- 검토: 독립 fact-checker (대본 작성자 아님), 2026-10-09. 모든 출처를 2026-10-09에 직접 열어 원문 대조함.
  - [S1] Double Counter 공식 보고서 INC-2026-10-04 (Version 1.9 · Last updated 5 October 2026) 열림(HTTP 200, 본문 전체 확인) — https://doublecounter.gg/blog/security-incident-october-2026
  - [S2] Dexerto (Cande Maldonado, updated 2026-10-07) 열림 — https://www.dexerto.com/gaming/discord-bot-built-to-stop-alt-accounts-leaks-millions-of-users-ip-addresses-3416371/
  - [S3] Discord 고객지원(한국어) "Discord 계정이 해킹당했거나 유출된 경우", updated 2026-10-09T01:32Z — https://support.discord.com/hc/ko/articles/24160905919511 (Zendesk 공개 API로 본문 확인: https://support.discord.com/api/v2/help_center/ko/articles/24160905919511.json)
- `radar verify` 실행하지 않음. DB·대본 수정하지 않음.

## 핵심 확인 사항
- **수치는 전부 운영사(Tellter SAS) 자체 추정치**: "Counts are approximate", 12GB 복사량과 테이블 크기로 역산. 사용자 ID·이름 ≈2,800만 계정, IP·대략적 위치 ≈2,700만 계정 모두 "Partly copied (treated as exposed)". IP 큰 테이블(≈2,170만)은 약 20%만 나갔다고 추정하나 전체를 노출로 간주. 단위는 "accounts"(계정)이지 사람 수가 아님.
- **비밀번호**: "Discord passwords, which Double Counter never receives … were not in the affected database". 회원 안내: "Nothing to change on your Discord account."
- **디스코드 입장(S2)**: "a third-party app available on Discord. While this was not a breach of Discord, we've disabled new installs of the app while we work with Double Counter…" — 제3자 앱, 디스코드 침해 아님, 신규 설치 *일시* 중단.
- **디스코드 도움말(S3) 조치**: "승인된 앱을 검토한 다음 계정에 액세스할 수 있는 모든 원치 않는 애플리케이션을 삭제" — 데스크톱: 사용자 설정(톱니바퀴) → 승인된 앱 → **승인 취소**; 모바일: 아바타 → 톱니바퀴 → 승인된 앱 → 모르는 앱 **x 버튼**. 같은 문서가 "알 수 없거나 신뢰할 수 없는 출처에서 보낸 링크를 클릭"하지 말라고도 안내.

## 문장별 판정

| # | 위치 | 대본 문장 | 판정 | 이유 | 근거 URL |
|---|---|---|---|---|---|
| 1 | 제목 | 디스코드 보안 봇이 해킹당했다… 2800만 계정 정보 유출 위험 | WEAK | "디스코드 보안 봇"은 디스코드 자체(공식) 봇으로 오해될 수 있음 — 디스코드는 "third-party app"이라고 밝힘. 2800만은 "약"이 빠진 운영사 추정치 | S1, S2 |
| 2 | 설명 | 디스코드 인증 봇 '더블 카운터'가 해킹돼 사용자 이름과 아이피 주소 등이 유출된 것으로 간주됐습니다 | PASS | "treated as exposed"와 일치. (선택) 간주 주체가 운영사임을 밝히면 더 정확 | S1 |
| 3 | 설명 | 디스코드 설정의 '승인된 앱'에서 안 쓰는 앱 연결부터 끊으세요 | PASS | S3의 "승인된 앱 검토 → 원치 않는 앱 승인 취소"와 일치 | S3 |
| 4 | 장면1 | 디스코드를 지키던 보안 봇이 해킹당했습니다 | WEAK | "디스코드를 지키던"은 디스코드 플랫폼 자체를 지키는 공식 봇처럼 읽힘. 실제로는 서버 운영자가 설치하는 제3자 봇 | S2 ("third-party app") |
| 5 | 장면2 | 부계정을 걸러 주는 인증 봇, 더블 카운터 | PASS | alt 탐지·인증 봇 (보고서의 "used for alt detection", 사이트 "Verification bot") | S1 |
| 6 | 장면2 | 해커는 쓰지 않던 옛 서버로 들어와 | PASS | "an old server from our previous OVH hosting setup. It was no longer in use" | S1 |
| 7 | 장면2 | 약 6시간 동안 시스템을 휘저었습니다 | PASS | "5 h 51 min of attacker activity in our cloud (12:03 → 17:54)". (참고: 옛 서버 로그인은 00:47부터이므로 "6시간"은 클라우드 내 활동 기준) | S1 |
| 8 | 장면2 sub | 2026년 10월 4일 · 운영사 보고서 | PASS | "On 4 October 2026…", 보고서 2026-10-05 게시 | S1 |
| 9 | 장면3 | 약 2800만 계정의 사용자 이름, 비슷한 규모의 아이피 주소와 대략적 위치가 유출된 것으로 간주됐습니다 | PASS | ≈28M / ≈27M, "Partly copied (treated as exposed)". "약"·"계정"·"간주" 헤지 유지. 사람 수로 말하지 않음 | S1 |
| 10 | 장면3 | 비밀번호는 무관합니다 / sub "비밀번호는 무관" | PASS | 더블 카운터는 디스코드 비밀번호를 받지 않음 | S1 |
| 11 | 장면3 sub | 약 2800만 계정 | WEAK(경미) | 운영사 추정치라는 표시가 화면에 없음(내레이션 "간주"로 일부 보완) | S1 ("Counts are approximate") |
| 12 | 장면4 | 해커는 봇을 장악해 대형 서버 50여 곳에 자기 링크를 뿌렸고 | WEAK(경미) | 원문은 "about 50 large servers"(제보 기준). "50여 곳"은 '50곳 이상'으로 읽혀 약간 과장 → "약 50곳" | S1 |
| 13 | 장면4 | 디스코드는 이 봇의 신규 설치를 막았습니다 | PASS | "we've disabled new installs of the app" (2026-10-07 보도 기준, "while we work with Double Counter" — 일시 조치) | S2 |
| 14 | 장면4 headline | 믿던 봇이 수상한 링크를 | PASS | "These messages appeared as sent by Double Counter." | S1 |
| 15 | 장면4 sub | 디스코드 침해는 아님 · 설치 중단 | PASS | "not a breach of Discord". (선택) "신규 설치 중단"이 더 정확 | S2 |
| 16 | 장면5 | 믿던 봇이 보낸 링크도 바로 누르지 마세요 | PASS | 운영사 "Don't join servers advertised in unexpected messages from Double Counter."; 디스코드 도움말도 신뢰할 수 없는 링크 클릭 금지 | S1, S3 |
| 17 | 장면5 | 오늘은 설정의 승인된 앱에서, 안 쓰는 앱을 승인 취소하세요 / sub "설정 → 승인된 앱 → 승인 취소" | PASS | 디스코드 도움말의 메뉴명·버튼명(사용자 설정 → 승인된 앱 → 승인 취소)과 정확히 일치. 도움말 표현은 "원치 않는/모르는 앱"이라 "안 쓰는 앱"은 같은 취지. 비밀번호 변경을 유출 대응으로 권하지 않아 운영사 안내("Nothing to change")와 충돌하지 않음. 안전하고 한국 이용자도 그대로 실행 가능 | S3 |
| 18 | 면책문구 | ※ 공식 발표를 바탕으로 한 설명입니다 | PASS | 운영사 공식 보고서 + 디스코드 공식 성명 기반 | S1, S2 |
| 19 | 금지 사항 | 신분증·셀카 유출, 2025년 디스코드 고객지원 업체 사건 혼입, 결제 사기, 공격자 ID, 피해 서버명, "한국인 피해" | PASS | 대본에 전혀 없음. 디스코드 자체 해킹이라고 단정하지 않음 | S1, S2 |

## 종합 판정: **수정 후 승인**

수치(약·계정·간주), 비밀번호 무관, "디스코드 침해 아님", 예방 행동(디스코드 도움말과 메뉴명까지 일치)은 모두 정확함. FAIL 없음. 다만 제목과 첫 장면의 "디스코드 보안 봇 / 디스코드를 지키던 보안 봇"이 디스코드 공식 봇으로 오해될 여지가 있고(디스코드가 "third-party app"이라고 명시), "50여 곳"이 원문 "about 50"보다 약간 과장됨.

## 최소 수정안

1. **[WEAK #1] 제목**
   - 변경 후: `디스코드 인증 봇이 해킹당했다… 약 2800만 계정 정보 노출 #Shorts`
   - (대안) `디스코드 외부 보안 봇 해킹… 약 2800만 계정 정보 유출 위험 #Shorts`
2. **[WEAK #4] 장면1 내레이션**
   - 변경 전: `디스코드를 지키던 보안 봇이 해킹당했습니다.`
   - 변경 후: `디스코드 서버를 지키던 외부 보안 봇이 해킹당했습니다.`
3. **[WEAK #12] 장면4 내레이션**
   - 변경 전: `…대형 서버 50여 곳에 자기 링크를 뿌렸고…`
   - 변경 후: `…대형 서버 약 50곳에 자기 링크를 뿌렸고…`
4. **[WEAK #11] 장면3 sub (경미, 권장)**
   - 변경 후: `약 2800만 계정 · 운영사 추산 · 비밀번호 무관`
5. (선택) 장면4 sub `디스코드 침해는 아님 · 설치 중단` → `디스코드 침해는 아님 · 신규 설치 중단`
