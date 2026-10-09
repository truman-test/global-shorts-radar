# D1Z-xslsgyg 검수 — 2026-10-09-kid-password (우리 아이 비밀번호가 이름이라면?)

- 검수: fact-checker (대본 작성자와 별개), 2026-10-09
- 대상: `content/scripts/2026-10-09-kid-password.json` / 근거: `content/week1/D1Z-xslsgyg.md`
- 방법: 모든 출처 URL을 2026-10-09에 직접 열어 원문 대조. Hive Systems 표는 이미지라서 원본 이미지(「Hive Systems Password Table - 2026 Square」)를 내려받아 칸 값을 직접 확인. `radar verify` 실행 안 함, DB·대본 수정 안 함.

## 종합 판정: **수정 후 승인**

모든 수치와 인용은 원문과 일치한다. Hive Systems 수치는 "한 보안업체의 2026년 추정"으로 출처가 밝혀져 있으나, **추정의 전제(유출된 비밀번호 해시를, RTX 5090 16대로, 무작위 대입)**가 대본에 없다. 바로 앞 장면이 "동생·친구가 맞힌다"(로그인 화면에서 추측)라서, 시청자는 누군가 로그인 창에 입력해 즉시 뚫는다고 오해할 수 있다. Hive 원문 스스로 로그인 시도 제한은 온라인 로그인 화면만 보호하고, 표는 도난당한 해시 DB를 오프라인으로 대입하는 경우라고 설명한다. 이 전제를 부제/내레이션에 넣고 고지문을 고치면 승인 가능.

## 문장별 판정

