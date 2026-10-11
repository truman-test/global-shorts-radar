"""Drama packaging (2026-10-11 decision: "사기꾼이 잘못 걸리는 30초"): a skit played by rigged characters renders like an
entertainment Short. The script fields (hook_title, inner voice, spike), the gate (title limits, no checklist, the 10%
lesson budget), the 0.0 s start, the props the renderer reads and the geometry of the new layers
(video/src/composition.json "packaging" / "aside" / the twist stamp variants, video/src/Packaging.tsx)."""
import copy
import json
import re
from pathlib import Path

import pytest

from radar.production.remotion_render import (DRAMA_DISCLOSURE, SFX, build_props, cast_props, lines_props,
                                              scene_props)
from radar.production.script import (HOOK_TITLE_LINE_CHARS, HOOK_TITLE_MAX_LINES, LAYOUT_LEAD_IN, LESSON_SHARE_MAX,
                                     POSTER_TAIL, Line, Scene, Script, cast_of, default_staging, estimate_seconds,
                                     hook_title_lines, is_drama, lesson_seconds, load_script, mockup_side,
                                     scene_lead_in, scene_seconds, validate, victim_character)

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "video" / "src"
COMP = json.loads((SRC / "composition.json").read_text(encoding="utf-8"))
FRAME, RIG, PACK = COMP["frame"], COMP["rig"], COMP["packaging"]
DISCLAIMER = "※ 실제 수법을 바탕으로 각색한 재연입니다"


def _cast(**more) -> dict:
    cast = {"fox": {"voice": "M2", "label": "여우", "role": "scammer", "character": "scammer"},
            "fox_inner": {"voice": "M3", "label": "여우 속마음", "role": "inner", "character": "scammer"},
            "father": {"voice": "M1", "label": "아버지", "role": "victim", "character": "father"}}
    cast.update(more)
    return cast


def _drama(hook_title="소득 맞히는 전화\n여우의 영업비밀", scenes=None, cast=None) -> Script:
    """Format A (여우의 영업비밀): the fox brags to the camera, calls, gets caught out."""
    scenes = scenes if scenes is not None else [
        Scene("", "소득 맞히는 전화", "phone", layout="call", caller="모르는 번호", lines=[
            Line("fox_inner", "소득만 맞히면, 다들 믿어요."),
            Line("fox", "아버님, 연소득 기준 한도 나왔어요.", bubble="한도 나왔어요"),
            Line("father", "내 소득을 어떻게 알아요?"),
            Line("fox", "은행이니까요. 신청서 앱부터요.")]),
        Scene("", "앱부터 깔라고?", "phone", layout="call", caller="모르는 번호", lines=[
            Line("fox_inner", "깔면, 경찰에 걸어도 제가 받을 수 있죠."),
            Line("fox", "기존 대출은 먼저 갚으시고요.", spike="기존"),
            Line("father", "끊고, 은행 앱 번호로 다시 걸게요.")], twist="작전 실패"),
        Scene("", "다시 거는 게 무섭다", "phone", lines=[Line("fox_inner", "다시 거는 게, 제일 무서워요.")]),
    ]
    for sc in scenes:
        sc.narration = sc.narration or " ".join(x.text for x in sc.lines)
    return Script(id="2026-10-12-fox-secret", source_video_id="x", title="은행 사칭 전화, 사기꾼이 제일 무서워하는 한마디",
                  description="", tags=[], disclaimer=DISCLAIMER, scenes=scenes,
                  sources=[{"url": "https://example.org"}], cast=_cast() if cast is None else cast,
                  cast_style="animal", hook_title=hook_title)


def _errors(s: Script) -> list[str]:
    return validate(s)[0]


def _warnings(s: Script) -> list[str]:
    return validate(s)[1]


# ------------------------------------------------------------------ what a drama is, and the sample passes

def test_the_sample_drama_passes_and_is_a_drama():
    s = _drama()
    assert is_drama(s)
    assert _errors(s) == [] and not any(w.startswith("drama:") for w in _warnings(s))
    plain = load_script(ROOT / "content" / "scripts" / "2026-10-08-family-password.json")
    assert not is_drama(plain)                                   # explainers keep their packaging
    pilot = load_script(ROOT / "content" / "scripts" / "2026-10-10-skit-voice-clone.json")
    assert not is_drama(pilot)                                   # dialogue without rigged characters: a mockup


# ------------------------------------------------------------------ the situation title

@pytest.mark.parametrize("title,lines", [
    ("혼자 계세요?", ["혼자 계세요?"]),
    ("비웃던 아버지\n두 번째 전화엔", ["비웃던 아버지", "두 번째 전화엔"]),
    ("비웃던 아버지 두 번째 전화엔", ["비웃던 아버지", "두 번째 전화엔"]),       # one space picked, balanced
    ("  ", []),
])
def test_hook_title_lines(title, lines):
    assert hook_title_lines(title) == lines


