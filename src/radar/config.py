"""Configuration loading: TOML for tunable parameters, environment for secrets."""
from __future__ import annotations

import os
import tomllib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "config" / "radar.toml"
DEFAULT_DB_PATH = "data/radar.db"


class ConfigError(ValueError):
    pass


@dataclass
class Settings:
    keywords: list[str]
    seed_channels: list[str]
    regions: list[str]
    relevance_language: str | None
    exclude_channel_countries: list[str]
    max_results_per_query: int
    published_within_hours: int
    recent_uploads_per_channel: int
    quota_budget: int
    candidate_window_hours: float
    max_short_seconds: int
    min_baseline_videos: int
    baseline_min_age_hours: float
    min_baseline_median_views: float
    freshness_half_life_hours: float
    weights_version: str
    weights: dict[str, float]
    outlier_cap: float
    velocity_cap: float
    top_n: int
    max_age_hours: float
    min_views: int
    min_outlier_ratio: float
    min_radar_score: float
    topic_categories: list[str]
    topic_lexicon: dict[str, list[str]]
    region_specific_terms: list[str]
    universal_terms: list[str]
    korean_terms: dict[str, str]
    db_path: str = DEFAULT_DB_PATH
    api_key: str | None = field(default=None, repr=False)  # never printed

    @property
    def has_api_key(self) -> bool:
        return bool(self.api_key)


def _string_list(value, name: str) -> list[str]:
    """TOML lets a user write "IN" where ["IN"] was meant; iterating a string would yield letters."""
    if isinstance(value, str) or not isinstance(value, (list, tuple)):
        raise ConfigError(f'{name} must be a list of strings, e.g. ["IN"], got {value!r}')
    return [str(v) for v in value]


def read_dotenv(path: Path) -> dict[str, str]:
    """Minimal .env parser (KEY=VALUE lines). Values are not logged anywhere."""
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def load_settings(
    config_path: str | Path | None = None,
    env: Mapping[str, str] | None = None,
    dotenv_path: str | Path | None = None,
) -> Settings:
    path = Path(config_path) if config_path else DEFAULT_CONFIG_PATH
    if not path.is_file():
        raise ConfigError(f"config file not found: {path}")
    with path.open("rb") as fh:
        raw = tomllib.load(fh)

    merged_env: dict[str, str] = read_dotenv(Path(dotenv_path) if dotenv_path else PROJECT_ROOT / ".env")
    merged_env.update(os.environ if env is None else env)

    try:
        collect, metrics, scoring = raw["collect"], raw["metrics"], raw["scoring"]
        lexicon = raw.get("lexicon", {})
        filt = raw.get("filter", {})
        settings = Settings(
            keywords=list(collect["keywords"]),
            seed_channels=_string_list(collect.get("seed_channels", []), "collect.seed_channels"),
            regions=list(collect["regions"]),
            relevance_language=(str(collect["relevance_language"]) or None) if collect.get("relevance_language") else None,
            exclude_channel_countries=[c.upper() for c in _string_list(collect.get("exclude_channel_countries", []), "collect.exclude_channel_countries")],
            max_results_per_query=int(collect["max_results_per_query"]),
            published_within_hours=int(collect["published_within_hours"]),
            recent_uploads_per_channel=int(collect["recent_uploads_per_channel"]),
            quota_budget=int(collect["quota_budget"]),
            candidate_window_hours=float(collect.get("candidate_window_hours", 72)),
            max_short_seconds=int(metrics["max_short_seconds"]),
            min_baseline_videos=int(metrics["min_baseline_videos"]),
            baseline_min_age_hours=float(metrics["baseline_min_age_hours"]),
            min_baseline_median_views=float(metrics.get("min_baseline_median_views", 0)),
            freshness_half_life_hours=float(metrics["freshness_half_life_hours"]),
            weights_version=str(scoring["weights_version"]),
            weights={k: float(v) for k, v in scoring["weights"].items()},
            outlier_cap=float(scoring["outlier_cap"]),
            velocity_cap=float(scoring["velocity_cap"]),
            top_n=int(raw.get("report", {}).get("top_n", 20)),
            max_age_hours=float(filt.get("max_age_hours", 240)),
            min_views=int(filt.get("min_views", 0)),
            min_outlier_ratio=float(filt.get("min_outlier_ratio", 0)),
            min_radar_score=float(filt.get("min_radar_score", 0)),
            topic_categories=[str(c).lower() for c in _string_list(filt.get("topic_categories", []), "filter.topic_categories")],
            topic_lexicon={k: [t.lower() for t in v] for k, v in lexicon.get("topics", {}).items()},
            region_specific_terms=[t.lower() for t in lexicon.get("region_specific", {}).get("terms", [])],
            universal_terms=[t.lower() for t in lexicon.get("universal", {}).get("terms", [])],
            korean_terms={k.lower(): v for k, v in lexicon.get("korean_terms", {}).items()},
            db_path=merged_env.get("RADAR_DB_PATH") or DEFAULT_DB_PATH,
            api_key=merged_env.get("YOUTUBE_API_KEY") or None,
        )
    except KeyError as exc:
        raise ConfigError(f"missing config key: {exc}") from exc

    from radar.scoring.radar import validate_weights  # local import keeps config free of cycles

    validate_weights(settings.weights)
    unknown = set(settings.topic_categories) - set(settings.topic_lexicon)
    if unknown:
        raise ConfigError(f"filter.topic_categories not in [lexicon.topics]: {sorted(unknown)}")
    if settings.max_results_per_query < 1 or settings.max_results_per_query > 50:
        raise ConfigError("max_results_per_query must be between 1 and 50")
    return settings
