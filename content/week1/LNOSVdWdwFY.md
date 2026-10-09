# LNOSVdWdwFY — 디스코드 보안 봇 '더블 카운터(Double Counter)' 해킹 (팩트시트)

- 신호(아이디어 출처): https://www.youtube.com/shorts/LNOSVdWdwFY "Huge Discord Leak" (원본 영상은 시청·전사·번역하지 않음)
- 대본: `content/scripts/2026-10-09-discord-bot-breach.json`
- 조사: llm:claude-opus-5-5 (research agent), 2026-10-09. 아래 URL은 모두 2026-10-09에 직접 열어 내용 확인함.

## 한 줄 요약
2026년 10월 4일, 디스코드 부계정 차단·인증 봇 '더블 카운터'의 운영사(Tellter SAS)가 다단계 공격을 받아, 약 2,800만 계정의 디스코드 사용자 ID·이름과, 비슷한 규모(약 2,700만 계정)의 IP 주소·대략적 위치 등이 유출된 것으로 간주됐다. 해커는 봇 토큰을 탈취해 대형 서버 약 50곳에 자기 서버 링크를 뿌렸고, 디스코드는 "디스코드 자체 침해는 아니다"라며 이 앱의 신규 설치를 막았다.

※ 사건은 운영사의 상세 공식 보고서로 충분히 문서화되어 있어 사실 기반 쇼츠 제작이 가능함(빈약하지 않음).

## 출처 (3개)
- [S1] Double Counter(운영사 Tellter SAS) 공식 사고 보고서 INC-2026-10-04, "Targeted attack on Double Counter's infrastructure", 2026-10-05 게시(Version 1.9) — https://doublecounter.gg/blog/security-incident-october-2026 (1차·공식)
- [S2] Dexerto (Cande Maldonado), "Discord disables new bot installs after hack exposed millions of users' IP addresses", 2026-10-07 — https://www.dexerto.com/gaming/discord-bot-built-to-stop-alt-accounts-leaks-millions-of-users-ip-addresses-3416371/ (디스코드 공식 입장 수록; 동일 성명은 Cyber Security News 2026-10-07 https://cybersecuritynews.com/discord-users-data-exposed/ 에도 실림)
- [S3] Discord 고객지원 "Discord 계정이 해킹당했거나 유출된 경우"(한국어), 2026-10-09 갱신 — https://support.discord.com/hc/ko/articles/24160905919511 (예방 행동 근거. 일반 브라우저 외 자동 접근은 403이라 Zendesk 공개 API로 본문 확인: https://support.discord.com/api/v2/help_center/ko/articles/24160905919511.json)

## 대본에 쓴 사실 주장
1. **무슨 봇인가 / 언제**: 더블 카운터는 디스코드 서버의 부계정(alt)·레이드를 막는 인증 봇. 공격일 2026-10-04(UTC).
   - [S1] "On 4 October 2026, Double Counter was the target of a deliberate, multi-stage attack."
2. **침입 경로 — 쓰지 않던 옛 서버**: 이전 호스팅(OVH)의 더 이상 쓰지 않던 서버에서 돌던 분석 도구(Metabase) 취약점으로 침입, 그 서버에 있던 클라우드 자격증명을 이용.
   - [S1] "an old server from our previous OVH hosting setup. It was no longer in use".
3. **약 6시간**: 클라우드 내 공격자 활동 5시간 51분(12:03→17:54 UTC). 대본은 "약 6시간".
   - [S1] "5 h 51 min of attacker activity in our cloud (12:03 → 17:54)."
4. **유출 범위(유출된 것으로 간주)**: 디스코드 사용자 ID·이름 약 2,800만 계정, IP 주소·대략적 위치(국가·지역·도시·우편번호·통신사) 약 2,700만 계정 — 둘 다 "일부 복사, 노출로 간주". 이메일 약 100만 건(주로 운영사 서비스 고객·관리자 등) 복사.
   - [S1] 표: "Discord user IDs and usernames … ≈ 28 M accounts · Partly copied (treated as exposed)"; "IP addresses and coarse geolocation … ≈ 27 M accounts".
5. **비밀번호는 대상 아님**: 더블 카운터는 디스코드 비밀번호를 받지 않음. 운영사는 일반 회원에게 "디스코드 계정에서 바꿀 것 없음"이라고 안내.
   - [S1] "Discord passwords, which Double Counter never receives … were not in the affected database"; Members: "Nothing to change on your Discord account."
