"""Command line entry point: python -m radar <command>"""
from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

from radar import pipeline
from radar.analysis.manual import import_manual_csv
from radar.collectors.fixture import DEFAULT_FIXTURE, FixtureClient
from radar.collectors.youtube import QuotaTracker, YouTubeAPIError, YouTubeClient
from radar.config import ConfigError, load_settings
from radar.metrics.compute import parse_ts, to_iso
from radar.reports.build import build_rows, render_markdown, write_csv
from radar.storage.db import Database


def _make_client(args, settings):
    quota = QuotaTracker(settings.quota_budget)
    if args.fixture:
        return FixtureClient(args.fixture_path or DEFAULT_FIXTURE, quota=quota), "fixture"
    if not settings.has_api_key:
        raise ConfigError("YOUTUBE_API_KEY is not set (env or .env). Use --fixture for an offline run.")
    return YouTubeClient(settings.api_key, quota=quota), "live"


def _now(args, client=None, tracking: bool = False) -> datetime:
    if getattr(args, "now", None):
        now = parse_ts(args.now)
    elif tracking and getattr(client, "fixture_track_now", None):
        now = parse_ts(client.fixture_track_now)
    elif getattr(client, "fixture_now", None):
        now = parse_ts(client.fixture_now)
    else:
        now = datetime.now(timezone.utc)
    if isinstance(client, FixtureClient):
        client.now = to_iso(now)  # fixture serves statistics as of this time
    return now


