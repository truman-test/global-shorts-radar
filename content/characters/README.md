# 캐릭터 레지스트리 (content/characters)

2026-10-14 오너 결정: 캐릭터는 고정 출연진이 아니라 **이야기마다 필요할 때 만든다**. 캐릭터 한 명 = 이 폴더의 JSON 파일
하나(`<id>.json`). 코드는 건드리지 않는다. 동물 스킨(`video/src/Animal.tsx`)이 종 템플릿(`video/src/Species.tsx`) 위에
스펙의 색·나이 신호·옷·소품을 입혀 그린다. 레거시 7명(father, mother, daughter, son, scammer, fake_banker, ad)도
여기 스펙으로 들어 있고, 예전과 픽셀 단위로 똑같이 그려진다(이 7명만 사람 스킨도 있음).

- 검사: `PYTHONPATH=src python -m radar.production.characters check` (스키마 오류는 exit 1, 경고는 출력)
- 목록: `PYTHONPATH=src python -m radar.production.characters list`
- 대본: cast 항목의 `"character"`에 이 폴더의 id를 쓴다. 모르는 id는 script-check 오류.
  렌더러는 Python이 넣어 준 해석된 스펙(`CastMember.spec`)을 쓰고, 없으면 번들에 들어 있는 이 폴더 파일을 쓴다(네트워크 없음).

## 새 캐릭터 추가 (3단계)

1. **파일 만들기**: 가장 비슷한 파일(예: `cat_guard.json`)을 복사해 `content/characters/<새 id>.json`으로 저장하고,
   `id`(파일 이름과 같게), `label`, `species`, `role_kind`, 색, 옷, 소품을 바꾼다. 레거시 전용 필드(`legacy`, `body.pin`)는 넣지 않는다.
2. **검사**: `PYTHONPATH=src python -m radar.production.characters check` → 0 errors.
3. **견본 보기**: `video/`에서
   ```
   npx remotion still src/index.ts CharacterSheet out.png --props='{"ids":["<새 id>","mother","scammer"]}'
   ```
   (어두운 무대: `"dark": true`, 표정 바꾸기: `"rows": [{"expr":"smug","gesture":"point"}, ...]`,
   폴더에 넣기 전 초안: `"specs": [{...스펙...}]`, 인자 없이 렌더하면 레지스트리 전체.)
   이미지를 **직접 보고** 같은 장면의 다른 캐릭터와 실루엣·색이 구분되는지 확인한 뒤, 대본 cast에
   `{"voice": "M4", "label": "경비", "role": "neutral", "character": "<새 id>"}` 처럼 넣는다.

## 스키마

