"""Series number, share line and value CTA (reports/구독자 1천명 외부 성장 전략.md, (a) items 3 and 6).

All three are visual only: no narration, no audio, no extra time, and the poster tail (the loop/thumbnail frame)
stays the opening frame.
"""
import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest

from radar.production.assemble import write_meta
from radar.production.remotion_render import POSTER_TAIL_MS, SHARE_LINE, VALUE_CTA, build_props, meta_extra
from radar.production.script import load_script
from radar.production.themes import episode_number, style_of

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "video" / "src"
FPS = 30


def _schedule(tmp_path, entries):
    p = tmp_path / "schedule.json"
    p.write_text(json.dumps({"entries": entries}, ensure_ascii=False), encoding="utf-8")
    return p


def test_episode_number_is_the_position_in_the_schedule_by_date(tmp_path):
    # listed out of order on purpose: the number follows the dates, not the file order
    p = _schedule(tmp_path, [
        {"date": "2026-10-11", "script": "c", "status": "ready"},
        {"date": "2026-10-09", "script": "a", "status": "published"},
        {"date": "2026-10-10", "script": "b", "status": "published"},
        {"date": "2026-10-12", "status": "planned"},                      # no script yet: not counted
        {"date": "2026-10-13", "script": "d", "status": "planned"},
    ])
    assert [episode_number(s, p) for s in "abcd"] == [1, 2, 3, 4]
    assert episode_number("not-scheduled", p) is None


def test_episode_number_without_a_schedule_is_none(tmp_path):
    assert episode_number("a", tmp_path / "missing.json") is None
    bad = tmp_path / "bad.json"
    bad.write_text("{not json", encoding="utf-8")
    assert episode_number("a", bad) is None
    # a script listed twice keeps its first slot and does not shift the ones after it
    p = _schedule(tmp_path, [{"date": "2026-10-09", "script": "a"}, {"date": "2026-10-10", "script": "a"},
                             {"date": "2026-10-11", "script": "b"}])
    assert (episode_number("a", p), episode_number("b", p)) == (1, 2)


def test_shipped_schedule_numbers_the_first_episodes():
    assert episode_number("2026-10-08-family-password") == 1
    assert episode_number("2026-10-08-deepfake-cfo") == 2
    assert episode_number("2026-10-08-zero-click") == 3


def test_props_carry_the_episode_share_line_and_cta():
    s = load_script("content/scripts/2026-10-08-zero-click.json")
    props = build_props(s, [], "채널", episode_no=3)
    assert props["episodeNo"] == 3
    assert props["shareLine"] == SHARE_LINE == "부모님께도 보내 주세요"
    assert props["cta"] == VALUE_CTA == "매일 1장, 생존노트"
    # `episode` stays the script id (the stage seed's fallback), the number is a separate field
    assert props["episode"] == s.id
    # unscheduled (None) or nonsense numbers are left out rather than shown wrong
    for bad in (None, 0, -1, True, "3"):
        assert "episodeNo" not in build_props(s, [], "채널", episode_no=bad)
    off = build_props(s, [], "채널", share_line=None, cta="")
    assert "shareLine" not in off and "cta" not in off
    # visual only: the growth lines never reach the narration or the timing
    assert all(SHARE_LINE not in sc.narration and VALUE_CTA not in sc.narration for sc in s.scenes)
    assert props["posterTailMs"] == POSTER_TAIL_MS
    json.dumps(props, ensure_ascii=False)


def test_meta_records_the_episode(tmp_path):
    s = load_script("content/scripts/2026-10-08-zero-click.json")
    tts = SimpleNamespace(name="tone", voice=None, publishable=False)
    style = style_of("paper", "security")
    meta = write_meta(tmp_path, s, 30.0, "1080x1920", tts, [], extra=meta_extra(style, "continuity", 12.34, 3))
    data = json.loads(meta.read_text(encoding="utf-8"))
    assert data["episode"] == 3 and data["theme"] == "paper" and data["render_seconds"] == 12.3
    meta = write_meta(tmp_path, s, 30.0, "1080x1920", tts, [], extra=meta_extra(style, "continuity", 1.0, None))
    assert json.loads(meta.read_text(encoding="utf-8"))["episode"] is None


