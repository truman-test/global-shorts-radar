# Remotion과 폰 화면 재연이 슬라이드쇼를 끝낸다

쉬운 말로 결론부터 말하면, 지금 영상이 "슬라이드쇼"처럼 보이는 이유는 그림의 해상도가 낮아서가 아니다. **화면이 움직이지 않고, 장면이 바뀌지 않고, 자막이 말과 함께 움직이지 않고, 효과음이 없어서**다. 이 네 가지는 거의 전부 무료 오픈소스로 고칠 수 있다. 추천 1안은 다음과 같다. 렌더링 엔진을 **Remotion**으로 바꾼다. Remotion은 웹페이지처럼 코드로 화면을 짜서 영상으로 찍어내는 도구이고, 1인 운영자는 수익 채널에서도 무료로 쓸 수 있다 ([Remotion LICENSE.md](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)). TTS가 알려주는 단어별 시간으로 **어절 단위 강조 자막**을 만든다. 보이스피싱 전화 수신 화면, 스미싱 문자, 메신저 대화를 **코드로 그린 폰 화면**으로 재연한다. 배경 그림은 로컬 Z-Image Turbo로 만들거나 장당 약 0.04달러인 클라우드 이미지를 쓰고, 그 위에 천천히 줌·패닝을 건다. 클라우드 AI 영상은 영상 한 편에 8초짜리 "하이라이트 컷" 하나만 Veo 3.1 Lite/Fast로 넣으면 **월 약 12~29달러**다 ([Gemini API 가격](https://ai.google.dev/gemini-api/docs/pricing)). 사용자가 말한 **"GPT 아스트라"는 OpenAI가 2026년 9월 3일 공개한 GPT-6 Astra**다. 글을 쓰고 컴퓨터를 조작하는 모델이라 영상을 직접 만들지 못하고, 다른 영상 도구를 대신 조작하는 "감독" 역할만 할 수 있다 ([MindStudio](https://www.mindstudio.ai/blog/gpt-6-astra-video-editing-agent), [Elser.ai](https://www.elser.ai/blog/can-gpt-6-astra-generate-images-video-audio)). RTX 3060 Ti(8GB)로 로컬 AI 영상을 만들 수는 있지만 5초 클립 하나에 수십 분이 걸린다. 게다가 인기 있는 FramePack과 HunyuanVideo 계열은 라이선스가 **한국에서는 적용되지 않는다** ([HunyuanVideo LICENSE](https://huggingface.co/tencent/HunyuanVideo/blob/main/LICENSE)). 그래서 로컬 영상 생성은 주력이 아니다. 대안 1안은 지금의 Python 파이프라인을 유지하면서 ASS 카라오케 자막, ffmpeg 줌·전환, HTML 템플릿 폰 화면을 더하는 길이다. 어느 쪽이든 **첫 주에 비용 0원으로 할 수 있는 개선**(단어 자막, 줌, 장면 전환, 음악 덕킹, 첫 프레임 훅)부터 시작하면 된다.

## 쉬운 말로 먼저: 무엇을 무엇으로 바꾸면 되는가

아래 표가 이 보고서의 요약이다. 왼쪽이 지금 상태, 가운데가 바꿀 것, 오른쪽이 비용과 난이도다. 이어지는 절들은 각 선택의 근거와 다른 후보를 고르지 않은 이유를 설명한다.

| 지금 | 바꿀 것 (추천 1안) | 비용 | 난이도 |
|---|---|---|---|
| Pillow로 그린 정지 카드 | Remotion 컴포넌트(키네틱 타이포, 아이콘 애니메이션, 폰 화면 목업) | 0원 (1인·3인 이하 무료) | 중 |
| 장면 전환 없이 이어 붙이기 | 장면마다 스프링 등장, 2~4초마다 시각 변화, 키워드 줌 펀치 | 0원 | 하 |
| 문장 단위 ASS 자막 | Azure TTS의 단어 경계(WordBoundary) → 어절 단위 강조 자막 | 0원 (Azure 무료 월 50만 자) | 하 |
| 단색 벡터 아이콘 | 아이콘 그리기 애니메이션 + 선별한 Lottie | 0원 | 하 |
| 그라디언트 배경만 | Z-Image Turbo(로컬) 또는 Gemini Flash Image 배경 + 켄 번스 줌 | 0원 또는 월 약 5~10달러 | 중 |
| (없음) | 선택: 영상당 Veo 3.1 Lite/Fast 8초 하이라이트 컷 1개 | 월 약 12~29달러 | 하 |
| 음악·효과음 없음 또는 고정 볼륨 | YouTube 오디오 보관함 BGM + Freesound CC0 효과음, 음성 덕킹, −14 LUFS 마스터 | 0원 | 하 |

이 표에서 빠진 것도 중요하다. 로컬 AI 영상 생성, 완성형 오픈소스 생성기 통째 도입, "GPT 아스트라" 같은 에이전트에 매일 제작을 맡기는 방식은 모두 비용 대비 효과가 낮거나 라이선스 위험이 있어서 주력에서 뺐다. 이전 보고서 「전자동 한국어 Shorts 채널 30일 성장」에서 정리한 세 가지 전제는 그대로 유효하다. TTS는 edge-tts 대신 Azure·Google 무료 티어를 쓴다. API로 업로드한 영상은 감사 전까지 비공개로 잠긴다. 하루 10~20분의 사람 검수가 필요하다.

## 렌더 엔진은 Remotion이 1순위, HyperFrames가 보험이다

프로그래밍 방식 영상 엔진은 세 계열로 나뉜다. 첫째는 브라우저(Chrome)로 HTML/CSS/React 화면을 한 프레임씩 찍는 계열로, Remotion, HyperFrames, Revideo가 여기에 속한다. 둘째는 Python으로 프레임을 직접 합성하는 계열(MoviePy, Manim)이고, 셋째는 JSON 명세를 ffmpeg로 이어 붙이는 계열(Editly, FFCreator)이다. 한국어 Shorts에는 첫째 계열이 결정적으로 유리하다. 브라우저가 한글 조판, 줄바꿈, 웹폰트, 그림자, 블러, 스프링 애니메이션을 기본으로 처리하기 때문이다. Python 계열은 폰트 파일 경로를 직접 지정하고 줄바꿈과 모션을 손으로 코딩해야 한다 ([MoviePy v2 마이그레이션 가이드](https://zulko.github.io/moviepy/getting_started/updating_to_v2.html)). 브라우저 계열은 VRAM을 거의 쓰지 않는다. GPU는 CSS 그림자·그라디언트·필터 가속과 NVENC 인코딩에만 관여하므로 **8GB VRAM은 엔진 선택의 제약이 아니다** ([Remotion 성능 문서](https://www.remotion.dev/docs/performance)).

| 엔진 | 저장소 | 스타 | 최근 push | 라이선스 | Windows | 판정 |
|---|---|---|---|---|---|---|
| Remotion | [remotion-dev/remotion](https://github.com/remotion-dev/remotion) | 62,492 | 2026-10-08 (v4.0.534) | Remotion License: 개인·3인 이하 영리법인 무료 | 공식 Windows x64 FFmpeg 포함, NVENC 지원 | **1순위** |
| HyperFrames | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | 58,956 | 2026-10-08 (2026-03 생성) | Apache-2.0 | 동작하나 Windows 이슈 열림 | **보험·대안 엔진** |
| Manim CE | [ManimCommunity/manim](https://github.com/ManimCommunity/manim) | 41,351 | 2026-10-08 (v0.22.0) | MIT | 가능, Python ≥3.11 | 도표 삽입 컷 전용 |
| Motion Canvas | [motion-canvas/motion-canvas](https://github.com/motion-canvas/motion-canvas) | 19,255 | 2026-07-02 | MIT | 에디터 전용 | 제외 (헤드리스 렌더 없음) |
| MoviePy 2.x | [Zulko/moviepy](https://github.com/Zulko/moviepy) | 14,960 | 2026-08-26 (마지막 릴리스 2025-05-21) | MIT | 가능, 3.14 미검증 | Python 유지 대안 |
| Editly | [mifi/editly](https://github.com/mifi/editly) | 5,520 | 2025-05-12 | MIT | headless-gl 네이티브 빌드 위험 | 비추천 (17개월 정체) |
| Revideo | [midrender/revideo](https://github.com/midrender/revideo) | 4,091 | 2026-07-15 | MIT | 정보 없음 | 유지보수 위험 |
| FFCreator | [tnfe/FFCreator](https://github.com/tnfe/FFCreator) | 3,163 | 2024-12-19 | MIT | — | 제외 (방치) |
| Diffusion Studio | [diffusionstudio/core](https://github.com/diffusionstudio/core) | 1,247 | 2025-11-18 | MPL-2.0 + 무료판 워터마크 | 브라우저 전용 | 제외 |

표의 수치는 2026-10-08에 GitHub API에서 조회한 값이다. Remotion을 1순위로 꼽은 이유는 성숙도, 라이선스, Windows 지원, 자막 도구가 한 묶음으로 맞기 때문이다. 라이선스 원문은 **"개인(an individual)"과 "직원 3명 이하의 영리 조직"**에게 "상업적이든 비상업적이든 영상 제작 목적의" 무료 사용을 허용하고, Remotion 자체를 재판매하는 것만 금지한다. 1인 수익 채널은 정확히 무료 범위다 ([Remotion LICENSE.md](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)). 다만 아직 출시되지 않은 5.0에서는 외주 계약자도 인원수에 포함되도록 바뀔 예정이므로, 사업이 커지면 다시 확인해야 한다 ([Remotion PR #3750](https://github.com/remotion-dev/remotion/pull/3750)). 무인 운영에 필요한 기능도 갖췄다. `npx remotion render`에 `--props`로 JSON 파일을 넘기면 Python이 만든 대본·타이밍 데이터를 그대로 영상으로 바꿀 수 있다. 단, **Windows 셸은 따옴표를 지워 인라인 JSON이 깨지므로 반드시 파일 경로로 넘겨야 한다** ([Remotion CLI render](https://remotion.dev/docs/cli/render)). v4.0.484부터는 Windows에서 NVIDIA NVENC 하드웨어 인코딩을 지원한다. 드라이버 525 이상이 필요하고 `--hardware-acceleration if-possible` 플래그를 쓰며, 번들 FFmpeg에 인코더가 포함돼 있다 ([Remotion 하드웨어 가속](https://remotion.dev/docs/hardware-acceleration)). 한국어 폰트에는 함정이 하나 있었다. `@remotion/google-fonts`가 `korean` 서브셋에서 오류를 내던 버그가 2026년 5월에야 고쳐졌다 ([Remotion 이슈 #7258](https://github.com/remotion-dev/remotion/issues/7258)). 또 폰트 로드를 기다리지 않으면 조용히 Arial로 대체된다는 경고도 있다 ([crepal.ai](https://crepal.ai/blog/aivideo/blog-how-to-use-custom-fonts-in-remotion/)). 따라서 Pretendard나 Noto Sans KR의 woff2 파일을 프로젝트에 넣고 직접 로드하는 방식이 매일 같은 결과를 보장한다.

렌더 속도는 정직하게 말해 **아직 아무도 측정하지 않았다**. Remotion 공식 문서에는 기준 수치가 없고, 인터넷에 도는 "1080p 영상 하나에 2~5분" 같은 숫자는 원출처를 추적할 수 없다 ([Remotion 성능 문서](https://www.remotion.dev/docs/performance), [RenderComp](https://rendercomp.com/blog/remotion-render-time-benchmarks/)). 공식 방법은 `npx remotion benchmark --concurrency=1,2,4,8`로 이 PC에서 직접 재는 것이다 ([Remotion benchmark](https://cloudrun.remotion.dev/docs/cli/benchmark)). 30초 1080×1920 영상은 900프레임이다. 6코어 5600X에서 CSS·SVG 모션 그래픽이면 수 분 안에 끝날 것으로 보이지만, 비관적으로 10분이 걸려도 하루 1편에는 문제가 없다.

HyperFrames는 Remotion과 같은 브라우저 계열의 2026년 신예다. HTML·CSS·GSAP·Lottie를 "결정론적 MP4"로 렌더하고, 변수를 바꿔 "레코드당 하나씩" 찍어내는 템플릿 기능과 `/faceless-explainer`, `/motion-graphics`, `/embedded-captions` 같은 에이전트 스킬을 기본으로 제공한다 ([HyperFrames README](https://github.com/heygen-com/hyperframes), [HyperFrames 문서](https://hyperframes.heygen.com/llms.txt)). 가장 큰 장점은 **Apache-2.0이라 인원수 조건이 전혀 없다**는 점이다. 그러나 만든 지 7개월밖에 안 됐다. 2026년 10월에도 Windows 11 스마트 앱 컨트롤이 sharp의 서명 안 된 DLL을 차단하는 문제, CLI 종료 시 콘솔 창이 뜨는 문제 같은 Windows 이슈가 열려 있다 ([HyperFrames Windows 이슈](https://github.com/heygen-com/hyperframes/issues?q=windows)). 개발사 HeyGen조차 Remotion이 "더 오래되고 훨씬 확립되어 있으며 템플릿·튜토리얼·답변·운영 이력이 많다"고 인정한다 ([HyperFrames vs Remotion](https://hyperframes.heygen.com/guides/hyperframes-vs-remotion.md)). 무인 일일 작업에는 Remotion으로 시작하고, 팀이 4명 이상으로 커질 가능성이 생기면 HyperFrames로 옮기는 것이 합리적이다. HyperFrames에는 `/remotion-to-hyperframes` 이전 스킬까지 있다.

나머지 엔진은 조건부이거나 탈락이다. Motion Canvas는 헤드리스 렌더 요청 이슈가 2023년부터, 관련 PR이 2024년부터 열려 있어 사람이 에디터를 띄우지 않으면 렌더할 수 없다 ([이슈 #415](https://github.com/motion-canvas/motion-canvas/issues/415), [PR #1055](https://github.com/motion-canvas/motion-canvas/pull/1055)). Revideo는 MIT에 `renderVideo()` API가 있지만 0.10.4(2025-02)에서 0.11.0(2026-07)까지 17개월간 릴리스가 없었다. 지금은 한 스타트업(Midrender)의 엔진이라 미래가 그 회사 사정에 달려 있다 ([npm @revideo/core](https://www.npmjs.com/package/@revideo/core), [Revideo README](https://github.com/midrender/revideo)). Manim은 MIT에 매우 활발하지만 수학 애니메이션 미학이라 사기 재연 Shorts의 주력으로는 맞지 않는다. "피싱 링크 구조도" 같은 설명 삽입 컷에만 쓸 만하다. MoviePy 2.x는 ImageMagick 의존을 버리고 Pillow로 통일했으며 `TextClip`에 폰트 파일 경로를 받으므로 한글 자체는 문제없다. 하지만 프레임 단위 Python 합성이라 느리다는 이슈가 열려 있고 표현력도 CSS·React에 크게 못 미친다 ([MoviePy 이슈 #2506](https://github.com/Zulko/moviepy/issues/2506)). 지금 Pillow 카드에서 "조금 나아진" 수준에 머문다.

## 단어 자막은 TTS가 시간을 알려주게 하고, 못 알려주면 WhisperX로 맞춘다

단어가 말과 함께 강조되는 자막(일명 카라오케, Hormozi 스타일)은 슬라이드쇼 느낌을 가장 싸게 없애는 장치다. 만드는 일은 두 부분으로 나뉜다. 하나는 **각 어절이 몇 초에 발음되는지 정확한 시간을 얻는 것**이고, 다른 하나는 그 시간에 맞춰 **화면에 그리는 것**이다.

시간 확보는 "대본을 이미 알고 있다"는 점을 이용해야 한다. 음성 인식으로 다시 받아 적으면 한국어 오인식과 무음 구간의 환각 자막이 끼어든다. 가장 좋은 방법은 TTS 엔진이 합성하면서 단어 경계를 내보내게 하는 것이다. Azure Speech SDK의 `WordBoundary` 이벤트는 단어마다 `AudioOffset`, `Duration`, `Text`, `TextOffset`을 주며, Microsoft는 이를 "말할 때 언제, 얼마나 오래 단어를 강조할지" 정하는 용도라고 설명한다 ([Microsoft Learn](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis)). 이전 보고서에서 정리했듯 Azure는 edge-tts와 같은 한국어 음성(SunHi, InJoon, Hyunsu 등)을 **월 50만 자 무료**로, 상업 조건이 명확하게 제공한다 ([Azure Speech 가격](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/)). 그러니 Azure로 바꾸면 라이선스 문제와 자막 타이밍이 한 번에 해결된다. edge-tts도 `boundary="WordBoundary"`를 주면 단어 경계를 내보낸다. 다만 v7부터 기본값이 문장 단위로 바뀌어 "SRT가 비었다"는 신고가 나왔다 ([edge-tts communicate.py](https://raw.githubusercontent.com/rany2/edge-tts/master/src/edge_tts/communicate.py), [edge-tts 이슈 #420](https://github.com/rany2/edge-tts/issues/420)). 피해야 할 경로도 있다. Google Cloud TTS는 SSML `<mark>` 태그를 넣어야만 시간을 주는데, 한국어 품질이 좋은 Chirp 3 HD와 Studio 음성은 `<mark>`를 지원하지 않는다 ([Google Chirp 3 HD](https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd), [Google 음성 유형](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types)). 확인되지 않은 것도 하나 있다. Azure가 한국어에서 어절을 통째로 주는지, 조사를 떼어 주는지, 숫자 토큰을 빠뜨리는지는 어떤 자료에도 없다. **도입 첫날 숫자가 많은 문장 하나로 이벤트를 찍어 보는 것**이 필수다.

TTS가 경계를 주지 않는 경우(Chirp 3 HD, Typecast, ElevenLabs 일부 설정, 로컬 TTS)에는 WhisperX의 **정렬(alignment) 기능만** 쓴다. 대본 텍스트를 그대로 오디오에 맞추는 방식이다. WhisperX 코드에서 띄어쓰기 없는 언어 목록은 일본어·중국어뿐이고 한국어는 빠져 있다. 그래서 출력이 어절 단위로 묶이며, 한국어 기본 정렬 모델은 `kresnik/wav2vec2-large-xlsr-korean`이다 ([WhisperX alignment.py](https://github.com/m-bain/whisperX/blob/main/whisperx/alignment.py)). 이 모델은 8GB VRAM에 충분히 들어갈 것으로 보이지만 벤치마크는 없다.

| 도구 | 저장소 | 스타 | 최근 push | 라이선스 | Windows/8GB | 용도 |
|---|---|---|---|---|---|---|
| @remotion/captions + template-tiktok | [remotion-dev/template-tiktok](https://github.com/remotion-dev/template-tiktok) | 283 | 2026-09-29 | Remotion License | 가능 / 무관 | 추천 1안의 자막 렌더 |
| pycaps | [francozanardi/pycaps](https://github.com/francozanardi/pycaps) | 221 | 2026-09-30 | MIT | Python 3.10~3.12만 테스트 / 무관 | 대안 1안의 CSS 자막 |
| tscaps | [francozanardi/tscaps](https://github.com/francozanardi/tscaps) | 83 | 2026-10-01 | 엔진 MIT, 앱 AGPL-3.0 | 브라우저 | 참고 |
| remotion-captions-themes | [vshukla7/remotion-captions-themes](https://github.com/vshukla7/remotion-captions-themes) | 9 | 2026-06-23 | MIT | — | 자막 테마 아이디어 |
| captacity | [unconv/captacity](https://github.com/unconv/captacity) | 139 | 2024-06-07 | MIT | — | 방치 |
| auto-subtitle | [m1guelpf/auto-subtitle](https://github.com/m1guelpf/auto-subtitle) | 2,290 | 2024-07-12 | MIT | — | 방치, 단어 애니메이션 없음 |
| WhisperX | [m-bain/whisperX](https://github.com/m-bain/whisperX) | 24,420 | 2026-09-26 | BSD-2-Clause | 가능 / 8GB 충분(추정) | 대본 강제 정렬 폴백 |
| faster-whisper | [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) | 25,757 | 2026-10-06 | MIT | 가능 / 8GB 충분 | 단어 타임스탬프 ASR |
| whisper.cpp | [ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp) | 54,219 | 2026-10-06 | MIT | 가능 | template-tiktok 기본 엔진 |
| ctc-forced-aligner | [MahmoudAshraf97/ctc-forced-aligner](https://github.com/MahmoudAshraf97/ctc-forced-aligner) | 567 | 2026-09-07 | BSD-2-Clause | — | 경량 정렬 대안 |
| whisper-timestamped | [linto-ai/whisper-timestamped](https://github.com/linto-ai/whisper-timestamped) | 2,852 | 2026-09-28 | **AGPL-3.0** | — | 코드 차용 금지 |
| stable-ts | [jianfch/stable-ts](https://github.com/jianfch/stable-ts) | 2,282 | 2026-05-30 | MIT, **보관(archived)** | — | 제외 |
| edge-tts | [rany2/edge-tts](https://github.com/rany2/edge-tts) | 12,192 | 2026-03-22 | GPL-3.0 파일 존재 | — | 비공식 엔드포인트, 상업 이용 불명확 |

화면에 그리는 쪽에서는 Remotion의 `createTikTokStyleCaptions()`가 핵심이다. 단어별 `startMs`/`endMs` 배열을 받아 "페이지"와 토큰별 `fromMs`/`toMs`로 묶어 준다. `combineTokensWithinMilliseconds`로 한 화면에 올라갈 단어 수를 정하고, v4.0.514부터는 침묵 후 새 페이지를 시작하는 옵션도 있다 ([Remotion 문서](https://www.remotion.dev/docs/captions/create-tiktok-style-captions)). 이 함수는 띄어쓰기로 토큰을 나눈다. 띄어쓰기가 없는 일본어·중국어에서는 문제가 되지만, 어절 사이를 띄우는 한국어에서는 어절 하나가 토큰 하나가 될 것이다. 추론이며 아직 테스트하지 않았다. template-tiktok의 기본 Whisper 모델은 영어 전용 `medium.en`이라, 한국어에서는 `.en`이 없는 모델로 바꾸거나 TTS 타이밍을 직접 넣어야 한다 ([template-tiktok](https://github.com/remotion-dev/template-tiktok)).

지금의 ffmpeg+ASS 구조에서도 당장 할 수 있는 일이 있다. ASS의 `\k`(즉시 색 변경), `\kf`(왼쪽부터 채움), `\ko`(외곽선 먼저) 카라오케 태그를 libass가 포함된 ffmpeg로 구우면 노란색 활성 단어 효과가 바로 나온다 ([skillselion](https://skillselion.com/skills/josiahsiegel/claude-plugin-marketplace/ffmpeg-karaoke-animated-text)). 한계도 분명하다. `\k`는 색만 바꾸므로 활성 단어가 커지는 팝 효과를 내려면 단어마다 Dialogue 이벤트를 따로 만들고 `\t(\fscx\fscy)` 변형을 걸어야 한다. 컬러 이모지와 단어 뒤 둥근 배경 상자는 사실상 어렵다.

스타일 기본값은 근거 수준을 낮게 보고 정해야 한다. "동적 자막이 시청 시간을 23~40% 올린다", "단어 단위 자막이 가장 높은 유지율을 보인다" 같은 수치는 모두 표본과 방법을 공개하지 않은 자막 도구 회사의 블로그 주장이다 ([videocaptions.ai](https://www.videocaptions.ai/blog/how-video-captions-increase-engagement), [OpusClip](https://www.opus.pro/blog/best-caption-presets-styles-boost-retention)). 그래도 실무 합의는 일관된다. 한 화면에 1~3어절을 두고, 활성 어절은 노랑이나 초록에 두꺼운 검은 외곽선을 준다. 105~115% 정도로 살짝 커지게 하고, 과한 튕김·회전은 피로를 준다 ([KreateFlo](https://kreateflo.com/blog/which-animated-caption-styles-actually-increase-video-watch-time)). 위치는 세로 1500px 부근이 무난하며, 하단 340px과 오른쪽 160px은 Shorts 버튼이 덮으니 비워 둔다 ([learnwithhasan](https://learnwithhasan.com/guide/how-to-make-faceless-youtube-shorts-with-claude-code/)).

## 사기 재연에는 AI 영상보다 코드로 그린 폰 화면이 먼저다

이 채널의 주제는 "가짜 검찰 전화", "택배 스미싱 문자", "가족 사칭 메신저", "딥페이크 영상통화"다. 이런 장면의 시각 소재는 대부분 **스마트폰 화면 그 자체**다. 그래서 가장 정확하고 싸고 빠른 소재는 AI가 아니라 코드로 그린 UI다. 수신 화면에 "발신: 서울중앙지검", 문자 말풍선에 "[국제발신] 택배 주소 불일치 http://…"가 뜨는 장면은 HTML/CSS로 그리면 내레이션과 100% 일치한다. 스톡 영상이나 AI 생성처럼 장면이 엇나가는 문제가 원천적으로 없다. 오픈소스 생성기 분석에서도 결과물이 좋은 2026년 프로젝트는 모두 브라우저 엔진으로 카드·도표·폰 UI를 코드로 그리는 쪽이었다 (다음 절 참조). 이 판단을 바탕으로 소재 우선순위를 정했다. 1순위는 코드 UI와 키네틱 타이포, 2순위는 생성 정지 이미지에 움직임을 준 것, 3순위는 선택적인 AI 영상 하이라이트 컷이다.

**로컬 이미지 생성은 8GB에서 충분히 실용적이지만, 모델 라이선스가 갈린다.** 가장 맞는 후보는 알리바바의 **Z-Image Turbo**다. 6B 파라미터, Apache-2.0, 8스텝 증류 모델이며 GGUF 양자화판이 "5~6GB"에서 돈다. 12GB 이하에는 `z_image_turbo-Q5_K_S.gguf`가 권장된다 ([ThunderCompute](https://www.thundercompute.com/blog/z-image-turbo-comfyui), [lightx2v/Z-Image-Turbo-Quantized](https://huggingface.co/lightx2v/Z-Image-Turbo-Quantized/blob/main/README.md)). ComfyUI 공식 워크플로 템플릿도 있다 ([comfy.org Z-Image](https://www.comfy.org/workflows/model/z-image)). 16GB 카드에서 장당 2~3초라는 보고가 있으니 3060 Ti에서는 수십 초로 예상되지만 실측은 없다. 영상당 5~15장이면 하루 1편에 전혀 문제없다. 반대로 **FLUX.1 [dev]는 피해야 한다.** 생성 이미지는 "상업 목적 포함 어떤 목적으로든" 쓸 수 있다고 하면서도, 모델 자체는 "수익 창출 활동(revenue-generating activity)"을 제외한 비상업 목적으로만 실행하게 되어 있다. 수익 채널의 매일 돌아가는 생산 파이프라인은 이 조항에 걸릴 소지가 크다 ([FLUX.1-dev LICENSE.md](https://huggingface.co/black-forest-labs/FLUX.1-dev/blob/main/LICENSE.md)). Stable Diffusion 3.5는 연매출 100만 달러 미만이면 상업 무료이니 1인 채널은 해당된다 ([Stability AI](https://stability.ai/news/license-update)). Qwen-Image(20B, Apache-2.0)는 라이선스는 깨끗하지만 Q4 양자화도 11.5GB라 8GB에서는 오프로딩으로 겨우 돌아간다 ([QuantStack/Qwen-Image-GGUF](https://huggingface.co/QuantStack/Qwen-Image-GGUF/blob/c0f180cb504779b59efd27bb73f128391b030946/README.md)). 어느 모델이든 이미지 안에 한글을 그리게 하지 말아야 한다. 프롬프트는 영어로 쓰고 한글은 Remotion 오버레이로 올린다.

무인 자동화는 ComfyUI의 로컬 HTTP API로 충분하다. GUI에서 워크플로를 만들어 "API 형식"으로 내보낸 뒤, Python이 프롬프트·시드·크기를 바꿔 `POST /prompt`로 보내고, `/ws`로 진행 상황을 보고, `/history/{prompt_id}`와 `/view`로 결과를 받는다 ([ComfyUI 서버 라우트](https://docs.comfy.org/development/comfyui-server/comms_routes)). 8GB에서는 이미지 모델과 영상 모델을 동시에 올릴 수 없으므로 작업 사이에 모델을 내려야 한다. ComfyUI 자체의 스타 수와 최근 커밋은 이번 조사에서 수집하지 않았다.

**로컬 영상 생성은 "가능하지만 주력은 불가"다.** 라이선스가 가장 깨끗한 후보는 **Wan 2.2**다 ([Wan-Video/Wan2.2](https://github.com/Wan-Video/Wan2.2), 약 17.8k 스타). 모델과 생성물이 모두 Apache-2.0이다. 공식 저장소는 TI2V-5B에 24GB를 요구하지만, ComfyUI 문서는 "네이티브 오프로딩으로 8GB에 잘 맞는다"고 쓴다. 두 출처가 충돌하는 셈이다 ([ComfyUI Wan2.2](https://docs.comfy.org/tutorials/video/wan/wan2_2)). 속도는 더 큰 문제다. 한 가이드는 8GB에서 5초 720p 클립에 약 40분이 걸린다고 추정한다. 이 수치는 4스텝 Lightning/Turbo 증류 이전의, 근거가 약한 2차 자료다 ([SSD Nodes](https://www.ssdnodes.com/learn/lang/es/self-hosted-ai-video-generator), [Wan2.2-TI2V-5B-Turbo-GGUF](https://huggingface.co/hum-ma/Wan2.2-TI2V-5B-Turbo-GGUF)). 장면이 6~10개인 영상을 전부 AI 영상으로 채우면 수 시간이 걸리고, 품질도 클라우드 Veo·Kling에 못 미친다. LTX-Video([Lightricks/LTX-Video](https://github.com/Lightricks/LTX-Video), 약 11.1k 스타)는 빠르다. LTX-2 오픈 웨이트 라이선스는 연매출 1,000만 달러 미만이면 상업 무료이지만, Lightricks 서비스를 대체하는 용도는 금지한다 ([LTX-2 라이선스](https://static.lightricks.com/legal/ltx-2-open-weights-license-0.X.pdf)). 8GB 실행 가능성은 확인하지 못했다. 가장 중요한 경고는 FramePack이다([lllyasviel/FramePack](https://github.com/lllyasviel/FramePack), 약 17.3k 스타). 6GB에서 돌고 Windows 원클릭 패키지까지 있어 인기가 높지만, 모델이 HunyuanVideo 기반이다. 텐센트 라이선스는 **"EU, 영국, 대한민국에서는 적용되지 않는다"**고 명시한다 ([HunyuanVideo LICENSE](https://huggingface.co/tencent/HunyuanVideo/blob/main/LICENSE)). FramePack 코드는 Apache-2.0이지만 가중치에는 이 조항이 따라 내려올 가능성이 매우 높다. 한국 거주 운영자는 FramePack과 HunyuanVideo 파생 모델을 쓰지 않는 것이 맞다.

**애니메이션 아이콘과 Lottie**는 정지 아이콘을 살아 있게 만드는 가장 싼 수단이다. LottieFiles의 무료 애니메이션은 Lottie Simple License를 따른다. 상업 목적을 포함해 복제·수정·게시할 수 있고 출처 표기도 필수가 아니다. 다만 파일을 모아 비슷한 경쟁 서비스를 만드는 것은 금지된다 ([LottieFiles License](https://lottiefiles.com/page/license)). 그러니 대량 수집보다는 손으로 고른 20~50개를 로컬에 두는 방식이 안전하다. HyperFrames는 Lottie 어댑터를 공식 지원하고 ([HyperFrames README](https://github.com/heygen-com/hyperframes)), Remotion도 Lottie 재생 패키지를 제공한다. 지금 쓰는 단색 벡터 아이콘(Lucide, Tabler, Phosphor 계열로 보임)은 SVG라서 선이 그려지는 효과나 팝 등장을 코드로 바로 줄 수 있다. 각 세트의 라이선스는 이번 조사에서 재확인하지 못했으니 저장소에서 확인해야 한다.

**스톡 영상의 의미 매칭은 이 주제에서 우선순위가 낮다.** 가장 인기 있는 MoneyPrinterTurbo도 LLM이 뽑은 키워드로 Pexels·Pixabay를 검색할 뿐 의미 재정렬은 하지 않는다. 그래서 "영상이 주제와 별 관계없다"는 이슈가 반복된다 ([MPT 이슈 #680](https://github.com/harry0703/MoneyPrinterTurbo/issues/680), [#734](https://github.com/harry0703/MoneyPrinterTurbo/issues/734)). CLIP으로 후보 썸네일을 문장과 비교해 재정렬하는 방법은 OpenMontage가 구현했다. 다만 이 프로젝트는 AGPL-3.0이라 코드를 가져오면 안 된다 ([OpenMontage](https://github.com/calesthio/OpenMontage)). 더 근본적인 문제는 라이선스다. Pexels는 상업 이용과 무출처를 허용하지만, 식별 가능한 인물을 "나쁘게 보이도록" 쓰는 것을 금지한다 ([Pexels License](https://www.pexels.com/license/)). 사기범이나 피해자 역할에 실존 인물이 나오는 스톡 영상을 쓰면 이 조항에 걸릴 수 있다. 한국 거리·한국인 소재가 드물어 서양 영상이 섞이는 문제도 있다. 스톡은 손, 휴대폰 실루엣, 도시 야경처럼 얼굴이 식별되지 않는 장면에만 제한적으로 쓰는 것이 맞다.

## 완성형 생성기는 통째로 쓰지 말고 부품 창고로 쓴다

스타 수가 많은 오픈소스 Shorts 생성기는 대부분 같은 종류의 영상을 만든다. Pexels B롤에 TTS를 깔고 자막과 음악을 얹는 방식이다. 이런 영상의 품질 상한은 스톡이 대본과 얼마나 맞는지에 묶인다. 화질 불만도 반복된다. MoneyPrinterTurbo에는 "매우 흐리고 화질이 나쁘다"는 이슈가 있고, 메인테이너는 원본 해상도·비트레이트와 크롭 정도에 달렸다며 "단일 스위치는 없다"고 답했다 ([MPT #831](https://github.com/harry0703/MoneyPrinterTurbo/issues/831)). Windows 11에서 모자이크 깨짐과 색이 어두워지는 문제도 있었는데, 중간 파일을 반복 재인코딩한 탓이었다. 정규화한 조각들을 **ffmpeg concat 한 번으로 합치는** 방식으로 고쳐졌다 ([MPT #729](https://github.com/harry0703/MoneyPrinterTurbo/issues/729)). 지금 파이프라인에도 그대로 적용되는 교훈이다. **최종 인코딩은 한 번만** 하고 BT.709 색 태그를 명시한다. 결과물이 좋은 쪽은 브라우저 엔진으로 화면을 코드로 그리고 단어 단위 자막을 쓰는 소수의 Remotion 계열 프로젝트다.

| 프로젝트 | 스타 | 최근 커밋 | 라이선스 | 엔진 | Windows | 차용할 부분 |
|---|---|---|---|---|---|---|
| [harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) | 129,346 | 2026-10-08 | MIT | MoviePy 2.2.1 | 원클릭 패키지(경로에 공백·한글 금지), Python 3.11 권장 | 정지 이미지 3%/초 줌, 페이드·슬라이드·줌 전환, 단일 concat + BT.709, 단어 자막 팝 |
| [ATH-MaaS/Pixelle-Video](https://github.com/ATH-MaaS/Pixelle-Video) | 28,750 | 2026-06-14 | Apache-2.0 | Playwright HTML 템플릿 + MoviePy 1.0.3 | 올인원 패키지 | 1080×1920 HTML 카드 템플릿 구조 |
| [calesthio/OpenMontage](https://github.com/calesthio/OpenMontage) | 65,325 | 2026-10-03 | **AGPL-3.0** | Remotion·HyperFrames | PowerShell 설치 문서 | 아이디어만 (CLIP 매칭, 장면 문법) |
| [hassancs91/claude-faceless-shorts-creator](https://github.com/hassancs91/claude-faceless-shorts-creator) | 271 | 2026-08-18 | MIT | Remotion | (명시 없음) | 100% 코드 비주얼, 효과음 큐시트, 심리스 루프, brand.ts, 사기 예제 |
| [nishit-g/tokovo](https://github.com/nishit-g/tokovo) | 81 | 2026-09-16 | MIT | Remotion 4.0.409 | (명시 없음) | 채팅·알림·잠금화면·통화 화면 컴포넌트 |
| [iart-ai/text-message-video-skills](https://github.com/iart-ai/text-message-video-skills) | 4 | 2026-06-22 | MIT | Remotion | — | 말풍선 스프링·타이핑 표시 데이터 모델 |
| [gyoridavid/short-video-maker](https://github.com/gyoridavid/short-video-maker) | 1,397 | 2025-06-21 | MIT | Remotion | **미지원 명시** | `PortraitVideo.tsx` 활성 단어 자막 |
| [SamurAIGPT/Text-To-Video-AI](https://github.com/SamurAIGPT/Text-To-Video-AI) | 837 | 2026-08-24 | MIT | Remotion | — | 참고 |
| [FujiwaraChoki/MoneyPrinter](https://github.com/FujiwaraChoki/MoneyPrinter) | 14,033 | 2026-03-26 | MIT | MoviePy + ImageMagick | Docker | 낮음 |
| [FujiwaraChoki/MoneyPrinterV2](https://github.com/FujiwaraChoki/MoneyPrinterV2) | 32,064 | 2026-09-15 | **AGPL-3.0** | Python | — | 차용 금지 |
| [RayVentura/ShortGPT](https://github.com/RayVentura/ShortGPT) | 8,008 | 2025-02-10 | MIT | MoviePy 2.1.2 | Docker/Colab | 방치 |
| [elebumm/RedditVideoMakerBot](https://github.com/elebumm/RedditVideoMakerBot) | 12,535 | 2026-03-17 | **GPL-3.0** | MoviePy + Playwright | venv | 차용 금지 |
| [Anil-matcha/AI-Youtube-Shorts-Generator](https://github.com/Anil-matcha/AI-Youtube-Shorts-Generator) | 5,276 | 2026-10-06 | MIT | Python | — | 해당 없음 (긴 영상 클리핑 도구) |

수치는 2026-10-08 GitHub API 기준이다. 이 채널에 가장 가까운 레퍼런스는 **claude-faceless-shorts-creator**다. 스톡 없이 100% 코드로 그린 Remotion 구성을 쓰고, 단어 단위로 맞춘 자막, 휴대폰 크기에서 프레임별 QA, 효과음 라이브러리, 마지막 프레임을 0번 프레임과 맞추는 심리스 루프를 갖췄다. 예제 12개 중 하나가 **"Cybersecurity — The URL That Isn't PayPal"**이라는 피싱 경고 영상이다 ([README](https://github.com/hassancs91/claude-faceless-shorts-creator)). 이 프로젝트의 가이드가 제시하는 6비트 구조(훅 → 설정 → 퀴즈 → 공개 → 반전 → 루프)와 "0번 프레임이 결론이고 페이드인 없음" 원칙은 그대로 가져올 만하다 ([learnwithhasan](https://learnwithhasan.com/guide/how-to-make-faceless-youtube-shorts-with-claude-code/)).

전화·채팅 UI 목업에서 실질적인 오픈소스는 **Tokovo**가 사실상 유일하다. "폰 안에서 일어나는 멀티 디바이스 쇼"를 표방하고 채팅, 피드, DM, 알림, 통화, 잠금화면을 다룬다. 지원 포맷에 **"Scam awareness, finance, cybersecurity"**가 명시돼 있고 MIT다 ([Tokovo README](https://github.com/nishit-g/tokovo)). 다만 지원 언어는 영어·힌디어·아랍어·일본어뿐이고 한국어는 없다. 스타 81개의 작은 프로젝트이고 실제 렌더 품질은 확인하지 못했다. 그래서 통째로 쓰기보다 화면 컴포넌트 구조를 참고해 한국형 스킨을 새로 만드는 쪽이 현실적이다. 가벼운 대안인 iart-ai의 스킬은 `spring({damping:14, mass:0.7})` 말풍선 등장, 사인파로 깜빡이는 타이핑 표시, `{from, text, typingMs, delayMs, status}` 데이터 모델을 제공한다. "한 번에 한 메시지씩, 0번 프레임에 대화 전체를 쏟지 말 것"이라는 규칙도 있다 ([SKILL.md](https://github.com/iart-ai/text-message-video-skills/blob/main/skills/text-message-animation/SKILL.md)). **오픈소스 "전화 수신 화면" 생성기는 하나도 없었다.** GitHub 검색 결과는 작은 HTML/CSS 데모뿐이었다 ([GitHub 검색](https://github.com/search?q=incoming+call+animation&type=repositories)). 결국 직접 만들어야 하는 컴포넌트는 네 가지로 정리된다. 수신 화면(발신번호 "02-…"·"010-…", 슬라이드 수락), 통화 중 타이머, 문자 말풍선 스레드, 송금 완료 화면이다. 주의할 점이 있다. 카카오톡이나 실제 은행·검찰 로고와 화면을 그대로 베끼면 상표·트레이드 드레스 문제가 생길 수 있다. "노란 계열 메신저", "가상 은행명" 같은 일반형 스킨이 안전하다. 법률 자문이 아니라 추론이다.

라이선스 지도는 단순하다. MIT·Apache-2.0 저장소(MPT, Pixelle, claude-faceless-shorts-creator, Tokovo, iart-ai, HyperFrames, Revideo)는 고지문을 유지하면 코드를 가져와도 된다. GPL-3.0(RedditVideoMakerBot)과 AGPL-3.0(MoneyPrinterV2, OpenMontage)은 내부 도구로 돌려 영상을 만드는 것 자체는 문제가 없다. 하지만 코드를 복사하면 내 도구가 파생물이 되므로 아이디어만 참고한다. 라이선스 파일이 없는 저장소(Dark2C, Sideyouss, samkwak188, vox-ai 등)는 법적으로 재사용할 수 없다. Python 쪽 부품은 하나도 3.14 지원을 명시하지 않는다. MPT는 3.11을 권장하고, pycaps는 3.10~3.12에서만 테스트됐다 ([MPT README](https://github.com/harry0703/MoneyPrinterTurbo), [pycaps README](https://github.com/francozanardi/pycaps)). 따라서 WhisperX·pycaps·MoviePy 같은 부품은 `uv`로 만든 별도 3.12 가상환경에서 돌리는 것이 안전하다.

## 유지율은 첫 프레임과 3초 규칙에서 갈리고, 오디오는 덕킹이 차이를 만든다

먼저 근거의 질을 정직하게 짚어야 한다. 컷 빈도, 켄 번스 줌, 진행 바, 줌 펀치, 숫자 강조 중 어느 것에도 **표본과 방법을 공개한 측정 데이터는 없다**. "고성과 Shorts는 2~4초마다 컷", "자막이 유지율 15~25% 상승", "이탈자의 50~60%가 첫 3초에 나간다"는 모두 출처 없는 벤더 블로그 수치다 ([OpusClip](https://www.opus.pro/blog/ideal-youtube-shorts-length-format-retention), [aibrify](https://aibrify.com/blog/youtube-shorts-retention-curve-playbook)). 상대적으로 근거가 있는 것은 훅이다. 한국 블로그가 인용한 8만 6천 개 채널 분석은 2~5초 안에 이탈하는 Shorts가 저품질로 분류되고 15초를 넘겨야 추천이 붙는다고 보고했다. 방법론은 불투명하다. 같은 출처의 A/B 사례에서는 "안녕하세요 여러분~" 인사를 결론 먼저 말하는 훅으로 바꾸자 평균 시청이 **2.8초에서 18.2초**로, 조회수가 **7.4배** 올랐다 ([shooblog](https://shooblog.com/@supershorts/n/2)). 2025년 3월 31일부터는 재생이 시작되기만 해도 조회수로 잡히고, 예전 지표는 "참여 조회수"로 이름이 바뀌었다. 최적화할 대상은 "본 비율 대 넘긴 비율"이다 ([PPC Land](https://ppc.land/youtube-changes-how-shorts-views-are-counted-from-march-31/)).

그래서 연출 규칙은 증거가 강한 순서로 정해야 한다. 첫째, **0번 프레임에 완성된 결론 화면**을 띄운다. 예를 들어 "₩38,000,000 이체 완료" 화면이나 "서울중앙지검" 수신 화면에 한 줄 훅 음성을 붙이고, 검은 화면이나 페이드인으로 시작하지 않는다. 둘째, **마지막 문장이 첫 문장으로 이어지는 루프**를 만든다. 셋째, 정확한 어절 자막을 쓴다. 넷째, **정지 화면은 최대 3초**로 제한하고, 넘으면 새 말풍선, 줌 펀치, 오버레이 같은 "사건"을 넣는다. 이것은 컷 횟수 목표가 아니라 정지 시간의 상한이다. 키워드와 금액(₩, %, "1분")은 정규식으로 찾아 1.08~1.12배 줌과 색 강조를 주고, 패턴 브레이크(화면 흔들림, 플래시)는 영상당 1~2회로 제한한다. 이전 보고서에서 다룬 한국 시청자의 "양산형" 반감도 설계에 반영해야 한다. 커뮤니티는 CapCut "Adam" 음성, 오타 난 자동 자막, 미리캔버스·CapCut 템플릿 티를 저품질의 표지로 꼽는다 ([나무위키](https://namu.wiki/w/YouTube%20Shorts/%EC%A0%80%EC%A7%88%C2%B7%EB%8F%84%EC%9A%A9%C2%B7%EC%96%91%EC%82%B0%ED%98%95%20%EC%BD%98%ED%85%90%EC%B8%A0%20%EB%AC%B8%EC%A0%9C), [루리웹](https://bbs.ruliweb.com/community/board/300143/read/69900201)). 템플릿을 코드로 만들 때 레이아웃·색·전환을 몇 가지 변형으로 돌리는 것이 화질만큼 중요한 이유다. 내레이션은 초당 약 2.7단어가 적당하고, 1.3배 가속은 귀에 들린다는 실무 지침도 있다 ([learnwithhasan](https://learnwithhasan.com/guide/how-to-make-faceless-youtube-shorts-with-claude-code/)).

오디오 라이선스는 Content ID 오탐을 기준으로 골라야 한다. Shorts에서 클레임이 걸리면 그 영상의 수익이 다른 곳으로 넘어갈 수 있기 때문이다.

| 출처 | 수익 채널 사용 | 출처 표기 | Content ID 위험 | 자동화 |
|---|---|---|---|---|
| YouTube 오디오 보관함 | 공식 허용 ([YouTube 고객센터](https://support.google.com/youtube/answer/3376882?hl=en)) | CC 곡만 설명란 표기 | **가장 낮음**: "클레임되지 않는다"고 공식 명시 | API 없음, 수동 다운로드 |
| Pixabay 음악·효과음 | 허용 ([Pixabay 라이선스](https://pixabay.com/service/license-summary/)) | 불필요 | 중간: 일부 곡이 Content ID에 등록됨, 인증서로 이의제기 ([Pixabay FAQ](https://pixabay.com/service/faq/)) | 오디오 API는 미확인 |
| Mixkit | 허용 ([Mixkit](https://mixkit.co/llm-info/)) | 불필요 | 낮음~중간 | API 없음 |
| Freesound CC0 | CC0·CC BY 허용, **CC BY-NC 제외** ([Wikipedia](https://en.wikipedia.org/wiki/Freesound)) | CC0 불필요 | 낮음 | APIv2, 원본 다운로드는 OAuth2 필요 ([Freesound API](https://freesound.org/docs/api/authentication.html)) |
| ZapSplat 무료 | 허용 | **필수** ([ZapSplat](https://www.zapsplat.com/copyright-and-audio-licensing-for-beginners)) | 미확인 | API 없음 |
| Incompetech | CC BY 4.0 | **설명란 텍스트 필수** ([Incompetech](https://incompetech.com/music/royalty-free/youtube-contentid.html)) | 중간 (표기 누락 시) | 없음 |
| Uppbeat 무료 | 허용 | 크레딧 코드 필수 | 낮음 | 월 3곡 제한으로 부적합 ([toolmage](https://www.toolmage.com/en/tool/uppbeat/)) |
| 공유마당 BGM | 상업 가능 118곡 | 공공누리 3유형(출처표시+**변경금지**) ([삼성반도체 뉴스룸](https://news.samsungsemiconductor.com/kr/?p=10564)) | 미확인 | 자르기·덕킹과 충돌 소지, 제외 |

추천 조합은 이렇다. BGM은 YouTube 오디오 보관함에서 긴장·서스펜스·중립 분위기의 반복 가능한 곡 30~50개를 한 번 내려받아 로컬 폴더에 둔다. 효과음은 Freesound CC0(API로 한 번 받아 캐시)와 Mixkit·Pixabay를 쓴다. 곡마다 출처·라이선스를 `manifest.json`에 기록해 두면 클레임에 바로 대응할 수 있다. 믹싱에서는 앞서 본 오픈소스 생성기들이 하지 않는 일을 하면 차이가 난다. short-video-maker와 MPT는 음악을 고정 볼륨으로 깔 뿐 덕킹이 없다 ([short-video-maker README](https://github.com/gyoridavid/short-video-maker), [MPT bgm.py](https://github.com/harry0703/MoneyPrinterTurbo/blob/main/app/services/bgm.py)). 실무 기준은 내레이션 중 음악을 음성보다 15~25dB 낮게 둔다. 사이드체인 덕킹은 어택 10~30ms, 릴리스 200~500ms로 시작하고, 최종 마스터는 −14 LUFS, 트루 피크 −1 dBTP 이하로 맞춘다 ([Vidpros](https://vidpros.com/fix-background-music-too-loud-video/), [OpenClip](https://openclip.app/learn/audio-ducking), [IRPR Sound](https://sounddesign.irpr.agency/guides/how-to-mix-audio-for-youtube/)). ffmpeg 필터 몇 줄로 구현할 수 있다.

```
[0:a]loudnorm=I=-16:TP=-1.5:LRA=7[v];
[1:a]volume=-20dB[m];[m][v]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=350[mduck];
[v][mduck][sfx]amix=inputs=3:normalize=0,loudnorm=I=-14:TP=-1:LRA=9
```

효과음은 시각 사건에 묶는다. 말풍선마다 "톡", 장면 전환마다 "휙", 공개 순간에 "쿵" 한 번을 넣는 식이다. 효과음 피크는 음성보다 6~10dB 낮게 두고, 자막 단어마다 효과음을 넣지는 않는다. 이 기준은 실무자 의견이며 측정 데이터는 없다.

## "GPT 아스트라"는 렌더러가 아니고, 클라우드는 하이라이트 컷에만 쓴다

"GPT 아스트라"는 거의 확실히 **GPT-6 Astra**다. OpenAI가 2026년 9월 3일(한국 시간 4일) 공개한 GPT-6 세대 최상위 모델이고, 핵심 기능은 "컴퓨터 사용과 더 긴 작업 지속"이다 ([MindStudio](https://www.mindstudio.ai/blog/gpt-6-astra-video-editing-agent), [나무위키 GPT-6](https://namu.wiki/w/GPT-6)). 텍스트와 이미지를 입력받지만 공식 모델 페이지에서 오디오·비디오는 "미지원"이며, **완성된 영상 클립을 직접 내놓지 못한다** ([Elser.ai](https://www.elser.ai/blog/can-gpt-6-astra-generate-images-video-audio)). 구글의 "Project Astra"와는 다른 제품이다. 한국에 "GPT 아스트라"라는 이름의 Shorts 서비스도 없었다. 영상과의 관계는 "감독"이다. 한 크리에이터가 프롬프트 하나로 약 50분 만에 YouTube 영상을 완성한 사례가 있는데, Astra가 HeyGen 아바타, ElevenLabs 음성 복제, HyperFrames 편집기를 대신 조작한 것이고 비용은 API 표준 요금으로 **약 60달러**였다 ([MindStudio](https://www.mindstudio.ai/blog/gpt-6-astra-video-editing-agent)). Runway는 ChatGPT용 무료 플러그인을 내놓았다. Astra가 기획하고 Runway가 Seedance 2.5, Kling 3.0, Veo 3.1, Gen-4.5로 영상을 만드는 구조이며, 생성 비용은 Runway 크레딧으로 따로 나간다 ([Runway](https://runway.com/mcp/gpt-astra)). API 요금은 출력 100만 토큰당 50달러로 알려져 있는데, 2차 출처라 공식 확인은 못 했다 ([statisticsplaybook](https://statisticsplaybook.com/gpt-6-astra/)). 결론적으로 이 프로젝트에서 Astra는 영상당 60달러짜리 만능 제작자가 아니다. 쓴다면 비싼 대본 작가나 점검자이고, 매일 30편에 쓰기에는 비용이 맞지 않는다. 덧붙여 OpenAI의 영상 모델 **Sora 2는 앱이 2026년 4월 26일, API가 9월 24일 종료**되어 선택지에서 빠졌다 ([OpenAI 지원 중단 목록](https://developers.openai.com/api/docs/deprecations), [Unifically](https://unifically.com/blogs/sora-api)).

실제로 영상을 만드는 클라우드 API는 다음과 같다. 9:16 세로와 무인 API 호출이 모두 된다.

| 서비스 | 초당 가격 | 특징 |
|---|---|---|
| Veo 3.1 Lite | $0.05 (720p), $0.08 (1080p) | 4·6·8초, 9:16, 오디오 포함, SynthID 비가시 워터마크 ([Gemini API 가격](https://ai.google.dev/gemini-api/docs/pricing), [Veo 문서](https://ai.google.dev/gemini-api/docs/veo)) |
| Veo 3.1 Fast | $0.10 (720p), $0.12 (1080p) | 동일 |
| Veo 3.1 Standard | $0.40 (720p·1080p) | 최고 품질, 한국어 대사는 약함 ([wikidocs](https://wikidocs.net/337747)) |
| Kling 3.0 공식 API | $0.084 (720p 무음) ~ $0.140 (1080p 오디오) | **한국어 립싱크 지원** 명시, 선불 팩, 웹 구독에는 API 미포함 ([CostBench](https://costbench.com/software/ai-media-apis/kling-api/), [Atlas Cloud](https://www.atlascloud.ai/blog/ai-video-models-native-audio-compared)) |
| Seedance 2.5 (BytePlus) | 약 $0.10 (480p) / $0.23 (720p) / $0.57 (1080p) | 토큰 과금 ([CometAPI](https://www.cometapi.com/seedance-2-5-api-pricing/)) |
| Runway API | 크레딧 $0.01, veo3.1 10~40크레딧/초 | 여러 모델 통합 ([Runway API 가격](https://docs.dev.runwayml.com/guides/pricing/)) |

정지 이미지는 장당 0.02~0.15달러 수준이다. Gemini 2.5 Flash Image가 **$0.039**(배치 $0.0195)이고, Gemini 3.1 Flash Image는 1K 기준 $0.067이다 ([Gemini API 가격](https://ai.google.dev/gemini-api/docs/pricing)). gpt-image-2 세로 중품질은 약 $0.041로 집계되며 ([converge.ai](https://enter.converge.ai/page/en-US/news/gpt-image-2-pricing-cost-breakdown)), 2026년 9월 8일 나온 GPT Image 2.5 Sunburst는 큰 한글 간판·포스터를 정확히 그렸다 ([Carat](https://carat.im/en/curated/gpt-image-2-5-guide)). 주의할 점은 OpenAI의 잦은 교체 주기다. `gpt-image-1-mini`와 `gpt-image-1.5`는 **2026년 12월 1일 종료**된다 ([OpenAI 지원 중단 목록](https://developers.openai.com/api/docs/deprecations)). Midjourney는 여전히 공식 API가 없다 ([pricepertoken](https://pricepertoken.com/midjourney-api-alternatives)).

월 30편, 편당 30초로 계산하면 조합별 비용 차이가 선명하다. 아래 수치는 위 단가로 직접 계산한 값이며 재시도 비용은 빠져 있다. 실제 예산은 1.5~2배로 잡아야 한다.

| 조합 | 월 원가(재시도 제외) | 판단 |
|---|---|---|
| 모든 장면을 AI 영상으로 (900초/월) | Veo Lite $45~72, Kling $76~126, Veo Standard $360 | 비싸고, 장면이 대본과 어긋날 위험이 크다 |
| AI 정지 이미지 8장/편 + 로컬 모션 | Gemini 2.5 Flash Image 약 $9.4 (배치 $4.7), gpt-image-2 중품질 약 $9.8 | **가성비 최고** |
| 정지 이미지 6장 + 8초 하이라이트 컷 1개/편 | Veo Lite·Fast·Kling으로 약 $19~36 | **품질 상승 대비 최적** |
| 전부 로컬 (Z-Image + 코드 UI) | 전기료만 | 추천 1안의 기본값 |

한국어 음성은 클라우드 영상에 맡기지 않는다. Veo는 한국어 대사의 발음과 자연스러움이 불완전하고, 화자가 여럿이면 립싱크 성공률이 40% 미만이라는 한국어 가이드가 있다 ([wikidocs](https://wikidocs.net/337747)). 영상은 무음이나 환경음으로 받고, 내레이션은 Azure TTS로 로컬에서 입힌다. 얼굴이 나오는 대사 장면이 꼭 필요할 때만 Kling 3.0을 쓴다. 정책 측면에서는 Veo·Kling으로 만든 사실적인 사기 전화 재연이 "실제로 일어나지 않은 사실적 장면"에 해당하므로 업로드할 때 합성 콘텐츠 표시를 켜야 한다. 일러스트나 코드 UI 위주라면 설명란 표기로 충분하다 ([YouTube 고객센터](https://support.google.com/youtube/answer/14328491)). 실존 기관 로고나 실존 인물 얼굴은 클라우드 모델의 정책과 법적 위험 때문에 프롬프트에 넣지 않는다. 사기 재연 프롬프트가 안전 필터에 얼마나 걸리는지는 알려진 데이터가 없으니 시범 운영에서 재야 한다.

## 추천 스택 1안과 대안 1안, 그리고 도입 순서

두 안의 차이는 "엔진을 바꾸느냐"다. 1안은 Python을 대본·TTS·이미지·오디오를 지휘하는 역할로 남기고, 화면 렌더만 Remotion에 맡긴다. Python은 장면 목록과 단어 타이밍을 `props.json`으로 써서 넘긴다. 대안은 엔진을 바꾸지 않고 지금 구조를 최대한 끌어올린다.

| 구성 요소 | 추천 1안: Remotion 하이브리드 | 대안 1안: Python 유지형 |
|---|---|---|
| 렌더 엔진 | Remotion 4.x (Node 24), `props.json` + `--hardware-acceleration if-possible` | ffmpeg + Pillow 유지, 필요 시 MoviePy 2.x(3.12 가상환경) |
| 한글 폰트 | Pretendard / Noto Sans KR woff2를 프로젝트에 포함해 직접 로드 | 같은 폰트를 ASS `fontsdir=`로 지정 |
| TTS·타이밍 | Azure Speech F0 + WordBoundary → `createTikTokStyleCaptions()` | Azure WordBoundary → ASS `\k` + 어절별 `\t` 팝 이벤트, 또는 pycaps |
| 폴백 타이밍 | WhisperX 정렬 (Python 3.12 가상환경) | 동일 |
| 장면 소재 | 코드 컴포넌트: 수신 화면·문자·메신저·송금 화면, 키네틱 타이포, SVG 아이콘 그리기, 선별 Lottie | Playwright로 HTML 템플릿(Pixelle 방식)을 프레임 또는 짧은 클립으로 캡처 |
| 배경 이미지 | Z-Image Turbo GGUF via ComfyUI API, 또는 Gemini 2.5 Flash Image | 동일 |
| 모션 | CSS `transform`/`spring()` 켄 번스, 키워드 줌 펀치, 장면별 등장 | ffmpeg `zoompan`(원본 4배 업스케일 후) + `xfade` 전환 |
| 선택적 AI 영상 | 편당 Veo 3.1 Lite/Fast 8초 1개 | 동일 |
| 오디오 | 오디오 보관함 BGM + Freesound CC0·Mixkit 효과음, `sidechaincompress` + `loudnorm` −14 LUFS | 동일 |
| 월 비용 | $0 (로컬) ~ 약 $36 (하이라이트 컷 포함) | 동일 |
| 장점 | 화면 표현력 최고, 폰 UI·자막·모션이 한 코드베이스 | 새 언어·도구 학습 최소, 이번 주에 시작 가능 |
| 위험 | React/TypeScript 학습, 렌더 시간 미측정, 4인 이상 시 유료 | 표현력 상한이 낮음, 효과마다 수작업 코딩 |

두 안이 같이 갖는 보험이 있다. Remotion 라이선스가 문제가 되면 HyperFrames(Apache-2.0)로 옮긴다. 컴포넌트가 HTML/CSS 기반이라 이전 비용이 크지 않다.

도입은 위험이 낮고 효과가 큰 것부터 한다. 1단계는 엔진을 바꾸지 않아도 되므로 대안 1안과 1안의 공통 출발점이다.

| 단계 | 기간 | 할 일 | 완료 기준 |
|---|---|---|---|
| 1. 비용 0원 즉시 개선 | 1주차 | TTS를 Azure F0로 바꾸고 WordBoundary로 어절 타이밍 받기(숫자 많은 문장으로 먼저 검증) → ASS `\k` 카라오케 자막. 장면마다 `zoompan` 줌과 `xfade` 전환. 오디오 보관함 BGM + 덕킹 + −14 LUFS. 0번 프레임 결론 화면. 최종 인코딩 1회 + BT.709 | 영상이 더는 "정지 슬라이드"가 아님 |
| 2. Remotion 기반 세우기 | 2~3주차 | template-tiktok에서 시작해 한글 폰트를 직접 로드. Python이 `props.json`을 쓰도록 스키마 정의. `npx remotion benchmark`로 이 PC의 렌더 시간 측정. NVENC 확인 | 기존 대본 하나가 Remotion으로 무인 렌더됨 |
| 3. 폰 화면 컴포넌트 | 3~4주차 | 수신 화면, 통화 타이머, 문자 스레드(타이핑 표시·말풍선 스프링), 송금 완료 화면을 일반형 한국 스킨으로 제작(Tokovo·iart-ai 구조 참고). 레이아웃·색 변형 3종 이상 | 사기 재연 장면이 코드 UI로만 구성됨 |
| 4. 배경 이미지 | 5~6주차 | ComfyUI + Z-Image Turbo Q5_K_S를 API로 연결하거나 Gemini Flash Image 사용. 스타일 접두 프롬프트 고정. 한글은 이미지에 넣지 않음 | 장면당 배경 자동 생성 |
| 5. 선택: 하이라이트 컷 | 7주차 이후 | 편당 Veo 3.1 Lite/Fast 8초 1개(무음). 사실적 장면이면 합성 콘텐츠 표시 | 월 원가 $40 이하 유지 |
| 6. 데이터로 조정 | 상시 | YouTube Studio 유지율 곡선으로 자막 스타일·훅·BGM 유무를 A/B. 이전 보고서의 하루 10~20분 검수 루프 유지 | 주간 리뷰에서 승자 스타일 고정 |

## 결론

이번 조사로 질문의 초점이 바뀌었다. "어떤 AI가 더 예쁜 그림을 만드느냐"가 아니라 "화면이 시간 축 위에서 어떻게 움직이느냐"가 품질을 결정한다. 사기·보이스피싱 Shorts에서 가장 설득력 있는 장면은 피해자가 실제로 본 휴대폰 화면이다. 그 화면은 AI가 아니라 수백 줄의 코드로 그릴 때 가장 정확하고 가장 싸다. 비싼 클라우드 영상은 영상당 8초 하이라이트 컷 하나로 충분하다. 8GB GPU의 진짜 쓸모는 영상 생성이 아니라 배경 이미지 생성이다. 또 하나 눈여겨볼 점은 위험이 기술보다 라이선스에서 먼저 터진다는 사실이다. FLUX.1 dev의 수익 활동 제한, HunyuanVideo·FramePack의 한국 제외 조항, OpenMontage·MoneyPrinterV2의 AGPL, edge-tts의 비공식 엔드포인트는 모두 "무료 오픈소스"라는 이름 뒤에 숨어 있다.

마지막 함의는 역설적이다. 품질을 올리려고 만든 Remotion 템플릿이 매일 똑같이 반복되면, 그 자체가 YouTube가 찾는 "템플릿 지문"이 된다. 그래서 컴포넌트 라이브러리를 만들 때 처음부터 레이아웃·색·전환·BGM을 여러 변형으로 돌리게 설계해야 한다. 아직 아무도 측정하지 않은 두 가지, 즉 이 PC에서의 렌더 시간과 Azure 한국어 단어 경계의 동작은 첫 주에 직접 재는 것이 다음 결정의 출발점이다.