6. **봇 장악 → 대형 서버 약 50곳에 링크 살포**: 봇 토큰을 탈취해 더블 카운터 이름으로 공격자 서버 초대 링크를 게시.
   - [S1] "used it to post links to their own Discord server in about 50 large servers"; "These messages appeared as sent by Double Counter."
7. **디스코드 대응**: "디스코드 침해는 아니다", 신규 설치 중단.
   - [S2] Discord 성명: "While this was not a breach of Discord, we've disabled new installs of the app".
8. **예방 행동 근거**: 디스코드는 해킹·유출 시 '승인된 앱'을 검토하고 원치 않는 앱은 '승인 취소'하라고 안내.
   - [S3] "승인된 앱을 검토한 다음 계정에 액세스할 수 있는 모든 원치 않는 애플리케이션을 삭제해 주세요."
   - 운영사도 "예상치 못한 더블 카운터 메시지의 서버 초대에 들어가지 말라"고 안내([S1] "Don't join servers advertised in unexpected messages from Double Counter.") → 대본 "믿던 봇이 보낸 링크라도 바로 누르지 마세요"의 근거.

## 불확실 / 말하면 안 되는 것
- **"디스코드가 해킹당했다" 금지.** 침해된 건 제3자 봇 운영사이며, 디스코드는 자사 침해가 아니라고 밝힘. 대본은 "디스코드 보안 봇", "디스코드 자체가 뚫린 건 아니지만"으로 구분.
- **신분증·셀카 유출 아님.** 더블 카운터 유출 항목에 신분증 이미지·얼굴 사진은 없음. 2025년 10월 디스코드의 외부 고객지원 업체 침해(일부 정부 신분증 이미지 노출)는 **별개 사건** — 이번 대본에서는 섞지 않음, 언급하지 않음.
- 수치는 운영사 자체 추정치("Counts are approximate", 복사량 12GB와 테이블 크기로 역산). 대본은 "약"을 붙이고 "유출된 것으로 간주"로 표현. "2,800만 명"이 아니라 "2,800만 계정". IP 테이블 중 큰 쪽(약 2,170만)은 약 20%만 나갔을 것으로 추정하나 전체를 노출로 간주 — "2,700만 명의 IP가 확실히 털렸다"고 단정 금지.
- 결제 사기($7,316)는 운영사의 별도 제품(Atis) 결제 키로 발생, 고객 피해는 2건 소액(환불 완료) — 대본에서 사용하지 않음(오해 소지).
- 비밀번호 유출 없음, 운영사는 일반 회원에게 계정 변경 불필요라고 함 → "당장 비밀번호 바꾸세요"를 유출 대응처럼 말하지 않음.
- 범인 신원·동기 미확인(운영사가 프랑스·미국에서 법적 조치 진행 중이라고만 밝힘). 공격자 디스코드 ID 등은 언급하지 않음.
- 한국 이용자 피해 규모는 알려지지 않음 — "한국인도 피해" 단정 금지.

## 한국 시청자에게 왜 중요한가
- 디스코드는 국내 게이머·커뮤니티 이용자가 많고, 서버 입장 시 외부 "인증 봇"을 거치는 일이 흔하다. 이런 봇은 부계정 판별을 위해 IP 주소·위치 같은 정보를 모은다. 봇 운영사가 뚫리면 내 계정이 아니어도 정보가 새고, "믿던 봇"이 피싱 링크를 보내는 통로가 될 수 있다.
- IP·대략적 위치·사용자 이름이 묶여 나가면 표적형 피싱·사칭에 악용될 수 있다(운영사도 이메일 노출 고객에게 피싱 주의를 당부).
- 일반 원칙: 제3자 봇·인증 서비스에는 꼭 필요한 정보만 주고(특히 신분증·셀카 업로드는 신중히), 안 쓰는 연결은 끊는다.

## 오늘 할 수 있는 한 가지 예방 행동
- **디스코드 '사용자 설정 → 승인된 앱'에서 안 쓰거나 모르는 앱을 '승인 취소'하기.** (이미 유출된 정보를 되돌리지는 못하지만, 내 계정에 접근하는 제3자 연결을 줄임 — [S3] 근거)
