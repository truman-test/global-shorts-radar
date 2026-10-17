"""Series layer of the drama packaging (reports/직원회의_패키징.md 2-3 / 3-5, reports/직원회의_시리즈바이블.md 1-3):
the series chip (series + ep), the retired end card and score (tests/test_ending.py), the flash-forward (cold_open), the side-dish shop set
(set) and the mail-notice poster prop (poster_prop): the script fields and their gate, the props the renderer reads,
the length estimate and the geometry (video/src/composition.json packaging / posterProps, Packaging.tsx, ColdOpen.tsx,
Props.tsx, Sets.tsx)."""
import json
from pathlib import Path

import pytest

from radar.production.remotion_render import build_props, cold_open_props, scene_props
from radar.production.script import (COLD_OPEN_LABEL, COLD_OPEN_PAD, COLD_OPEN_REWIND, COLD_OPEN_SECONDS, HOME_SETS,
                                     POSTER_PROPS, Line, Scene, Script, cast_of, cold_open_hold, cold_open_line,
                                     cold_open_seconds, default_staging, estimate_seconds, line_seconds, line_voice,
                                     load_script, series_chip, twist_scene_index, validate)

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "video" / "src"
COMP = json.loads((SRC / "composition.json").read_text(encoding="utf-8"))
TOKENS = json.loads((SRC / "tokens.json").read_text(encoding="utf-8"))
FRAME, RIG, PACK = COMP["frame"], COMP["rig"], COMP["packaging"]
DISCLAIMER = "※ 실제 수법을 바탕으로 각색한 재연입니다"


def _drama(**fields) -> Script:
    """Format A: the fox brags, calls, gets caught out (the twist close-up on the fox), then his aside."""
    scenes = [
        Scene("", "소득 맞히는 전화", "phone", layout="call", caller="모르는 번호", lines=[
            Line("fox_inner", "소득만 맞히면, 다들 믿어요."),
            Line("fox", "아버님, 연소득 기준 한도 나왔어요."),
            Line("father", "내 소득을 어떻게 알아요?")]),
        Scene("", "앱부터 깔라고?", "phone", layout="call", caller="모르는 번호", lines=[
            Line("fox", "신청서 쓰게 앱만 깔아 주세요."),
            Line("father", "끊고, 은행 대표번호로 직접 걸게요.")], twist="뚝!", twist_on="fox", twist_face="shocked"),
        Scene("", "작전 실패", "phone", layout="card", staging="solo",
              lines=[Line("fox_inner", "직접 건다는 말이… 제일 무서워요."), Line("fox_inner", "다음 집은…")]),
    ]
    for sc in scenes:
        sc.narration = " ".join(x.text for x in sc.lines)
    cast = {"fox": {"voice": "M2", "label": "여우", "role": "scammer", "character": "scammer"},
            "fox_inner": {"voice": "M3", "label": "여우 속마음", "role": "inner", "character": "scammer"},
            "father": {"voice": "M1", "label": "아버지", "role": "victim", "character": "father"}}
    s = Script(id="2026-10-15-fox-test", source_video_id="x", title="은행 사칭 전화, 여우가 제일 무서워한 한마디",
               description="", tags=[], disclaimer=DISCLAIMER, scenes=scenes, sources=[{"url": "https://example.org"}],
               cast=cast, cast_style="animal", hook_title="소득 맞히는\n은행 전화")
    for k, v in fields.items():
        setattr(s, k, v)
    return s


def _errors(s):
    return validate(s)[0]


def _warnings(s):
    return validate(s)[1]


def _cold(**more):
    return {"line": "어, 어어…?", "speaker": "fox", "seconds": COLD_OPEN_SECONDS, "stamp": "작전 실패", "label": "",
            "tts": "", **more}


# ------------------------------------------------------------------ series chip

@pytest.mark.parametrize("series,ep,chip", [("영업비밀", 3, "여우의 영업비밀 #3"), ("역관광", 2, "진돗개네 역관광 EP2"),
                                            ("동네 사칭", 1, "동네 사칭 #1"), ("", 3, ""), ("영업비밀", None, "")])
def test_series_chip_text(series, ep, chip):
    assert series_chip(_drama(series=series, ep=ep)) == chip


def test_the_sample_with_every_new_field_passes():
    s = _drama(series="영업비밀", ep=3, cold_open=_cold(), home_set="shop")
    errors, warnings = validate(s)
    assert errors == [] and not [w for w in warnings if w.startswith("drama:")], (errors, warnings)


