"""[channel] and [production] settings, kept apart from the radar's analysis Settings."""
from __future__ import annotations

import os
import tomllib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping

from radar.config import DEFAULT_CONFIG_PATH, PROJECT_ROOT, ConfigError, read_dotenv


@dataclass
class ProductionConfig:
    channel_name: str = "디지털 생존노트"
    engine: str = "remotion"
    backend: str = "edge"
    edge_voice: str = "ko-KR-SunHiNeural"
    edge_rate: str = "+15%"
    google_voice: str = "ko-KR-Neural2-A"
    google_rate: float = 1.15
    font_file: str | None = None
    out_dir: str = "media"
    supertonic_voice: str = "F1"
    supertonic_speed: float = 1.15
    supertonic_steps: int = 16
    tts_python: str = ".venv-tts/Scripts/python.exe"
    transition: str = "continuity"   # Remotion scene changes: continuity (shared-element morph) | classic (slide/fade)
    google_api_key: str | None = field(default=None, repr=False)  # never printed


TRANSITIONS = ("continuity", "classic")


def _transition(value) -> str:
    value = str(value).strip().lower()
    if value not in TRANSITIONS:
        raise ConfigError(f"[production] transition must be one of {', '.join(TRANSITIONS)}, got '{value}'")
    return value


def load_production_config(config_path: str | Path | None = None, env: Mapping[str, str] | None = None,
                           dotenv_path: str | Path | None = None) -> ProductionConfig:
    path = Path(config_path) if config_path else DEFAULT_CONFIG_PATH
    if not path.is_file():
        raise ConfigError(f"config file not found: {path}")
    with path.open("rb") as fh:
        raw = tomllib.load(fh)
    merged = read_dotenv(Path(dotenv_path) if dotenv_path else PROJECT_ROOT / ".env")
    merged.update(os.environ if env is None else env)
    ch, pr = raw.get("channel", {}), raw.get("production", {})
    d = ProductionConfig()
    return ProductionConfig(
        channel_name=str(ch.get("name", d.channel_name)),
        engine=str(pr.get("engine", d.engine)),
        backend=str(pr.get("backend", d.backend)),
        edge_voice=str(pr.get("edge_voice", d.edge_voice)),
        edge_rate=str(pr.get("edge_rate", d.edge_rate)),
        google_voice=str(pr.get("google_voice", d.google_voice)),
        google_rate=float(pr.get("google_rate", d.google_rate)),
        font_file=pr.get("font_file") or None,
        out_dir=str(pr.get("out_dir", d.out_dir)),
        supertonic_voice=str(pr.get("supertonic_voice", d.supertonic_voice)),
        supertonic_speed=float(pr.get("supertonic_speed", d.supertonic_speed)),
        supertonic_steps=int(pr.get("supertonic_steps", d.supertonic_steps)),
        tts_python=str(pr.get("tts_python", d.tts_python)),
        transition=_transition(pr.get("transition", d.transition)),
        google_api_key=merged.get("GOOGLE_TTS_API_KEY") or None,
    )