def test_cta_window_ends_before_the_poster_tail():
    """The value CTA lives in a Sequence ending exactly where the poster tail starts, lasts <= 2 s and has faded to 0
    on its last frame; the tail renders the first scene without the share line, so frame 0 == the loop frame."""
    short = (SRC / "Short.tsx").read_text(encoding="utf-8")
    frames = int(re.search(r"export const CTA_FRAMES = (\d+);", short).group(1))
    assert 24 <= frames <= 2 * FPS
    assert "const from = Math.max(spans[n - 1].from, end - CTA_FRAMES);" in short
    assert "<Sequence from={from} durationInFrames={Math.max(1, end - from)}>" in short
    assert "(frames - 1 - frame) / CTA_OUT" in short          # opacity 0 on the closing scene's last frame
    tail = short[short.index("Poster tail"):short.index("{props.cta && n ?")]
    assert "share" not in tail and "ValueCta" not in tail and "last: false" in tail
    # only the closing scene gets the share line, and only the checklist draws it
    assert short.count("share: last ? props.shareLine : undefined") == 2
    assert "s.last && items.length ? s.share : undefined" in (SRC / "ChecklistScene.tsx").read_text(encoding="utf-8")
    # nothing in the composition length depends on the growth lines (no extra time)
    root = (SRC / "Root.tsx").read_text(encoding="utf-8")
    meta = root[root.index("calculateMetadata"):]
    assert "cta" not in meta and "shareLine" not in meta


def _props(**over) -> dict:
    page = [{"startMs": 0, "endMs": 1500, "words": [{"text": "테스트", "startMs": 0, "endMs": 700}]}]
    props = {
        "channel": "디지털 생존노트", "voiceLabel": "AI 음성", "disclaimer": "※ 테스트용 재연입니다", "sfx": False,
        "music": None, "transition": "continuity", "posterTailMs": POSTER_TAIL_MS, "theme": "paper",
        "category": "voice", "episode": "test", "seed": 7, "episodeNo": 12, "shareLine": SHARE_LINE, "cta": VALUE_CTA,
        "scenes": [
            {"layout": "card", "audio": "", "leadInMs": 0, "speechMs": 2500, "durationMs": 3000, "pages": page,
             "headline": "모르는 번호, 먼저 확인", "sub": "", "icon": "phone", "accent": "red", "mascot": False},
            {"layout": "checklist", "audio": "", "leadInMs": 0, "speechMs": 3500, "durationMs": 4000, "pages": page,
             "headline": "오늘 할 일", "sub": "", "icon": "check", "accent": "green", "mascot": False,
             "items": ["저장된 번호로 다시 걸기", "가족 암호 정하기", "링크는 누르지 않기"]},
        ],
    }
    props.update(over)
    return props


@pytest.mark.skipif(os.environ.get("RADAR_TEST_REMOTION") != "1", reason="slow: set RADAR_TEST_REMOTION=1 to render")
def test_rendered_tail_matches_frame_0_and_never_shows_the_cta(tmp_path):
    Image = pytest.importorskip("PIL.Image")
    ImageChops = pytest.importorskip("PIL.ImageChops")
    npx = shutil.which("npx") or shutil.which("npx.cmd")
    if not npx or not (ROOT / "video" / "node_modules" / "remotion").is_dir():
        pytest.skip("Remotion is not installed")
    end = sum(round(s["durationMs"] / 1000 * FPS) for s in _props()["scenes"])
    last = end + round(POSTER_TAIL_MS / 1000 * FPS) - 1

    def still(name: str, props: dict, frame: int):
        pp = tmp_path / f"{name}.json"
        pp.write_text(json.dumps(props, ensure_ascii=False), encoding="utf-8")
        out = tmp_path / f"{name}_{frame}.png"
        r = subprocess.run([npx, "remotion", "still", "src/index.ts", "Short", str(out), f"--props={pp}",
                            f"--frame={frame}", "--log=error"], cwd=ROOT / "video", capture_output=True, text=True,
                           encoding="utf-8", errors="replace")
        assert r.returncode == 0, r.stderr[-1500:]
        return Image.open(out).convert("RGB")

    def mean_diff(a, b, box):
        h = ImageChops.difference(a.crop(box), b.crop(box)).convert("L").histogram()
        return sum(v * n for v, n in enumerate(h)) / max(1, sum(h))

    full, no_cta, no_share = _props(), _props(cta=None), _props(shareLine=None)
    # the tail never shows the CTA: identical with and without it
    assert ImageChops.difference(still("a", full, last), still("b", no_cta, last)).getbbox() is None
    # ... while the closing scene does show it just before the tail (under the brand line)
    cta_box = (0, 150, 1080, 235)
    assert mean_diff(still("a", full, end - 12), still("b", no_cta, end - 12), cta_box) > 2
    # the share line is written under the checklist card, above the caption band (3 items: it replaces the sign-off)
    under = (0, 1080, 1080, 1250)
    assert mean_diff(still("a", full, end - 12), still("c", no_share, end - 12), under) > 0.5
    # tail == frame 0 pixel for pixel below the progress bar (paper stage, 도치 off: nothing else moves), series chip
    # included; the chip is really drawn there
    first, tail = still("a", full, 0), still("a", full, last)
    below_bar = (0, 14, 1080, 1920)
    assert ImageChops.difference(first.crop(below_bar), tail.crop(below_bar)).getbbox() is None
    assert mean_diff(first, still("d", _props(episodeNo=None), 0), (0, 60, 1080, 160)) > 1