def _report(db, settings, now, out_dir: Path, run_info=None, since: str | None = None) -> tuple[Path, Path, int]:
    rows = build_rows(db, settings, since)
    last = db.query("SELECT mode FROM runs ORDER BY run_id DESC LIMIT 1")
    mode = "fixture" if last and last[0]["mode"].startswith("fixture") else "live"
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = f"{now:%Y%m%d_%H%M}"
    md = out_dir / f"radar_{stamp}.md"
    md.write_text(render_markdown(rows, generated_at=now, mode=mode, settings=settings, run_info=run_info), encoding="utf-8")
    csv_path = write_csv(rows, out_dir / f"radar_{stamp}.csv")
    return md, csv_path, len(rows)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="radar", description="Global Shorts Radar")
    p.add_argument("--config", help="path to radar.toml")
    p.add_argument("--db", help="SQLite path (default: RADAR_DB_PATH or data/radar.db)")
    p.add_argument("-v", "--verbose", action="store_true")
    sub = p.add_subparsers(dest="command", required=True)

    def add_source_args(sp):
        sp.add_argument("--fixture", action="store_true", help="use offline sample data instead of the API")
        sp.add_argument("--fixture-path", help="custom fixture JSON")
        sp.add_argument("--now", help="override current time (ISO 8601), mainly for fixtures/tests")

    sub.add_parser("init-db", help="create tables")
    add_source_args(sub.add_parser("collect", help="search + fetch observed data"))
    for name in ("compute", "score"):
        sp = sub.add_parser(name)
        sp.add_argument("--now")
    j = sub.add_parser("judge", help="heuristic judgments and/or manual CSV import")
    j.add_argument("--import", dest="import_csv", help="CSV: video_id,dimension,value,rationale,author")
    j.add_argument("--now")
    k = sub.add_parser("korea-gap", help="opt-in: measure KR saturation for top candidates (~101 units each)")
    add_source_args(k)
    k.add_argument("--top", type=int, default=5)
    r = sub.add_parser("report")
    r.add_argument("--out", default="reports")
    r.add_argument("--now")
    r.add_argument("--since", help="only candidates discovered at/after this ISO time (e.g. after a keyword change); "
                                   "default: the candidate window")
    v = sub.add_parser("verify", help="record fact-check status for a candidate")
    v.add_argument("video_id")
    v.add_argument("--status", required=True, choices=["unverified", "in_progress", "verified", "false"])
    v.add_argument("--source", action="append", default=[], help="source URL (repeatable)")
    v.add_argument("--note", default="")
    t = sub.add_parser("track", help="re-observe candidates in the window (videos.list only, cheap) -> report")
    add_source_args(t)
    t.add_argument("--out", default="reports")
    run = sub.add_parser("run", help="collect -> compute -> judge -> score -> report")
    add_source_args(run)
    run.add_argument("--check-korea", type=int, default=0, metavar="N",
                     help="also run the Korea gap check for the top N (costs ~101 units each; default off)")
    run.add_argument("--out", default="reports")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.INFO if args.verbose else logging.WARNING, format="%(levelname)s %(message)s")
    try:
        settings = load_settings(args.config)
        db = Database(args.db or settings.db_path)
        db.init_schema()
        with db:
            return _dispatch(args, settings, db)
    except (ConfigError, YouTubeAPIError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


def _dispatch(args, settings, db) -> int:
    cmd = args.command
    if cmd == "init-db":
        print(f"database ready: {db.path}")
        return 0
    if cmd == "collect":
        client, mode = _make_client(args, settings)
        s = pipeline.collect(client, db, settings, _now(args, client), mode)
        print(f"run #{s.run_id}: {s.searches} searches, {s.candidates} candidates, {s.channels} channels, "
              f"{s.baseline_videos} baseline videos, ~{s.quota_used} quota units")
        for e in s.errors:
            print(f"  warning: {e}")
        return 0
    if cmd == "compute":
        print(f"metrics computed for {pipeline.compute_metrics(db, settings, _now(args))} candidates")
        return 0
    if cmd == "judge":
        now = _now(args)
        if args.import_csv:
            n, errors = import_manual_csv(db, args.import_csv, to_iso(now))
            print(f"imported {n} manual judgments")
            for e in errors:
                print(f"  rejected: {e}")
            return 1 if errors and n == 0 else 0
        print(f"added {pipeline.run_heuristics(db, settings, now)} heuristic_v0 judgments")
        return 0
    if cmd == "korea-gap":
        client, _ = _make_client(args, settings)
        now = _now(args, client)
        for line in pipeline.run_korea_gap(client, db, settings, now, args.top):
            print(line)
        pipeline.score_candidates(db, settings, now)
        print(f"~{client.quota.used} quota units; scores refreshed")
        return 0
    if cmd == "score":
        print(f"scored {pipeline.score_candidates(db, settings, _now(args))} candidates")
        return 0
    if cmd == "report":
        since = to_iso(parse_ts(args.since)) if args.since else None
        md, csv_path, n = _report(db, settings, _now(args), Path(args.out), since=since)
        print(f"{n} candidates -> {md} , {csv_path}")
        return 0
    if cmd == "verify":
        db.set_verification(args.video_id, args.status, to_iso(datetime.now(timezone.utc)), args.source, args.note)
        print(f"{args.video_id}: {args.status}")
        return 0
    if cmd == "track":
        client, mode = _make_client(args, settings)
        now = _now(args, client, tracking=True)
        s = pipeline.track(client, db, settings, now, mode)
        if not s.refreshed:
            print("no candidates in the window to track; run `radar run` first")
            for e in s.errors:
                print(f"  warning: {e}")
            return 0
        pipeline.compute_metrics(db, settings, now)
        pipeline.score_candidates(db, settings, now)
        info = {"run_id": s.run_id, "searches": 0, "candidates": s.refreshed, "quota_used": client.quota.used}
        md, csv_path, n = _report(db, settings, now, Path(args.out), info)
        print(f"track #{s.run_id} ({mode}): {s.refreshed} candidates re-observed, ~{client.quota.used} quota units")
        for e in s.errors:
            print(f"  warning: {e}")
        print(f"report: {md}\ncsv:    {csv_path}")
        return 0
    if cmd == "run":
        client, mode = _make_client(args, settings)
        now = _now(args, client)
        s = pipeline.collect(client, db, settings, now, mode)
        pipeline.compute_metrics(db, settings, now)
        pipeline.run_heuristics(db, settings, now)
        pipeline.score_candidates(db, settings, now)
        if args.check_korea:
            for line in pipeline.run_korea_gap(client, db, settings, now, args.check_korea):
                print(f"  korea-gap {line}")
            pipeline.score_candidates(db, settings, now)
        info = {"run_id": s.run_id, "searches": s.searches, "candidates": s.candidates, "quota_used": client.quota.used}
        md, csv_path, n = _report(db, settings, now, Path(args.out), info)
        print(f"run #{s.run_id} ({mode}): {s.candidates} new candidates, {s.refreshed} re-observed, "
              f"{n} Shorts ranked, ~{client.quota.used} quota units")
        for e in s.errors:
            print(f"  warning: {e}")
        print(f"report: {md}\ncsv:    {csv_path}")
        return 0
    return 1