| # | 위치 | 대본 문장 | 판정 | 이유 | URL |
|---|---|---|---|---|---|
| 1 | 제목 | 우리 아이 비밀번호가 이름이라면? 2단계 인증부터 켜세요 | PASS | 훅 + 권고. 권고 내용은 CISA·개인정보 포털과 일치. | https://www.cisa.gov/secure-our-world/turn-mfa |
| 2 | 설명란 | 이름이나 생일로 만든 비밀번호는 가족도, 해킹 프로그램도 쉽게 맞힙니다. | PASS | 개인정보 포털 "가족이름, 생일 … 사용하지 않아야", Hive "dictionary words … 예측 가능한 추측부터 시도하면 about three seconds". | https://www.privacy.go.kr/front/contents/cntntsView.do?contsNo=77 / https://www.hivesystems.com/blog/are-your-passwords-in-the-green |
| 3 | 장면 1 | 우리 아이 게임 비밀번호, 혹시 아이 이름인가요? | PASS | 사실 주장 없음(훅). | — |
| 4 | 장면 2 | 이름이나 생일은 동생도, 친구도 맞힐 수 있습니다. 개인정보보호위원회도 가족 이름, 생일, 전화번호는 쓰지 말라고 안내합니다. | PASS | 개인정보보호위원회 개인정보 포털 원문 "가족이름, 생일, 전화번호 등은 사용하지 않아야 합니다", "타인이 추측하거나 유추하기 어렵도록". (참고: 원 근거는 첨부 「패스워드 선택 및 이용 안내서 2019」. 같은 페이지의 '주기적 변경' 권고는 NIST와 충돌하므로 대본이 쓰지 않은 것은 적절.) | https://www.privacy.go.kr/front/contents/cntntsView.do?contsNo=77 |
| 5 | 장면 3 (수치) | 한 보안업체의 2026년 추정으로는, 숫자로만 된 8자리 비밀번호는 즉시 풀립니다. / 헤드라인 "숫자 8자리는 '즉시'" | PASS | 2026 표 이미지에서 8자리 × Numbers Only = "Instantly" 확인. 게시일 datePublished 2026-07-14. 한 회사의 추정임을 명시함. | https://www.hivesystems.com/blog/are-your-passwords-in-the-green |
| 6 | 장면 3 (전제) | 해킹 프로그램은 더 빠릅니다. … / 부제 "2026년 7월 하이브 시스템즈 추정" | WEAK | 추정의 전제가 빠짐. 원문 표 머리말 "Hardware: 16 x RTX 5090 \| Password hash: bcrypt (10)", 무작위 대입(brute force) 기준이며, 본문은 이 시간이 **도난당한 해시 DB를 공격자 장비에서 오프라인으로 대입**할 때라고 설명("five strikes … only guards the login form on a live website"). 대본은 장면 2(가족·친구의 추측) 바로 다음이라 로그인 창에서 즉시 뚫린다는 인상을 줌. 또한 같은 표에서 9자리 숫자 = 2 hours이므로 'Instantly'는 Hive의 표기 라벨(짧은 시간)이지 '1초' 같은 의미가 아님 → "즉시" 이상으로 과장하지 말 것(현재 대본은 과장 없음). | https://www.hivesystems.com/blog/are-your-passwords-in-the-green |
| 7 | 장면 4 | 흔한 단어나 한 번 유출된 비밀번호는 더 빨리 뚫립니다. 그래서 비밀번호만으로는 부족합니다. | PASS | Hive "if your password has been previously stolen, uses dictionary words, or if you reuse it" → 표보다 빠름, 약 3초. NIST SP 800-63B-4: "commonly used, expected, or compromised" 값 차단, 비밀번호 단독 사용 시 최소 15자(SHALL). '부족'은 이들로부터의 합리적 결론. | https://www.hivesystems.com/blog/are-your-passwords-in-the-green / https://pages.nist.gov/800-63-4/sp800-63b.html |
| 8 | 장면 5 | 오늘 아이 계정에 2단계 인증을 켜 주세요. 비밀번호를 도둑맞아도, 두 번째 확인에서 막힙니다. / 부제 "이름·생일 비밀번호는 바로 바꾸기" | PASS | CISA 원문 "Even if an unauthorized user steals your password, they won't be able to meet the second step requirement" — 같은 확신 수준. (참고: 모든 게임 계정이 2단계 인증을 지원하지는 않음 — 부제의 비밀번호 교체가 대안 역할을 하므로 허용.) | https://www.cisa.gov/secure-our-world/turn-mfa |
| 9 | 고지문 | ※ 공식 자료를 바탕으로 한 설명입니다 | WEAK (경미) | 핵심 수치(장면 3·4)는 공공기관이 아닌 민간 보안업체 Hive Systems의 추정. "공식 자료"만으로는 부정확. | — |
| 10 | 출처 | 4개 URL | PASS | 모두 열림. Hive 2026-07-14, NIST SP 800-63B-4(2025-08 최종본), CISA, 개인정보 포털 — 제목·내용 일치. | — |

### 기타 점검
- 실존 개인 이름: 없음. 원본 쇼츠 캐릭터·줄거리 사용 없음 → OK
- 기업 비난: 없음. Hive Systems는 출처로만 언급 → OK
- 금지 표현 확인: "99% 막는다", "이름 비밀번호는 몇 초 만에", "주기적으로 바꾸세요" 모두 미사용 → OK
- 예방 행동(2단계 인증, 이름·생일 비밀번호 교체): 한국에서도 안전·정확 → OK

## 수정안 (최소 수정)

1. **장면 3** (WEAK #6) — 전제 추가
   - narration: `해킹 프로그램은 더 빠릅니다. 한 보안업체의 2026년 추정으로는, 유출된 비밀번호를 고성능 그래픽카드로 대입하면 숫자로만 된 8자리는 즉시 풀립니다.`
   - sub: `하이브 시스템즈 2026 추정 · 유출 시, RTX 5090 16대 기준`
   - (headline `숫자 8자리는 '즉시'`는 유지 가능)

2. **고지문** (WEAK #9)
   - 변경 후: `※ 공식 자료와 보안업체 추정을 바탕으로 한 설명입니다`

3. (선택) 장면 5 narration을 `오늘 아이 계정에 2단계 인증을 켜 주세요. 지원하지 않으면 비밀번호부터 바꾸세요.`처럼 미지원 계정 대안을 음성으로도 안내. 사실 오류는 아니므로 필수 아님.
