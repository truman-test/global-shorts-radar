from radar import cli, pipeline
from radar.collectors.fixture import FixtureClient
from radar.collectors.youtube import QuotaTracker
from radar.reports.seeds import suggest_seed_channels, toml_snippet


def _run(db, settings, now):
    client = FixtureClient(quota=QuotaTracker(10_000))
    pipeline.collect(client, db, settings, now, "fixture")
    pipeline.compute_metrics(db, settings, now)
    pipeline.run_heuristics(db, settings, now)
    pipeline.score_candidates(db, settings, now)


def test_suggestions_require_score_and_topic_fit(db, settings, now):
    _run(db, settings, now)
    ids = [s["channel_id"] for s in suggest_seed_channels(db, settings)]
    assert ids[0] == "UCbytesized", "best-scoring channel first"
    assert "UCkitchen" not in ids, "15x outlier but off-topic (channel_fit 0.1) is not a seed"
    assert "UCnewlab" not in [s["channel_id"] for s in suggest_seed_channels(db, settings, min_score=50)], "below threshold"
    assert "UCnewlab" in [s["channel_id"] for s in suggest_seed_channels(db, settings, min_score=40)]
    settings.seed_channels = ["UCbytesized"]
    assert "UCbytesized" not in [s["channel_id"] for s in suggest_seed_channels(db, settings)], "already configured"


def test_snippet_is_pasteable_toml(db, settings, now):
    import tomllib
    _run(db, settings, now)
    snippet = toml_snippet(suggest_seed_channels(db, settings, top=3))
    parsed = tomllib.loads(snippet)
    assert len(parsed["seed_channels"]) == 3 and parsed["seed_channels"][0] == "UCbytesized"
    assert "ByteSized Mysteries" in snippet
    assert tomllib.loads(toml_snippet([]))["seed_channels"] == []


def test_cli_suggest_seeds(tmp_path, capsys):
    db_path = tmp_path / "r.db"
    assert cli.main(["--db", str(db_path), "run", "--fixture", "--out", str(tmp_path / "out")]) == 0
    capsys.readouterr()
    assert cli.main(["--db", str(db_path), "suggest-seeds", "--min-score", "40", "--top", "5"]) == 0
    out = capsys.readouterr().out
    assert "seed_channels = [" in out and "UCbytesized" in out and "UCkitchen" not in out
