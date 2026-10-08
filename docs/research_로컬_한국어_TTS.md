# Local Korean TTS for a monetized YouTube Shorts channel (research as of 2026-10-09)

Use case: about 300 Korean characters per video (roughly 50-70 s of narration), one video per day.
Machine: Windows 11, RTX 3060 Ti 8 GB (driver 595.79, checked with `nvidia-smi`), Ryzen 5 5600X, 48 GB RAM.
The only interpreter installed right now is Python 3.14 (`py -0p`). There is no uv and no conda.

How this was checked: I pulled license, stars, push dates and download counts from the GitHub API, the Hugging Face API and the PyPI JSON API on 2026-10-09. I also read the model cards, READMEs and LICENSE files directly.
HF "downloads" are the API's rolling 30-day count.
**No model was installed or run on this machine.** Every speed and VRAM figure below comes from vendor or community sources, or is my estimate, and is labelled that way.

---

## TL;DR: the top 3 to test

| # | Model | Why | Main caveat |
|---|---|---|---|
| 1 | **Supertonic 3** (Supertone, a Korean company) | Ships 10 preset voices (no cloning needed). CPU-only ONNX at 99M params. Best published Korean CER among small models (3.26). Plain `pip install supertonic` that works on Python 3.9-3.14. | Weights are **OpenRAIL-M**: commercial use is allowed, but use restriction (e) requires you to **disclose the content as machine-generated**. The repo was **archived in 2026-08/09** and will get no more fixes. No word timestamps. |
| 2 | **Qwen3-TTS 12Hz 1.7B-CustomVoice, speaker `Sohee`** | Apache-2.0 for both code and weights. Ships a built-in **Korean** female voice. You can steer tone with a natural-language `instruct`. Qwen's own Korean WER (1.75) is on par with MiniMax and ElevenLabs. Fits in 8 GB. | Open bug: the **last word of Korean/Japanese output gets clipped** (issue #55). Qwen has not confirmed the voice rights for Sohee (issue #353 is unanswered). Stock inference on Windows is slow (RTF about 0.23x real time on a 4060). `faster-qwen3-tts` fixes the speed. |
| 3 | **VoxCPM2** (OpenBMB) | Apache-2.0 for both code and weights. Supports Korean. **Voice Design** builds a new synthetic voice from a text description, so no real person is involved. Outputs 48 kHz. | About **8 GB VRAM** (vendor figure), which is at the limit of a 3060 Ti. Heavy dependency stack (torchcodec, funasr, gradio). No built-in preset voice: you design one once, then reuse that clip. |

Fallback with no GPU and a fully permissive license: **MeloTTS-Korean** (MIT, built-in `KR` voice, real time on CPU). It is older VITS-era quality and painful to install on Windows (mecab-ko; the docs suggest Docker).

For word-level captions: none of the top 3 outputs word timestamps. Use **Qwen3-ForcedAligner-0.6B** (Apache-2.0, Korean listed). It aligns the *known script* to the audio, which beats ASR because the text is already exact. Fall back to WhisperX or faster-whisper.

---

## Ranked shortlist (all candidates)

Legend: OK = passes the requirement, WARN = passes with conditions, NO = fails (not usable for monetized YouTube, or no Korean).

