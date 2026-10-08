from radar.analysis import heuristic
from radar.analysis.judgments import resolve
from radar.analysis.korea_gap import gap_from_results, korean_query
from radar.analysis.manual import import_manual_csv


def test_matched_terms_whole_word_and_plural():
    assert heuristic.matched_terms("Scammers stole it", ["scammer", "con"]) == ["scammer"]
    assert heuristic.matched_terms("second contact", ["con"]) == []


def test_heuristic_values_capped_and_labelled(settings):
    js = heuristic.heuristic_judgments("Why my AI voice clone scam call? 3 secrets hackers never tell", "", settings)
    assert {j.dimension for j in js} == {"story_strength", "channel_fit", "localization_potential"}
    assert all(j.source == "heuristic_v0" and 0 <= j.value <= heuristic.HEURISTIC_MAX for j in js)


def test_channel_fit_off_topic_low(settings):
    off = heuristic.channel_fit("15-second garlic peeling trick", "", settings.topic_lexicon)
    on = heuristic.channel_fit("AI voice clone scam", "", settings.topic_lexicon)
    assert off.value < 0.3 < on.value


def test_region_specific_lowers_localization(settings):
    us = heuristic.localization_potential("Zelle scam on my phone", "", settings.universal_terms, settings.region_specific_terms)
    uni = heuristic.localization_potential("Scam on my phone", "", settings.universal_terms, settings.region_specific_terms)
    assert us.value < uni.value and "zelle" in us.rationale


def _j(dim, value, source, created, id_=1):
    return {"id": id_, "dimension": dim, "value": value, "source": source, "created_at": created}


def test_resolve_priority():
    rows = [
        _j("story_strength", 0.9, "heuristic_v0", "2026-10-05", 1),
        _j("story_strength", 0.4, "manual", "2026-10-01", 2),
        _j("story_strength", 0.6, "llm:x", "2026-10-06", 3),
        _j("channel_fit", 0.2, "heuristic_v0", "2026-10-01", 4),
        _j("channel_fit", 0.3, "heuristic_v0", "2026-10-02", 5),
    ]
    best = resolve(rows)
    assert best["story_strength"]["source"] == "manual"
    assert best["channel_fit"]["value"] == 0.3


def test_korean_query_longest_match():
    terms = {"voice": "목소리", "voice clone": "목소리 복제", "scam": "사기", "ai": "AI", "airtag": "에어태그"}
    assert korean_query("AI voice clone scam", terms) == "목소리 복제 사기 AI"
    assert korean_query("garlic trick", terms) is None
    assert korean_query("My AirTag and AI", terms) == "에어태그 AI"


def test_gap_from_results():
    assert gap_from_results(0, 0) == 1.0
    assert gap_from_results(2, 20_000) == 1.0
    assert gap_from_results(6, 7_100_000) == 0.0
    assert 0.0 < gap_from_results(3, 300_000) < 1.0


def test_manual_import(db, tmp_path):
    db.upsert_video({"id": "v1", "snippet": {"channelId": "c", "publishedAt": "2026-10-01T00:00:00Z"},
                     "contentDetails": {}, "statistics": {}}, "2026-10-03T00:00:00Z")
    p = tmp_path / "m.csv"
    p.write_text("video_id,dimension,value,rationale,author\n"
                 "v1,story_strength,0.8,strong reveal,kim\n"
                 "v1,outlier_ratio,0.5,,kim\n"          # metric dims are not judgments
                 "v1,channel_fit,1.4,,kim\n"
                 "v1,channel_fit,abc,,kim\n"
                 "nope,channel_fit,0.5,,kim\n", encoding="utf-8")
    n, errors = import_manual_csv(db, p, "2026-10-03T00:00:00Z")
    assert n == 1 and len(errors) == 4
    assert db.judgments("v1")[0]["source"] == "manual" and db.judgments("v1")[0]["author"] == "kim"


def test_manual_import_missing_columns(db, tmp_path):
    p = tmp_path / "m.csv"
    p.write_text("video,score\nv1,1\n", encoding="utf-8")
    n, errors = import_manual_csv(db, p, "x")
    assert n == 0 and "missing columns" in errors[0]


def test_import_with_llm_source_ranks_below_manual(db, tmp_path):
    from radar.analysis.judgments import resolve
    db.upsert_video({"id": "v9", "snippet": {"channelId": "c", "publishedAt": "2026-10-01T00:00:00Z", "title": "t"},
                     "contentDetails": {"duration": "PT30S"}, "statistics": {"viewCount": "1"}}, "2026-10-03T00:00:00Z")
    p = tmp_path / "llm.csv"
    p.write_text("video_id,dimension,value,rationale,author\nv9,story_strength,0.8,hook,claude\n", encoding="utf-8")
    n, errors = import_manual_csv(db, p, "2026-10-03T00:00:00Z", source="llm:claude-fable-5-1")
    assert (n, errors) == (1, [])
    assert import_manual_csv(db, p, "2026-10-03T00:00:00Z", source="bot")[1][0].startswith("source must be")
    p.write_text("video_id,dimension,value\nv9,story_strength,0.2\n", encoding="utf-8")
    assert import_manual_csv(db, p, "2026-10-03T00:00:01Z")[0] == 1  # manual, later
    best = resolve(db.judgments("v9"))["story_strength"]
    assert best["source"] == "manual" and best["value"] == 0.2
