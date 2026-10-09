# 팩트시트: Xz7rLQ62WOs — 지도·검색 결과 속 가짜 고객센터 번호

- 신호 영상: "Hati Hati! Penipuan AI Edit Banner Toko di Google Maps" (인도네시아어, 설명란 없음). **영상은 시청·전사·번역하지 않았고**, 제목만 아이디어 신호로 사용.
- 스크립트: `content/scripts/2026-10-09-fake-map-number.json`
- 조사일: 2026-10-09 (아래 URL 모두 이날 직접 열어 내용 확인)

## 검증 결과: 원래 주장("AI로 편집한 가게 간판 사진에 사기범 번호")은 신뢰할 만한 출처로 뒷받침되지 않음 → 피벗
- **AI 편집 간판 사진** 수법을 다룬 주요 언론(Kompas, Detik, CNN Indonesia)·구글 공식 자료는 찾지 못함.
- 가장 가까운 것은 Suara Surabaya(2026-03-09, https://www.suarasurabaya.net/kelanakota/2026/hati-hati-penipuan-bermodus-nomor-telepon-palsu-di-google-maps/)의 "가게 사진에 사기범 왓츠앱 번호를 넣어 올린다"는 내용인데, **청취자 제보 기반**이고 경찰·구글 확인이 없으며 **AI 언급도 없음**. 그래서 스크립트 근거로 쓰지 않음.
- 그래서 스크립트는 잘 문서화된 **"지도·검색 결과에 뜬 가짜 고객센터/업체 번호"** 패턴으로 전환.

## 한 줄 스토리
검색 결과 맨 위나 지도 앱의 업체 정보에 사기범 번호가 올라가 있는 사례가 한국 항공사 사칭(2026), 인도네시아 이민국(2024), 구글 지도 가짜 업체 1만여 건(2025)으로 확인된다. 전화는 공식 홈페이지·앱·예약 메일의 번호로.

## 스크립트에 쓴 사실 (번호 = 근거)

1. **2026년 7월, 한국 항공사를 사칭한 가짜 고객센터 번호가 구글 등 검색 상단에 노출됐고, 한 소비자는 238달러를 냈다.** (장면 1 재연, 장면 2)
   - 미주중앙일보(Korea Daily), 강한길 기자, 2026-07-26, 「"항공권 문제 있다" 속여 돈 뜯어…한국 항공사 사칭 사이트 활개」 — https://www.koreadaily.com/article/20260726210641474
   - 인용: "구글 등 주요 검색 사이트 상단에 한국어 설명과 함께 가짜 고객센터 전화번호를 노출"
   - 정밀 요약: 한 소비자가 특정 항공사 미국 고객센터로 알고 전화했다가 생년월일 숫자 하나를 고치는 과정에서 238달러를 지불.
   - 장면 1의 대사("수수료부터 내셔야 해요")는 이 사례를 바탕으로 한 **재연**이며 실제 통화 녹취가 아님.
2. **2024년 8월 인도네시아 여러 이민국 사무소의 구글 지도 정보에 가짜 왓츠앱 번호가 올라가, 이민국이 경고했다. 구글은 "기술적 문제로 일부 비즈니스 프로필 정보가 바뀌었다"고 밝혔다.** (장면 3)
   - detikInet, Adi Fida Rahman, 2024-08-13, 「Google Tanggapi Nomor WhatsApp Palsu Kantor Imigrasi di Maps」 — https://inet.detik.com/cyberlife/d-7487354/google-tanggapi-nomor-whatsapp-palsu-kantor-imigrasi-di-maps
   - 인용(구글): "masalah teknis yang berdampak pada perubahan informasi pada sejumlah profil bisnis"
   - 인용(이민국): 사용자가 비즈니스 정보를 수정하는 기능이 "disalahgunakan oleh oknum tidak bertanggung jawab"(무책임한 자들이 악용한 것으로 의심).
3. **구글은 2025년 3월, 1만 건이 넘는 부정 업체 정보를 찾아 삭제하고 관련 사기 조직을 고소했다. 일부는 진짜 업체 계정을 해킹·탈취한 경우였다.** (장면 4)
   - CBS News, Kara Fellows·Cait Bladt, 2025-03-19, 「Google finds 10,000 fake listings on Google Maps, sues alleged network of scammers」 — https://www.cbsnews.com/news/google-maps-fake-listings-lawsuit-scams/
   - 인용: "uncover and eliminate more than 10,000 illegitimate listings" / "legitimate accounts that had been hacked or hijacked"
4. **행동 수칙: 검색 결과 번호를 그대로 믿지 말고 공식 홈페이지나 예약 확인 이메일의 연락처를 이용하라.** (장면 5)
   - 미주중앙일보(1번 URL) 인용: 전문가들은 "공식 홈페이지나 예약 확인 이메일에 기재된 연락처를 이용해야 한다"고 조언.
   - 보강: CBS(3번 URL) "check the company's URL and phone number to make sure they match", detikInet 관련 기사에서 이민국은 공식 연락처·공식 SNS를 이용하라고 권고.

## 불확실하거나 주장하면 안 되는 것
- **"AI로 간판 사진을 편집한다"는 주장은 하지 말 것.** 신뢰할 만한 출처 없음.
- "사진 속 번호" 수법도 제보 수준이라 스크립트에서 단정하지 않음.
- 미주중앙일보 사례는 **미국 내** 한국 항공사 고객센터 사칭(미국 수신자 번호)이다. 한국 국내에서 같은 피해가 났다고 말하지 말 것. 항공사 실명은 스크립트에서 쓰지 않음.
- 인도네시아 건의 실제 피해 규모·피해자 수는 기사에 없음. 왓츠앱 번호도 "사기에 쓰인 것으로 의심"되는 단계라 스크립트에서는 "가짜 메신저 번호"로만 표현.
- 구글 1만 건은 "삭제한 부정 업체 정보(가짜 + 탈취)" 수치이며, 그 전부가 전화번호 바꿔치기라는 뜻이 아님.
- 국내 지도 앱(네이버·카카오)에서 같은 수법이 확인됐다는 공식 자료는 찾지 못함. 국내 지도 앱 이름을 거론하지 말 것.

## 한국 시청자에게 중요한 이유
해외여행·항공권 변경 때 "항공사 고객센터"를 검색해 바로 전화하는 습관이 흔하다. 2026년 7월 한국 항공사를 사칭한 가짜 번호가 실제로 검색 상단에 올랐고, 지도 앱의 업체 번호도 남이 수정하거나 계정을 가로챌 수 있다.

## 실천 행동 (하나)
전화하기 전에 **공식 홈페이지·공식 앱·예약 확인 메일에 적힌 번호인지 확인**하고, 검색 결과나 지도에 뜬 번호로 바로 걸지 않기.