@pytest.mark.parametrize("series,ep,problem", [
    ("영업비밀", None, "series needs ep"),
    ("", 3, "ep needs series"),
    ("영업비밀", 0, "ep must be a whole number"),
    ("영업비밀", "3", "ep must be a whole number"),
    ("영업비밀", True, "ep must be a whole number"),
    ("아주아주긴시리즈이름", 1, "longer than 8"),
    ("토스 사칭", 1, "real brand"),
])
def test_series_gate(series, ep, problem):
    assert any(problem in e for e in _errors(_drama(series=series, ep=ep))), _errors(_drama(series=series, ep=ep))


def test_series_chip_frees_the_title():
    dup = _drama(series="영업비밀", ep=3, hook_title="여우의 영업비밀 #3\n소득 맞히는 은행 전화")
    w = _warnings(dup)
    assert any("already says" in x for x in w) and any("<= 10" in x for x in w)
    assert not any("already says" in x or "<= 10" in x for x in _warnings(_drama(series="영업비밀", ep=3)))


def test_new_fields_on_an_explainer_are_ignored_with_a_warning():
    s = load_script(ROOT / "content" / "scripts" / "2026-10-08-zero-click.json")
    s.series, s.ep = "영업비밀", 3
    s.cold_open = _cold()
    errors, warnings = validate(s)
    assert errors == [] and any("only shown on dramas" in w for w in warnings)
    assert cold_open_seconds(s) == 0.0 and cold_open_line(s) is None


# ------------------------------------------------------------------ the retired scoreboard: tests/test_end_card.py


def test_series_chip_sits_on_the_title_box_beside_the_disclosure():
    t, se, chip = PACK["title"], PACK["series"], PACK["chip"]
    assert se["font"] >= 26 and se["h"] > se["font"]
    assert t["top"] + se["overlap"] - se["h"] >= 12                       # below the progress bar
    longest = "진돗개네 역관광 EP999"
    w = sum(0.3 if c == " " else 0.98 if "가" <= c <= "힣" else 0.7 for c in longest) * se["font"] + 2 * se["padX"]
    disclosure_right = chip["x"] + 260
    assert 540 - w / 2 > disclosure_right
    d = TOKENS["drama"]
    assert d["series"]["bg"] == d["title"]["border"] and d["series"]["text"] == d["title"]["band"]


# ------------------------------------------------------------------ cold open

def test_cold_open_gate():
    ok = _drama(cold_open=_cold())
    assert _errors(ok) == []
    cases = [
        (_cold(line=""), "needs line"),
        (_cold(speaker="nobody"), "not in the cast"),
        (_cold(speaker=""), "needs speaker"),
        (_cold(seconds=3), "seconds must be a number"),
        (_cold(seconds="0.9"), "seconds must be a number"),
        (_cold(line="어어어어어어어어어어어어어"), "longer than 12"),
        (_cold(stamp="사기꾼이 졌습니다요"), "1-8 characters"),
        (_cold(label="아주 오래전에는"), "label is longer"),
        (_cold(line="www.x.kr"), "speakable"),
    ]
    for co, problem in cases:
        s = _drama(cold_open=co)
        assert any(problem in e for e in _errors(s)), (co, _errors(s))
    no_twist = _drama(cold_open=_cold())
    no_twist.scenes[1].twist = no_twist.scenes[1].twist_on = no_twist.scenes[1].twist_face = ""
    assert any("needs a twist scene" in e for e in _errors(no_twist))


def test_cold_open_warnings_keep_the_winning_move_hidden():
    for co, word in ((_cold(stamp=""), "뚝"), (_cold(stamp="끊었다!"), "끊"), (_cold(line="직접 건다고?"), "직접")):
        w = _warnings(_drama(cold_open=co))
        if word == "뚝":
            assert not any("gives the winning move away" in x for x in w)      # "뚝!" alone: no keyword
        else:
            assert any("gives the winning move away" in x for x in w), (co, w)
    assert any("more than 6 syllables" in x for x in _warnings(_drama(cold_open=_cold(line="어어 이게 무슨 일이야"))))
    assert any("exact time" in x for x in _warnings(_drama(cold_open=_cold(label="3분 전"))))
    assert any("not the face in the twist" in x for x in _warnings(_drama(cold_open=_cold(speaker="father"))))
    assert not any("not the face" in x for x in _warnings(_drama(cold_open=_cold(speaker="fox_inner"))))