| 필드 | 값 | 설명 |
|---|---|---|
| `id` | `[a-z][a-z0-9_]{1,23}` | 파일 이름과 같아야 함 |
| `label` | 한국어 1-8자 | 이름/역할(견본 시트 표시). 자막 칩은 대본 cast의 `label`(6자 이하)이 따로 |
| `species` | `dog` `fox` `cat` `rabbit` `bear` `raccoon` | 종 템플릿. `hedgehog`는 도치 전용(금지) |
| `role_kind` | `family` `caller` `other` `presenter` | 이야기 속 쓰임. 아래 표 참고 |
| `voice` | `F1`-`F5`, `M1`-`M5` | 추천 목소리(대본 cast의 `voice`가 최종) |
| `legacy` | `true` | 레거시 7명만 |
| `body.height` | `elder`(약 2.7등신) `adult`(2.9) `tall`(3.0) | family는 elder/adult만 |
| `body.build` | `slim` `regular` `broad` | 어깨·몸통·다리 폭 |
| `body.pin` | 레거시 id | 레거시 7명의 예전 몸 그대로(새 캐릭터 금지) |
| `palette.fur` `muzzle` `innerEar` `brow` `paw` `pad` | `#RRGGBB` | 털, 주둥이·얼굴 밝은 부분, 귀 안, 눈썹, 손발, 발바닥 |
| `palette.earTip` | 색 또는 `null` | 여우 귀 끝 |
| `palette.nose` | 색 | 코(기본 `#2E2622`) |
| `palette.marking` | 색 또는 `null` | 고양이 줄무늬, 너구리 눈가·귀 검은 무늬, 반달곰 턱밑 반달 |
| `markings` | `none` `urajiro`(dog) `tabby`(cat, rabbit) | 추가 무늬 |
| `age.young` | bool | 머리 조금 작게(성인 자녀 세대) |
| `age.wrinkles` | bool | 눈가 주름 두 줄 |
| `age.greyBrows` | bool | 숱 많은 눈썹(색은 `palette.brow`) |
| `eyes` | `round` `narrow`(여우 눈꺼풀) `lash`(속눈썹 한 획) `sleepy`(차분히 내려온 눈꺼풀) | |
| `hair` | `{"style": "none"|"perm"|"forelock"|"slicked"|"bun", "color", "shade"}` | 머리 위 털 |
| `glasses` | `none` `halfMoon`(돋보기) `round` | |
| `hat` | `null` 또는 `{"style": "cap", "color"}` | 휘장 없는 무지 모자 |
| `clip` | `null` 또는 색 | 귀밑 머리핀 |
| `outfit.type` | `cardigan` `blouseCardigan` `officeLanyard` `hoodie` `darkHoodie` `suitBadge` `suit` `workJacket` `vest` `knit` | 앞 7개는 레거시 옷 |
| `outfit.top` `inner` `accent` `legs` `shoes` | 색 | 상의(소매 포함), 안쪽 옷/스카프, 단추·조끼 등 포인트, 바지/치마, 신발. vest는 top=블라우스, accent=조끼 |
| `outfit.skirt` `sheen` | bool | 치마, 광택 정장 |
| `prop` | `none` `headset` `whistle` `nameTag` `brooch` `pen` | 누구인지 알려 주는 소품 하나(무지, 로고·기관명 없음) |
| `acting.habit` | 표정 또는 `null` | 말할 때·들을 때 기본 표정(사기범 smug, 가짜 직원 fakeKind) |
| `acting.halfShadow` | bool | 통화창에서 얼굴 반쪽 그림자(가짜 은행원) |
| `notes` | 문자열 | 디자이너 메모(렌더러에는 안 감) |

### role_kind

| kind | 쓰임 | 예 |
|---|---|---|
| `family` | 피해자와 가족: victim 자리, 다른 가족 자리 | father, mother, daughter, son |
| `caller` | 사기꾼 쪽: 통화창, 악당 세트, 여우 변장(`costume`은 여우 caller/presenter만) | scammer, fake_banker |
| `other` | 주변 인물·조력자: 피해자 옆 "other" 자리(가족처럼 말하는 사람), 피해자는 못 됨 | cat_guard, rabbit_teller |
| `presenter` | TV 광고 목소리(watch_ad) | ad |

## 규칙 (테스트: tests/test_character_registry.py)

- 어른스러운 저채도 색(채도 높은 사탕색·빨강 경고). 빨강은 이 채널에서 "위험" 뜻이라 큰 면적에 쓰지 않는다.
- 실존 IP(카카오/라인프렌즈, 뽀로로, 주토피아, 포켓몬, 시바 밈 등)·실존 인물·브랜드·제복/휘장과 닮지 않게.
  곰은 반달가슴곰(숯빛 털, 턱밑 흰 반달, 큰 흰자 눈)으로 그려 납작한 갈색 곰 캐릭터와 구분된다.
- 나이·성별·지역 고정관념 금지, 5070은 유능하게. 나이는 눈썹·주름·안경·머리 모양으로만 보여 준다(희화화 금지).
- 머리는 리그의 머리 상자 안(귀 끝 ≥ -415, 반폭 ≤ 194, 턱 ≤ -33), 몸은 SD 비율(허리 0.6-0.75 머리, 폭 1.05-1.2).
  종 템플릿과 몸 클래스가 보장하므로 스펙만 바꾸면 모든 연출(staging) 구도 규칙이 그대로 지켜진다.
- 같은 장면의 캐릭터끼리 종·털색·옷색이 다 비슷하면 script-check가 경고한다.
- 사람 스킨(`cast_style` human)에서는 새 캐릭터가 동물로 그려진다(경고). 새 캐릭터를 쓰는 대본은 `"cast_style": "animal"`.