@pytest.mark.parametrize("title,problem", [
    ("", "needs hook_title"),
    ("가" * (HOOK_TITLE_LINE_CHARS + 1), "lines of <= 12"),
    ("하나\n둘\n셋", "1-2 lines"),
    ("열세글자가넘는긴제목줄입니다요\n둘", "lines of <= 12"),
    ("토스 직원 전화\n받지 마세요", "real brand"),
])
def test_hook_title_is_required_and_short(title, problem):
    errs = _errors(_drama(hook_title=title))
    assert any(problem in e and e.startswith("drama:") for e in errs), errs


def test_the_title_limits_are_the_renderers():
    assert PACK["title"]["maxChars"] == HOOK_TITLE_LINE_CHARS == 12
    assert PACK["title"]["maxLines"] == HOOK_TITLE_MAX_LINES == 2


def test_hook_title_on_an_explainer_is_only_a_warning():
    s = load_script(ROOT / "content" / "scripts" / "2026-10-08-zero-click.json")
    s.hook_title = "안 눌러도 해킹"
    errors, warnings = validate(s)
    assert errors == [] and any("only shown on dramas" in w for w in warnings)


# ------------------------------------------------------------------ the gate: no lecture

def test_a_drama_never_has_a_checklist():
    s = _drama()
    s.scenes.append(Scene("일단 끊고, 앱 번호로 다시 거세요.", "끊고 다시 걸기", "shield", layout="checklist",
                          items=["전화 끊기", "앱 번호로 다시 걸기"], lines=[], staging=""))
    assert any("is a checklist" in e for e in _errors(s))


def test_lesson_like_time_over_ten_percent_warns():
    s = _drama()
    assert lesson_seconds(s) == 0.0
    # 도치 explaining beside the family (dochi_explains on a card) is a lesson
    s.scenes.append(Scene("", "모르는 앱은 깔지 않기", "shield", layout="card", staging="dochi_explains",
                          lines=[Line("dochi", "앱 설치를 요구하면 무조건 사기예요."),
                                 Line("dochi", "끊고, 은행 앱의 번호로 다시 거세요.")]))
    s.scenes[-1].narration = " ".join(x.text for x in s.scenes[-1].lines)
    share = lesson_seconds(s) / estimate_seconds(s)
    assert share > LESSON_SHARE_MAX
    assert any("lesson-like" in w for w in _warnings(s))
    # 도치 lines inside a story scene count too, line by line
    t = _drama()
    t.cast["dochi"] = {"voice": "F1", "label": "도치"}
    t.scenes[0].lines.append(Line("dochi", "앱 설치는 백 퍼센트 사기예요. 절대 깔지 마세요."))
    assert 0 < lesson_seconds(t) < scene_seconds(t, 0, t.scenes[0])


def test_old_dramas_are_rejected_only_by_the_new_rules():
    for name in ("drama-bank-caller", "recreate-isolation"):
        s = load_script(ROOT / "content" / "scripts" / f"2026-10-11-{name}.json")
        errors = validate(s, allow_unverified=True)[0]
        assert errors and all(e.startswith("drama: ") for e in errors), errors
        assert any("checklist" in e for e in errors)


# ------------------------------------------------------------------ inner voice (속마음)

def test_inner_voice_is_a_second_voice_of_the_same_character():
    s = _drama()
    cast = cast_of(s)
    assert cast["fox_inner"]["role"] == "inner" and mockup_side("inner") is None
    assert victim_character(cast) == "father"
    no_label = _cast(fox_inner={"voice": "M3", "role": "inner", "character": "scammer"})
    assert cast_of(_drama(cast=no_label))["fox_inner"]["label"] == "속마음"     # default thought chip
    bad = _drama(cast=_cast(fox_inner={"voice": "M3", "role": "inner"}))
    assert any("needs the character" in e for e in _errors(bad))
    lonely = _drama(cast=_cast(fox_inner={"voice": "M3", "role": "inner", "character": "son"}))
    assert any("no other cast member plays 'son'" in e for e in _errors(lonely))
    # an aside-only scene is staged solo (the character alone), a call with an aside stays a pip_call
    assert default_staging(s.scenes[2], cast) == "solo" and default_staging(s.scenes[0], cast) == "pip_call"
    props = cast_props(s)
    assert props["fox_inner"] == {"label": "여우 속마음", "role": "inner", "character": "scammer"}