def test_cold_open_adds_its_time_to_the_estimate():
    plain = _drama()
    s = _drama(cold_open=_cold())
    line = cold_open_line(s)
    speech = line_seconds(line.tts_text(), line_voice(s, line.speaker))
    add = max(COLD_OPEN_SECONDS, speech + COLD_OPEN_PAD) + COLD_OPEN_REWIND
    assert cold_open_seconds(s) == pytest.approx(add)
    assert estimate_seconds(s) == pytest.approx(estimate_seconds(plain) + add)
    assert 0.9 < add < 1.6                                                # ~ +1.2 s
    assert cold_open_hold(s, 2.0) == pytest.approx(2.0 + COLD_OPEN_PAD)  # the hold always outlasts the line
    assert COLD_OPEN_REWIND * 30 == pytest.approx(PACK["cold"]["rewind"])


def test_cold_open_props():
    s = _drama(cold_open=_cold())
    assert twist_scene_index(s) == 1
    pages = [{"startMs": 0, "endMs": 900, "words": [], "speaker": "fox", "line": 0}]
    co = cold_open_props(s, "jobs/x/sc.wav", 0.7, pages, [])
    assert co["scene"] == 1 and co["stamp"] == "작전 실패" and co["label"] == COLD_OPEN_LABEL == "몇 분 전"
    assert co["holdMs"] == round(max(COLD_OPEN_SECONDS, 0.7 + COLD_OPEN_PAD) * 1000)
    assert co["durationMs"] == round((co["holdMs"] / 1000 + COLD_OPEN_REWIND) * 1000)
    assert co["holdMs"] >= co["speechMs"] + COLD_OPEN_PAD * 1000 - 1       # no rewind sound over the line
    default_stamp = cold_open_props(_drama(cold_open=_cold(stamp="")), "", 0.7, pages, [])
    assert default_stamp["stamp"] == "뚝!"
    assert cold_open_props(_drama(), "", 0.7, pages, []) is None
    cast = cast_of(s)
    scenes = [scene_props(sc, "", 0.0, 2.0, 2.3, [], None, default_staging(sc, cast)) for sc in s.scenes]
    props = build_props(s, scenes, "ch", cold_open=co)
    assert props["coldOpen"] is co
    s.series, s.ep = "영업비밀", 3
    props = build_props(s, scenes, "ch", cold_open=co)
    assert props["seriesChip"] == "여우의 영업비밀 #3" and "endCard" not in props    # the 도치 stamp ending needs no props
    plain = build_props(_drama(), scenes, "ch")
    assert not {"seriesChip", "score", "coldOpen", "endCard"} & set(plain)


def test_cold_open_line_is_synthesized_like_a_line(tmp_path):
    """The exclamation goes through the dialogue path in the speaker's voice; the hold outlasts it."""
    pytest.importorskip("imageio_ffmpeg")
    from radar.production.remotion_render import _cold_open_speech
    from tests.test_dialogue import FakeSupertonic
    s = _drama(cold_open=_cold())
    tts = FakeSupertonic()
    job = tmp_path / "job"
    job.mkdir()
    co = _cold_open_speech(s, tts, tmp_path, job)
    assert tts.calls == [("M2", [cold_open_line(s).tts_text()])]       # the fox's phone voice, one call
    assert (job / "sc.wav").is_file() and co["audio"] == f"jobs/{s.id}/sc.wav"
    assert co["speechMs"] == pytest.approx(500, abs=15)
    assert co["holdMs"] >= co["speechMs"] + 150 - 1 and co["holdMs"] >= COLD_OPEN_SECONDS * 1000
    page = co["pages"][0]
    assert page["speaker"] == "fox" and page["startMs"] == 0 and co["pages"][-1]["endMs"] <= co["holdMs"]
    assert co["lines"][0]["text"] == "어, 어어…?"
    assert _cold_open_speech(_drama(), tts, tmp_path, job) is None


def test_the_renderer_opens_on_the_cold_frame_and_loops_to_it():
    short = (SRC / "Short.tsx").read_text(encoding="utf-8")
    root = (SRC / "Root.tsx").read_text(encoding="utf-8")
    cold = (SRC / "ColdOpen.tsx").read_text(encoding="utf-8")
    assert "props.coldOpen?.durationMs" in root                          # the length counts the cold open
    assert "sceneFrames(props, fps, coldF.total)" in short                # every scene shifted by it
    assert "tail > 0 && n && cold ?" in short and "{coldShot}" in short   # poster tail = the cold frame
    assert "COLD.settle" in short and "cold: true" in short               # twist + settle, in colour
    assert 'cold.label || "몇 분 전"' in short and "<RewindChip" in short
    assert "from={coldF.hold}" in short                                   # the whoosh only after the line
    assert "url(#coldRewindBlur)" in cold and "clipPath" in cold
    c = PACK["cold"]
    assert c["rewind"] == 8 and 8 <= c["settle"] <= 12 and 1 < c["punch"] <= 1.08 and 0 < c["shrink"] <= 0.05
    cast_scene = (SRC / "CastScene.tsx").read_text(encoding="utf-8")
    assert "const k = c.cold ? 0 : landed" in cast_scene                 # no grayscale on the poster frame