| Rank | Model | Repo / HF | GH stars · HF dl/30d | Last update | Code license | Weights license | Korean evidence | Built-in Korean voice? | 3060 Ti 8 GB / CPU fit | Install notes | Timestamps |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Supertonic 3** | github.com/supertone-oss-archive/supertonic · hf.co/Supertone/supertonic-3 (mirror: hf.co/supertone-oss-archive/supertonic-3) | 13.8k · 31.6k (+2.7k archive) | Weights 2026-05-18. Repo **archived** (notice 2026-07-23, last push 2026-09-09) | MIT | **OpenRAIL-M** (WARN: restriction (e) requires disclosing machine-generated content; also bans impersonation and deepfakes) | `ko` officially supported. Korean CER **3.26** on MiniMax MLS-test (vendor table: OmniVoice 3.22, Qwen3-TTS 4.07, VoxCPM2 4.70, Supertonic 2 3.65). Korean demo clip on the model card | **Yes**: 10 presets M1-M5 and F1-F5, shared across languages. A zero-shot "Voice Builder" was a paid service and closed 2026-08-31 | **CPU** ONNX Runtime, 99M params. Vendor: 1,263 chars/s on an M4 Pro CPU. Expect a few seconds per 300 chars on a 5600X (my estimate) | `pip install supertonic` (1.3.1, Python >=3.9; onnxruntime has cp314 wheels, so 3.14 works). Downloads pinned SHA from `Supertone/supertonic-3` | Utterance or chunk duration only (`synthesize` returns total duration; Korean chunks are 120 chars max). No per-word timing |
| 2 | **Qwen3-TTS 12Hz 1.7B / 0.6B CustomVoice** | github.com/QwenLM/Qwen3-TTS · hf.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice | 13.7k · 2.32M (1.7B CV), 1.05M (0.6B CV) | Weights 2026-01-29, code 2026-03-17 | Apache-2.0 | Apache-2.0 (OK) | Korean is one of 10 languages. Multilingual test-set WER for Korean: 12Hz-0.6B 1.741, 12Hz-1.7B 1.755, MiniMax 1.747, ElevenLabs 1.865 (Qwen README). Supertone's table gives 4.07 CER. **Bug #55: final word clipped in ko/ja (open since 2026-01, unresolved)** | **Yes**: `Sohee` ("Warm Korean female voice with rich emotion"). Only one Korean-native preset. Other presets can speak Korean but are accented | GPU: about 4.2 GB at fp16 for 1.7B (3rd-party estimate). 8 GB is fine; 0.6B is the fallback. Stock RTF on a Windows RTX 4060: **0.23x real time** (1.7B), so about 4-5 min per 60 s of audio. With `faster-qwen3-tts` CUDA graphs: **1.83x real time** (1.7B), 2.26x (0.6B). CPU is impractically slow | `pip install qwen-tts` (pins transformers==4.57.3). Upstream suggests a fresh Python 3.12 env. flash-attn is optional (skip it on Windows) | None. Use a forced aligner |
| 3 | **VoxCPM2** | github.com/OpenBMB/VoxCPM · hf.co/openbmb/VoxCPM2 | 38.4k · 568k | Weights 2026-08-18, code 2026-10-08 | Apache-2.0 | Apache-2.0 (OK; card says "free for commercial use") | Korean is one of 30 languages. Korean CER 4.70 in Supertone's table. Korean-language blog coverage (wikidocs) | **No preset**. **Voice Design** from a text description, no reference audio. Save one good output and reuse it as the reference for a consistent narrator (you are cloning your own synthetic voice) | Vendor: **~8 GB VRAM**, RTF ~0.30 on an RTX 4090. 3060 Ti will be at the limit (close other GPU apps; OOM risk). Speed on a 3060 Ti is unverified. 2B params | `pip install voxcpm` (2.0.3, Python >=3.10, torch >=2.5, CUDA >=12). Dependencies include torchcodec (may need FFmpeg shared DLLs on Windows; not verified) and funasr. Windows installer PRs are still open (#349, #403) | None |
| 4 | MeloTTS-Korean | github.com/myshell-ai/MeloTTS · hf.co/myshell-ai/MeloTTS-Korean | 7.7k · 89k | 2024-12 (dormant) | MIT | MIT (OK) | Official KR model and sample WAV on the card. No published Korean MOS or CER found | **Yes**: one `KR` speaker | **CPU real time** (vendor). Tiny VITS model | Tested on Ubuntu with Python 3.9. **Windows: the README recommends Docker.** mecab-ko on Windows needs the VC++ runtime and has dictionary-path quirks. PyPI `melotts` is stale (0.1.1, 2024). Install from git | Not exposed (VITS durations exist internally) |
| 5 | Chatterbox Multilingual V3 (Resemble AI) | github.com/resemble-ai/chatterbox · hf.co/ResembleAI/chatterbox | 26.8k · 1.64M | 2026-07-21 | MIT | MIT (OK). Every output carries an imperceptible **PerTh watermark** | `ko` in the 23 supported languages. No Korean-specific metrics or Korean single-language pack | **No Korean voice**. The default conditioning is an English voice, and the README warns that output inherits the reference clip's accent. Needs a ~10 s Korean reference (could be a VoxCPM2 or Qwen VoiceDesign synthetic clip) | Third-party: 6 GB+ GPU recommended. 0.5B params. CPU works but is slow | `pip install chatterbox-tts` pins torch==2.6.0 and transformers==5.2.0. Tested on Python 3.11 | None |
| 6 | CosyVoice 3 (Fun-CosyVoice3-0.5B) / CosyVoice-300M-SFT | github.com/FunAudioLLM/CosyVoice (now QwenAudio/CosyVoice) · hf.co/FunAudioLLM/Fun-CosyVoice3-0.5B-2512 | 23.9k · 160k | 2026-05 | Apache-2.0 | Apache-2.0 (OK) | Korean is one of 9 languages (v2 and v3). No Korean metric on the card | v3 and v2: **no**, zero-shot only. **v1 CosyVoice-300M-SFT has a `韩语女` (Korean female) SFT speaker** (confirmed via Xinference docs). That model is older and lower quality | 0.5B fits 8 GB | conda + Python 3.10. Requirements pull WeTextProcessing/pynini (hard on Windows). The optional `ttsfrd` wheel is Linux cp310 only. **Hardest Windows install of the group** | None |
| 7 | MOSS-TTS v1.5 / MOSS-TTS-Nano-100M | github.com/OpenMOSS/MOSS-TTS · hf.co/OpenMOSS-Team/MOSS-TTS-v1.5 | 4.2k · 129k / 105k | 2026-05 / 2026-04 | Apache-2.0 | Apache-2.0 on HF metadata. **The Nano card says "treat as not yet licensed" until a root LICENSE is published** (conflicting, so WARN) | `ko` listed. Nano runs on CPU | "Direct TTS (no reference)" mode exists, but there is no documented named Korean preset. Not verified | Nano: CPU, 0.1B. v1.5 size not verified | conda + Python 3.12 + transformers 5.0.0, editable install | v1.5 has token-level duration control, not timestamps |
| 8 | GPT-SoVITS v2/v2Pro/v4 | github.com/RVC-Boss/GPT-SoVITS · hf.co/lj1995/GPT-SoVITS | 62.5k | 2026-10-08 | MIT | MIT (OK) | Korean supported since v2 (zh/en/ja/ko/yue). Many Korean community users | **No**. Needs a 3-10 s reference clip (zero-shot) or fine-tuning on a voice you have rights to | Fits 8 GB, about real time on mid-range GPUs (community reports) | Windows one-click integrated package exists. Big WebUI, not a clean pip library | None |
| 9 | OpenVoice v2 | github.com/myshell-ai/OpenVoice · hf.co/myshell-ai/OpenVoiceV2 | 37.8k | 2025-04 | MIT | MIT (OK) | Native Korean comes from the **MeloTTS KR** base speaker plus a tone-color converter | Base = MeloTTS KR voice. The converter needs a reference clip | Light | Same MeloTTS/mecab pain on Windows | None |
| 10 | Kani-TTS-400m-ko | hf.co/nineninesix/kani-tts-400m-ko | 459 · 41 | 2026-02 | (repo NOASSERTION) | **LFM 1.0** (Liquid AI; the card badge also says Apache-2.0, a contradiction. LFM 1.0 has a revenue threshold. WARN) | Korean-only fine-tune | Single built-in voice. **Training data provenance not stated** | 400M fits easily | `pip install kani-tts` + transformers==4.57.1 | None |
| 11 | Higgs TTS 3 (4B) | hf.co/bosonai/higgs-tts-3-4b | 8.4k (higgs-audio) · 102k | 2026-09-04 | Apache-2.0 (old repo) | **Research/Non-Commercial license + "Creator Use Grant"**: monetized creator content is allowed **only with a visible acknowledgment** ("This audio was created with Boson AI's Higgs Audio", in the audio or prominently in the description) | Korean in the language list | Reference clip (zero-shot) | 4B. Served via SGLang-Omni or vLLM-Omni (Docker/Linux). **Not a fit for an 8 GB Windows box** | Docker | None |
| NO | OmniVoice (k2-fsa) | hf.co/k2-fsa/OmniVoice | 14.4k · 1.45M | 2026-07 | Apache-2.0 | **CC-BY-NC** (trained on Emilia) | Korean CER 3.22 (best in Supertone's table) | Voice design | — | `pip install omnivoice` | — |
| NO | XTTS-v2 (Coqui / idiap fork) | hf.co/coqui/XTTS-v2 | 46.1k / 2.3k · 6.67M | Weights 2023-12 | MPL-2.0 | **Coqui Public Model License: non-commercial.** Coqui shut down, so a commercial license cannot be bought | `ko` supported | Reference clip | — | — | — |
| NO | F5-TTS | hf.co/SWivid/F5-TTS | 15.4k · 817k | — | MIT | **CC-BY-NC-4.0** | No official Korean | Reference | — | — | — |
| NO | Fish Audio S2 Pro / OpenAudio S1-mini | hf.co/fishaudio/s2-pro, s1-mini | 33.0k | 2026-03 / 2026-02 | (custom) | **Fish Audio Research License** (commercial use needs a separate license) / **CC-BY-NC-SA-4.0** | `ko` listed | Reference | — | — | — |
| NO | Spark-TTS 0.5B | hf.co/SparkAudio/Spark-TTS-0.5B | 11.0k | 2025-04 | Apache-2.0 | **CC-BY-NC-SA-4.0** | en/zh only | — | — | — | — |
| NO | IndexTTS-2 (bilibili) | github.com/index-tts/index-tts | 24.4k | 2026-09 | bilibili Model Use License (commercial OK below 100M MAU / RMB 1B revenue) | same | **en/zh only** (no Korean) | — | — | — | — |
| NO | Zonos v0.1 | hf.co/Zyphra/Zonos-v0.1-transformer | 7.2k | 2025-03 | Apache-2.0 | Apache-2.0 | Korean not officially supported (eSpeak phonemizer only). **Linux-only** per README | Reference or speaker embedding | 6 GB+ | — | — |
| NO | Kokoro-82M | hf.co/hexgrad/Kokoro-82M | 9.2k · 11.1M | 2025-04 | Apache-2.0 | Apache-2.0 | **No Korean** | — | — | Python <3.13 | — |
| NO | Piper `ko_KR-kss-medium` | hf.co/rhasspy/piper-voices | rhasspy/piper archived; OHF-Voice/piper1-gpl 5.8k | 2026-10 | **GPL-3.0** (piper1-gpl) | Voice trained on **KSS dataset = CC-BY-NC-SA-4.0** (from its MODEL_CARD) | Yes (1 voice) | Yes, but NC | CPU | — | — |
| NO | facebook/mms-tts-kor | hf.co/facebook/mms-tts-kor | — | 2023 | — | **CC-BY-NC-4.0** | Yes | Yes | CPU | — | — |
| NO | Others | ChatTTS (AGPL code, NC weights, no ko); VibeVoice (no ko); Higgs Audio v2 (Llama-3-derived, 100k annual-active-user cap, no official ko); kova-tts-1 (English, non-commercial); HyperCLOVAX-SEED-Omni-8B (8B omni LLM, custom license, too big); skt/A.X-K2-ALM ("h-research" license) | | | | | | | | | |

Korean-company check: I searched the HF orgs of Kakao, Naver, LG AI, SKT, Upstage, 42dot, Maum, Neosapience, NCSoft and Krafton. Only **Supertone** (Supertonic) publishes an open Korean TTS. Naver and SKT publish omni or audio LLMs under restrictive licenses.

---

## License notes that matter for monetized YouTube

- **Supertonic 3 (OpenRAIL-M, BigScience text, 2022-08-18):**
  - Section 6: Supertone claims no rights in your output. Commercial use is not restricted.
  - Attachment A(e) forbids publishing generated content "without expressly and intelligibly disclaiming that the information and/or content is machine generated." To comply, turn on YouTube's "altered or synthetic content" toggle **and** add a line in the description such as "내레이션: AI 음성 합성 (Supertonic)".
  - A(g) bans impersonation without consent.
  - Section 7 lets the licensor "restrict (remotely or otherwise)" usage and asks you to use the latest version. This is moot in practice because the project is archived and runs offline.
  - No country exclusions. No attribution is required for outputs.
- **Qwen3-TTS (Apache-2.0):** no restrictions on outputs and no attribution required for audio. **Open question:** issue #353 (2026-08-02) asks whether the Sohee preset may be used in monetized YouTube videos and whether the voice-talent rights are cleared. Qwen has not answered. Apache-2.0 covers the weights, but nothing explicitly addresses rights to the voice timbre.
- **VoxCPM2 (Apache-2.0):** the cleanest license. A designed voice is synthetic, so no voice-consent issue arises.
- **MeloTTS (MIT):** clean license, but the Korean training data source is **not disclosed**. I could not verify whether it was KSS, which is CC-BY-NC-SA. MIT on the weights is what MyShell grants.
- **Chatterbox (MIT):** clean license. Every output carries the inaudible PerTh watermark (it does not affect monetization). It needs a reference voice that you own.
- **Higgs TTS 3:** allowed only under the Creator Use Grant with a prominent acknowledgment.
- **Excluded for non-commercial weights:** OmniVoice, F5-TTS, Spark-TTS, Fish S1-mini and S2, XTTS-v2 (CPML), Piper-KSS, MMS-TTS.
- None of the passing licenses exclude Korea.
- Separately, YouTube's own policy requires disclosing realistic synthetic content, whatever the model license says.

---

## Install and minimal synthesis for the top 3 (Windows PowerShell)

Recommended: one isolated venv per engine, using `uv` to get Python 3.12. You currently have only 3.14.

```powershell
# one-time: install uv
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### 1) Supertonic 3 (CPU)

```powershell
mkdir C:\tts\supertonic; cd C:\tts\supertonic
uv venv --python 3.12        # 3.14 should also work (onnxruntime 1.30 has cp314 wheels)
.\.venv\Scripts\Activate.ps1
uv pip install "supertonic==1.3.1"
```

```python
# synth_supertonic.py
from supertonic import TTS

tts = TTS(model="supertonic-3", auto_download=True)  # pulls pinned SHA of Supertone/supertonic-3 (~99M params, ONNX)
style = tts.get_voice_style(voice_name="F1")          # presets: F1..F5, M1..M5
text = "오늘은 전 세계에서 화제가 된 쇼츠 세 편을 소개합니다."
wav, dur = tts.synthesize(text, voice_style=style, lang="ko", total_steps=8, speed=1.05)
tts.save_audio(wav, "supertonic_ko.wav")
print(f"{dur[0]:.2f}s")
```

- If the original `Supertone/*` HF repo disappears, set the env var `SUPERTONIC_MODEL_REPO=supertone-oss-archive/supertonic-3`. Or follow the archive README: `hf download supertone-oss-archive/supertonic-3 --revision aafc6e32416a594460b32413efc49d7fe4ce6d46 --local-dir assets`, then `TTS(model="supertonic-3", model_dir="assets", auto_download=False)`.
- Try all 10 presets on Korean before choosing. They are cross-lingual and not Korean-specific.
- Increasing `total_steps` to 10-16 raises quality.
- Known Korean issue: number readings such as "1권" (#178, closed). Normalize numbers in your script (write "한 권").

### 2) Qwen3-TTS 1.7B CustomVoice, `Sohee` (GPU)

```powershell
mkdir C:\tts\qwen3tts; cd C:\tts\qwen3tts
uv venv --python 3.12
.\.venv\Scripts\Activate.ps1
uv pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128
uv pip install qwen-tts            # pins transformers==4.57.3, accelerate==1.12.0
# do NOT install flash-attn on Windows; use SDPA
```

```python
# synth_qwen3.py
import torch, soundfile as sf
from qwen_tts import Qwen3TTSModel

model = Qwen3TTSModel.from_pretrained(
    "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",   # fallback: Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice
    device_map="cuda:0",
    dtype=torch.bfloat16,                    # Ampere (3060 Ti) supports bf16
    attn_implementation="sdpa",              # if this errors, just omit the argument
)
wavs, sr = model.generate_custom_voice(
    text="오늘은 전 세계에서 화제가 된 쇼츠 세 편을 소개합니다.",
    language="Korean",
    speaker="Sohee",
    instruct="차분하고 또렷한 내레이션 톤으로",   # optional
)
sf.write("qwen3_ko.wav", wavs[0], sr)
```

- **Speed:** for daily use, use `faster-qwen3-tts` (MIT, 1.4k stars) in its *own* venv. It ships `qwen-tts-hf`, so do not install it next to `qwen-tts`. Install with `pip install faster-qwen3-tts`, then run `faster-qwen3-tts custom --model Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice --list-speakers`. The project measured 1.83x real time for 1.7B on a Windows RTX 4060, against 0.23x stock.
- **Clipped-last-word workaround (bug #55):** end every chunk with sentence punctuation and verify the tail. Common tricks are appending a short filler such as "…" or a trailing sentence you trim later, and checking alignment coverage of the final word. These workarounds come from community practice and I did not verify them. Synthesizing sentence by sentence also limits the damage.
- If you see a SoX warning or error, install SoX and put it on PATH (the `sox` Python package is a dependency). I did not verify whether it is required on Windows.

### 3) VoxCPM2 with Voice Design (GPU, about 8 GB)

```powershell
mkdir C:\tts\voxcpm; cd C:\tts\voxcpm
uv venv --python 3.12
.\.venv\Scripts\Activate.ps1
uv pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128
uv pip install voxcpm
```

```python
# synth_voxcpm.py
import soundfile as sf
from voxcpm import VoxCPM

model = VoxCPM.from_pretrained("openbmb/VoxCPM2", load_denoiser=False)
# Step 1 (once): design a synthetic narrator; description goes in parentheses before the text
wav = model.generate(
    text="(A calm, trustworthy Korean male narrator in his 30s, clear diction)오늘은 전 세계에서 화제가 된 쇼츠 세 편을 소개합니다.",
    cfg_value=2.0, inference_timesteps=10,
)
sf.write("voxcpm_ko_design.wav", wav, model.tts_model.sample_rate)

# Step 2 (daily): reuse the chosen designed clip for a consistent voice
# wav = model.generate(text="새 대본...", prompt_wav_path="narrator.wav",
#                      prompt_text="<exact transcript of narrator.wav>", reference_wav_path="narrator.wav")
```

- Voice Design results vary from run to run. The card recommends generating 1-3 times and picking the best.
- With only 8 GB, close the browser, OBS and other GPU applications. If you hit OOM, this model drops out and Chatterbox V3 with a designed reference clip is the fallback.

---

## Word-level caption timing

None of the shortlisted models emits word timestamps. Since the script is known in advance, use forced alignment instead of ASR:

```powershell
mkdir C:\tts\align; cd C:\tts\align
uv venv --python 3.12; .\.venv\Scripts\Activate.ps1
uv pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128
uv pip install qwen-asr      # separate venv: pins transformers==4.57.6 (conflicts with qwen-tts' 4.57.3)
```

```python
import torch
from qwen_asr import Qwen3ForcedAligner
al = Qwen3ForcedAligner.from_pretrained("Qwen/Qwen3-ForcedAligner-0.6B", dtype=torch.bfloat16, device_map="cuda:0")
res = al.align(audio="qwen3_ko.wav", text=open("script.txt", encoding="utf-8").read(), language="Korean")
for w in res[0]:
    print(w.text, w.start_time, w.end_time)
```

- Qwen3-ForcedAligner-0.6B is Apache-2.0. Korean is in its 11-language list, and it handles up to 5 minutes of audio.
- I did not verify whether the Korean unit it returns is the eojeol (space-separated word) or the syllable. Test that first.
- Fallbacks: WhisperX (BSD-2) with its Korean wav2vec2 alignment model, or faster-whisper (MIT) with `word_timestamps=True`. The ASR text then has to be mapped back onto your script.
- Supertonic-specific shortcut: synthesize sentence by sentence. `synthesize` returns each chunk's exact duration, which gives exact sentence-level caption boundaries for free.

---

## Not verified / open items

- No local benchmark. Run all three on the actual 3060 Ti and 5600X and listen. Korean prosody and naturalness have **no published Korean MOS** for any of these models. The only numbers are WER and CER (intelligibility).
- Supertonic 3's 5600X speed is my extrapolation from the vendor's M4 Pro figure. Whether the preset voices were recorded with talent consent and cleared for commercial use is not stated, beyond the OpenRAIL-M grant.
- Qwen3-TTS: Sohee voice-rights confirmation is pending (issue #353). The VRAM figure (about 4.2 GB at fp16) is a third-party estimate. The truncation workaround is not verified.
- VoxCPM2: 8 GB VRAM is the vendor figure. Speed on a 3060 Ti and Windows installability (torchcodec, funasr) are not tested.
- MeloTTS Korean training-data license: unknown.
- MOSS-TTS-Nano: LICENSE status is contradictory. MOSS-TTS v1.5 size and VRAM: not checked.
- Kani-TTS-ko: contradictory license badge (Apache vs LFM 1.0). Data provenance unknown.
- I did not check GPT-SoVITS pretrained base data licensing beyond the HF "mit" tag.
- Korean user reports: I found Korean blog coverage (wikidocs) of Supertonic and VoxCPM2 but no substantive Korean listening reviews for Sohee or Supertonic Korean. Only GitHub issues (#55 truncation, Supertonic #151 English-word pronunciation in Korean text, #178 numerals).

## Sources

- Supertonic archive README and license: https://github.com/supertone-oss-archive/supertonic · https://huggingface.co/Supertone/supertonic-3 · https://huggingface.co/Supertone/supertonic-3/blob/main/LICENSE · https://github.com/supertone-oss-archive/supertonic-py (config.py: DEFAULT_MODEL = supertonic-3, repo Supertone/supertonic-3)
- Qwen3-TTS: https://github.com/QwenLM/Qwen3-TTS · https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice · issues https://github.com/QwenLM/Qwen3-TTS/issues/55 , https://github.com/QwenLM/Qwen3-TTS/issues/353
- faster-qwen3-tts benchmarks: https://github.com/andimarafioti/faster-qwen3-tts
- Qwen3 VRAM estimate (3rd-party): https://www.spheron.network/tools/gpu-recommender/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice/ , https://www.mintlify.com/QwenLM/Qwen3-TTS/advanced/performance
- VoxCPM2: https://huggingface.co/openbmb/VoxCPM2 · https://github.com/OpenBMB/VoxCPM · https://wikidocs.net/blog/@jaehong/11880/
- MeloTTS: https://huggingface.co/myshell-ai/MeloTTS-Korean · https://github.com/myshell-ai/MeloTTS/blob/main/docs/install.md · mecab-ko Windows notes https://pypi.org/project/mecab-ko/
- Chatterbox: https://github.com/resemble-ai/chatterbox · https://huggingface.co/ResembleAI/chatterbox
- CosyVoice: https://github.com/FunAudioLLM/CosyVoice · https://huggingface.co/FunAudioLLM/Fun-CosyVoice3-0.5B-2512 · SFT speaker list https://inference.readthedocs.io/en/latest/models/model_abilities/audio.html
- MOSS-TTS: https://huggingface.co/OpenMOSS-Team/MOSS-TTS-v1.5 · https://huggingface.co/OpenMOSS-Team/MOSS-TTS-Nano-100M
- Higgs TTS 3 license and Creator Use Grant: https://huggingface.co/bosonai/higgs-tts-3-4b · Higgs Audio 2 license: https://huggingface.co/bosonai/higgs-tts-2-3b-base
- OmniVoice: https://huggingface.co/k2-fsa/OmniVoice · F5-TTS: https://huggingface.co/SWivid/F5-TTS · XTTS-v2: https://huggingface.co/coqui/XTTS-v2 · Spark-TTS: https://huggingface.co/SparkAudio/Spark-TTS-0.5B · Fish S2: https://huggingface.co/fishaudio/s2-pro , license summary https://scancode-licensedb.aboutcode.org/fish-audio-research-2026-03-07.html · IndexTTS license: https://github.com/index-tts/index-tts/blob/main/LICENSE · Zonos: https://huggingface.co/Zyphra/Zonos-v0.1-transformer · Kokoro: https://huggingface.co/hexgrad/Kokoro-82M · Piper KSS card: https://huggingface.co/rhasspy/piper-voices/blob/main/ko/ko_KR/kss/medium/MODEL_CARD · Kani-TTS-ko: https://huggingface.co/nineninesix/kani-tts-400m-ko · kova-tts-1: https://huggingface.co/kova-ai/kova-tts-1
- Aligner: https://huggingface.co/Qwen/Qwen3-ForcedAligner-0.6B · https://github.com/QwenLM/Qwen3-ASR