def test_the_renderer_plays_inner_lines_as_an_aside():
    rig = (SRC / "rig.ts").read_text(encoding="utf-8")
    cast_scene = (SRC / "CastScene.tsx").read_text(encoding="utf-8")
    assert 'name: "aside"' in rig and "export const splice" in rig and 'role !== "inner"' in rig
    assert 'shot.name === "aside"' in cast_scene and "const AsideShot" in cast_scene and "속마음" in cast_scene
    assert '"inner"' in re.search(r"export type SpeakerRole =([^;]+);", (SRC / "types.ts").read_text(encoding="utf-8")).group(1)


# ------------------------------------------------------------------ 도치 the 가시 감지기

def test_spike_flags():
    s = _drama()
    lines = lines_props(s.scenes[1], [(0.0, 2.0), (2.3, 4.0), (4.3, 6.0)], cast_of(s))
    assert lines[1]["spike"] == "기존" and "spike" not in lines[0]
    s.scenes[1].lines[1].spike = True
    assert _errors(s) == []
    s.scenes[1].lines[1].spike = "송금"
    assert any("spike '송금' must be a word of the line" in e for e in _errors(s))
    t = _drama()
    t.cast["dochi"] = {"voice": "F1", "label": "도치"}
    t.scenes[0].lines.append(Line("dochi", "앱은 깔지 마세요.", spike=True))
    assert any("does not spike at its own line" in e for e in _errors(t))


def test_spike_sound_and_spot():
    assert "spike" in SFX
    sp = PACK["spike"]
    size = sp["size"]
    top = sp["feetY"] - 1.35 * size                      # spikes up, with the 삐빅 burst above the head
    assert sp["feetY"] + 0.06 * size < FRAME["captionBand"][0]         # out of the caption band
    assert sp["feetY"] < FRAME["bottomSafe"]                             # and the bottom 20%
    assert sp["x"] + 0.6 * size + 140 < FRAME["rightColumn"]["x"]       # body + burst clear of the right column
    assert top > PACK["safeTop"]
    assert 24 <= sp["frames"] <= 40                                      # about a second
    short = (SRC / "Short.tsx").read_text(encoding="utf-8")
    assert "<SpikeAlert />" in short and 'name="spike"' in short


# ------------------------------------------------------------------ voice from 0.0 s

def test_drama_dialogue_starts_at_once():
    s = _drama()
    assert all(scene_lead_in(s, i, sc) == 0.0 for i, sc in enumerate(s.scenes))
    plain = load_script(ROOT / "content" / "scripts" / "2026-10-08-family-password.json")
    # an explainer's call still rings first (the opening scene capped at 0.4 s)
    assert plain.scenes[0].layout == "call" and scene_lead_in(plain, 0, plain.scenes[0]) == 0.4
    later = Scene("x", "h", "phone", layout="call", caller="딸")
    assert scene_lead_in(plain, 2, later) == LAYOUT_LEAD_IN["call"] == 0.9
    assert estimate_seconds(s) == pytest.approx(POSTER_TAIL + sum(scene_seconds(s, i, sc)
                                                                  for i, sc in enumerate(s.scenes)))
    motion = COMP["motion"]
    assert motion["openFrames"] <= 9 and 1 < motion["openPunch"] <= motion["punchIn"]   # moving within 0.3 s


# ------------------------------------------------------------------ props

def test_props_of_a_drama():
    s = _drama()
    scenes = [scene_props(sc, "", 0.0, 2.0, 2.3, [], None, default_staging(sc, cast_of(s))) for sc in s.scenes]
    for sc in scenes:
        sc["sub"] = "금감원 · 2026.10.6"                     # an agency/date sub never reaches the picture
    props = build_props(s, scenes, "채널", episode_no=7)
    assert props["packaging"] == "drama" and props["hookTitle"] == ["소득 맞히는 전화", "여우의 영업비밀"]
    assert props["disclosure"] == DRAMA_DISCLOSURE == "재연 · AI 음성"
    assert not {"episodeNo", "shareLine", "cta"} & set(props)
    assert all(sc["sub"] == "" for sc in props["scenes"])
    assert props["disclaimer"] == DISCLAIMER                   # still in the description (build_description)
    packaging = (SRC / "Packaging.tsx").read_text(encoding="utf-8")
    assert f'export const DISCLOSURE = "{DRAMA_DISCLOSURE}"' in packaging
    types = (SRC / "types.ts").read_text(encoding="utf-8")
    for name in ("packaging?: Packaging", "hookTitle?: string | string[]", "disclosure?: string",
                 "spike?: boolean | string"):
        assert name in types, name


# ------------------------------------------------------------------ geometry of the new layers