def test_rewind_chip_under_the_title_and_out_of_the_way():
    r, t = PACK["rewind"], PACK["title"]
    top = t["top"] + 2 * t["lineH"] + 2 * (t["padY"] + t["border"]) + r["gap"]
    assert top + r["h"] < FRAME["eyeBand"][0] and r["font"] >= 26
    assert 24 <= r["frames"] <= 36
    d = TOKENS["drama"]["rewind"]
    assert d["text"] == "#FFFFFF"


# ------------------------------------------------------------------ the shop set and the mail notice

def test_shop_set_and_poster_prop_fields():
    assert HOME_SETS == tuple(COMP["homeSets"]) and set(POSTER_PROPS) == set(COMP["posterProps"])
    assert "counter" in COMP["props"]
    s = _drama(home_set="shop")
    s.scenes[2].poster_prop = "mail_notice"
    assert _errors(s) == []
    cast = cast_of(s)
    scenes = [scene_props(sc, "", 0.0, 2.0, 2.3, [], None, default_staging(sc, cast)) for sc in s.scenes]
    props = build_props(s, scenes, "ch")
    assert [sc.get("set") for sc in props["scenes"]] == ["shop"] * 3
    assert props["scenes"][2]["posterProp"] == "mail_notice" and "posterProp" not in props["scenes"][0]
    s.scenes[0].home_set = "living"
    assert "set" not in build_props(s, scenes, "ch")["scenes"][0]
    bad = _drama(home_set="kitchen")
    assert any("unknown set 'kitchen'" in e for e in _errors(bad))
    call = _drama()
    call.scenes[0].poster_prop = "mail_notice"                            # a pip_call: no wall beside the face
    assert any("stage the scene solo" in e for e in _errors(call))
    unknown = _drama()
    unknown.scenes[2].poster_prop = "flyer"
    assert any("unknown poster_prop" in e for e in _errors(unknown))


def test_load_script_reads_the_new_fields(tmp_path):
    data = json.loads((ROOT / "content" / "scripts" / "2026-10-12-fox-bank-income.json").read_text(encoding="utf-8"))
    data.update(series="영업비밀", ep=3, set="shop", hook_title="소득 맞히는\n은행 전화",
                cold_open={"line": "어, 어어…?", "speaker": "fox", "stamp": "작전 실패"})
    data["scenes"][0]["poster_prop"] = "mail_notice"
    p = tmp_path / "s.json"
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    s = load_script(p)
    assert (s.series, s.ep, s.home_set, s.scenes[0].poster_prop) == ("영업비밀", 3, "shop", "mail_notice")
    assert s.cold_open["seconds"] == COLD_OPEN_SECONDS and s.cold_open["label"] == ""
    errors, warnings = validate(s)
    assert errors == [], errors
    data["cold_open"] = "어어"
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    with pytest.raises(ValueError):
        load_script(p)


def test_mail_notice_geometry():
    import math
    b = COMP["posterProps"]["mail_notice"]
    # rotated about its top centre: the lower right corner drops by w/2 * sin(rotate)
    low = b["y"] + b["h"] * math.cos(math.radians(b["rotate"])) + b["w"] / 2 * math.sin(math.radians(abs(b["rotate"])))
    assert b["y"] >= PACK["safeTop"]                                       # under the title box
    assert low + 30 < FRAME["captionBand"][0] - 60                         # above the speaker chip and the captions
    assert low + 8 < FRAME["rightColumn"]["y"][0] or b["x"] + b["w"] < FRAME["rightColumn"]["x"]
    assert b["x"] + b["w"] + 20 <= FRAME["w"]
    spot = COMP["stagings_spec"]["solo"]["shots"]["victim"]["chars"][0]
    half = (RIG["head"]["rx"] + 34) * spot["k"]                            # the head with its cheek fur
    assert b["charX"] + half <= b["x"]                                     # the face stays clear of the notice
    assert b["charX"] - half >= -10                                        # and inside the frame
    props = (SRC / "Props.tsx").read_text(encoding="utf-8")
    for banned in ("우체국", "010", "1588"):
        assert banned not in props                                         # no agency name, no real number
    assert "●●●●-●●●●" in props
    notice = TOKENS["drama"]["notice"]
    assert notice["paper"] and notice["seal"]
