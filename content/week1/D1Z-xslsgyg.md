# D1Z-xslsgyg — 우리 아이 비밀번호가 이름이라면? (약한 비밀번호와 2단계 인증)

- 아이디어 신호: https://www.youtube.com/shorts/D1Z-xslsgyg ("Would Your Kid's Password Survive a Red Panda?") — 원본 영상은 시청·번역·인용하지 않음. 아이디어(이름으로 만든 비밀번호는 가족도 맞힌다)만 사용, 원본 줄거리는 재현하지 않음.
- 대본: `content/scripts/2026-10-09-kid-password.json`
- 작성: llm:claude-opus-5-5 (research agent), 2026-10-09. 모든 URL은 2026-10-09에 직접 열어 확인함.

## 한 줄 이야기
이름·생일로 만든 비밀번호는 가족도, 해킹 프로그램도 쉽게 맞히니, 비밀번호를 바꾸고 2단계 인증을 켜자.

## 대본에 쓴 사실 (번호 = 근거)

1. **가족 이름, 생일, 전화번호 등은 비밀번호로 쓰지 말아야 한다** (장면 2)
   - 출처: 개인정보보호위원회 '개인정보 포털' 「개인정보보호 수칙」 (페이지 날짜 표시 없음, 첨부 「패스워드 선택 및 이용 안내서 2019」)
   - URL: https://www.privacy.go.kr/front/contents/cntntsView.do?contsNo=77
   - 위치: "가족이름, 생일, 전화번호 등은 사용하지 않아야 합니다"
   - 같은 페이지: 최소 8자리(두 종류 이상 문자) 또는 10자리(한 종류) 이상 권고.

2. **숫자로만 된 8자리 비밀번호는 '즉시(Instantly)' 풀린다 — Hive Systems 2026년 추정** (장면 3)
   - 출처: Hive Systems, 「The 2026 Password Table Is Here」, 2026-07-14 (datePublished 2026-07-14)
   - URL: https://www.hivesystems.com/blog/are-your-passwords-in-the-green (hivesystems.com/password 에서 리디렉트)
   - 위치: 표 "Time it takes a hacker to brute force your password in 2026", 8자리 'Numbers Only' 칸 = "Instantly"
   - 전제: 하드웨어 16 x RTX 5090, 해시 bcrypt(10), 무작위 대입 기준. 반드시 "한 보안업체의 2026년 추정"으로만 말할 것.
   - 참고(대본 미사용): 같은 표에서 숫자만 12자리 = 3 months, 대소문자·숫자·기호 8자리 = 132 years.

3. **흔한 단어·유출된·재사용 비밀번호는 표보다 훨씬 빨리 뚫린다** (장면 4)
   - Hive Systems(2번 URL): "If your password was in another breach, contains dictionary words, or gets reused" → 표가 적용되지 않으며 더 빠름. 예측 가능한 추측부터 시도하면 "about three seconds".
   - NIST SP 800-63B-4 (2025-08) https://pages.nist.gov/800-63-4/sp800-63b.html — 비밀번호를 "commonly used, expected, or compromised" 목록과 대조해 거부해야 함. 비밀번호만 쓰는 경우 최소 15자(SHALL), 다중 인증의 일부일 때 최소 8자.

4. **2단계 인증을 켜면 비밀번호를 도둑맞아도 두 번째 단계에서 막힌다** (장면 5)
   - 출처: CISA(미국 사이버보안·기반시설보안청) 「Turn On MFA」 (페이지 날짜 표시 없음)
   - URL: https://www.cisa.gov/secure-our-world/turn-mfa
   - 위치: 비밀번호를 도둑맞아도 "they won't be able to meet the second step requirement"

## 불확실하거나 말하면 안 되는 것
- 해독 시간은 Hive Systems 한 회사의 **추정**이며 하드웨어·해시 방식 전제가 붙는다. "해커는 무조건 몇 초 만에" 같은 일반화 금지. 이름 비밀번호가 "몇 초 만에" 뚫린다는 수치는 근거 없음 → 사용 안 함.
- "2단계 인증이면 99% 막는다" 같은 퍼센트 수치는 이번에 확인한 공식 자료(CISA 페이지)에 없음 → 사용 금지.
- 모든 게임·앱이 2단계 인증을 지원하는 것은 아님. 지원하지 않으면 비밀번호 교체(이름·생일 금지, 길게)가 대안.
- 개인정보 포털은 '주기적 변경'을 권하지만 NIST SP 800-63B-4는 주기적 변경 강제를 금지(유출 증거가 있을 때만 변경). 지침이 엇갈리므로 대본에서 "주기적으로 바꾸세요"는 말하지 않음.
- KISA 「패스워드 선택 및 이용 안내서」 원문 PDF는 직접 열람하지 못함(개인정보 포털 요약으로 대체).
- 원본 쇼츠의 캐릭터·이름·줄거리 사용 금지. 실존 개인 이름 금지.

## 한국 시청자에게 왜 중요한가
아이들은 게임·학습 앱 계정을 일찍 만들고, 기억하기 쉬운 이름·생일을 비밀번호로 쓰기 쉽다. 이런 비밀번호는 형제·친구가 맞히거나 해킹 프로그램이 순식간에 풀 수 있고, 계정이 털리면 아이템 도난이나 결제 피해로 이어질 수 있다.

## 오늘 할 수 있는 한 가지
아이 계정(게임·구글/애플 계정)에 2단계 인증을 켠다. 이름·생일로 된 비밀번호는 오늘 바로 길고 남이 모르는 비밀번호로 바꾼다.