def test_chip_and_title_sit_at_the_top_clear_of_the_content():
    chip, t = PACK["chip"], PACK["title"]
    assert chip["font"] >= 26                                        # a required disclosure: legible
    assert chip["y"] + chip["h"] <= t["top"]                         # above the title, never on it
    bottom = t["top"] + t["maxLines"] * t["lineH"] + 2 * (t["padY"] + t["border"])
    assert bottom <= PACK["safeTop"] < FRAME["eyeBand"][0]
    width = t["maxChars"] * t["font"] * 0.98 + 2 * (t["padX"] + t["border"])
    assert width <= FRAME["w"] - 2 * 36                              # 12 characters fit at full size
    assert t["font"] >= 64 and t["font"] > 2 * chip["font"]          # big and the loudest text up there
    for shot in ("wide", "close"):                                   # the caller's window starts under the title
        assert COMP["stagings_spec"]["pip_call"]["shots"][shot]["window"]["y"] >= PACK["safeTop"]
    assert COMP["stagings_spec"]["over_shoulder_chat"]["shots"]["over"]["panel"]["y"] >= PACK["safeTop"]
    half = 50                                                        # a one-line keyword bubble
    assert PACK["bubbleY"] - half >= bottom
    for _, y in COMP["stagings_spec"]["pip_call"]["bubble"].values():
        assert y - half >= bottom and y + half < FRAME["captionBand"][0]


def _neck(spot):
    return spot["eyeY"] - RIG["eyeY"] * spot["k"]


def test_aside_close_up():
    a = COMP["aside"]
    spot = a["chars"][0]
    k, n = spot["k"], _neck(spot)
    head = (RIG["head"]["chin"] - RIG["head"]["top"]) * k / FRAME["h"]
    lo, hi = COMP["shotSizes"][a["size"]]
    assert lo <= head <= hi and spot["turn"] == 0                   # a close-up facing the camera
    assert FRAME["eyeBand"][0] <= spot["eyeY"] <= FRAME["eyeBand"][1]
    chin = n + RIG["head"]["chin"] * k
    assert chin < a["prop"]["top"] <= FRAME["captionBand"][0] and a["familyProp"]["top"] <= FRAME["captionBand"][0]
    for hx, hy in RIG["hands"]["rest"].values():                    # resting paws hidden by the desk / table
        assert n + hy * k - RIG["handR"] * k > a["prop"]["top"]
    half = (RIG["head"]["rx"] + 34) * k
    assert spot["x"] + half < FRAME["rightColumn"]["x"] or chin < FRAME["rightColumn"]["y"][0] + 200
    tag = a["tag"]
    assert tag["y"] >= PACK["safeTop"] and tag["x"] + 200 < spot["x"]


def _units(text: str) -> float:
    return sum(0.3 if ch == " " else 0.45 if ch in "!?.,~" else 0.95 for ch in text)


def _stamp_look(text: str):
    """Mirror of rig.ts stampLook."""
    st = COMP["stagings_spec"]["twist_closeup"]["stamp"]
    v = st["variants"]
    n = sum(0 if ch == " " else 0.5 if ch in "!?" else 1 for ch in text)
    pick = "round" if n <= v["round"]["maxChars"] else "short" if n <= v["short"]["maxChars"] else "long"
    size = v[pick]["size"]
    if pick == "round":
        font = size * 1.05
        w = max(2.1 * size, _units(text) * font + 0.5 * size)
        h = w
    else:
        w = _units(text) * size + 0.9 * size
        h = 1.75 * size
    return pick, w, h, min(st["y"], st["bottom"] - h / 2)


@pytest.mark.parametrize("text,shape", [("뚝!", "round"), ("들켰다", "short"), ("역관광!", "short"),
                                         ("작전 실패", "short"), ("영업 실패", "short"), ("사기였습니다", "long"),
                                         ("이번엔 실패했다", "long")])
def test_twist_stamp_variants_stay_on_the_chest(text, shape):
    pick, w, h, y = _stamp_look(text)
    assert pick == shape
    tw = COMP["stagings_spec"]["twist_closeup"]
    spot = tw["shots"]["twist"]["chars"][0]
    n = _neck(spot)
    mouth, chin = n + RIG["mouthY"] * spot["k"], n + RIG["head"]["chin"] * spot["k"]
    top, bottom = y - h / 2, y + h / 2
    assert top > mouth + 60 and top >= chin - 30                     # never over the mouth, under the chin
    assert bottom < FRAME["captionBand"][0]
    assert w <= FRAME["w"] - 80
    rig = (SRC / "rig.ts").read_text(encoding="utf-8")
    assert "export const stampLook" in rig and "stampLook(scene.twist.text)" in (SRC / "Short.tsx").read_text(
        encoding="utf-8")


def test_spike_sfx_is_generated(tmp_path):
    pytest.importorskip("imageio_ffmpeg")
    from radar.production.assemble import media_info
    from radar.production.remotion_render import ensure_sfx
    seconds, _ = media_info(ensure_sfx(tmp_path) / "spike.wav")
    assert 0.15 < seconds < 0.4                                  # "삐빅": two short beeps, no voice
