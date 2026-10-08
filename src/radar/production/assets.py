"""Third-party asset ledger (assets/manifest.json).

Every downloaded asset (music today; images/SFX later) is recorded with its source page, direct
URL, license name, a dated license snapshot, whether attribution is required, and a SHA-256 of
the file. The files themselves stay out of git (licenses like Mixkit's forbid redistributing the
items as files); `radar assets fetch` re-downloads them on a new machine and verifies the hashes.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import requests

from radar.config import PROJECT_ROOT

MANIFEST = PROJECT_ROOT / "assets" / "manifest.json"
USER_AGENT = {"User-Agent": "Mozilla/5.0 (global-shorts-radar asset fetch)"}


class AssetError(RuntimeError):
    pass


def load_manifest(path: Path = MANIFEST) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {"music": []}


def save_manifest(data: dict, path: Path = MANIFEST) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1 << 16), b""):
            h.update(block)
    return h.hexdigest()


def fetch(path: Path = MANIFEST, session=None) -> list[str]:
    """Download missing files, verify existing ones. Returns log lines; raises on a hash mismatch."""
    data = load_manifest(path)
    session = session or requests.Session()
    lines = []
    for kind, items in data.items():
        for item in items:
            target = PROJECT_ROOT / item["file"]
            if not target.is_file():
                target.parent.mkdir(parents=True, exist_ok=True)
                resp = session.get(item["url"], headers=USER_AGENT, timeout=60)
                if resp.status_code != 200 or len(resp.content) < 10_000:
                    raise AssetError(f"{item['id']}: download failed (HTTP {resp.status_code}, {len(resp.content)} bytes)")
                target.write_bytes(resp.content)
                item.setdefault("retrieved_at", datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
                lines.append(f"downloaded {item['id']} -> {item['file']} ({len(resp.content) // 1024} KB)")
            digest = _sha256(target)
            if item.get("sha256") and item["sha256"] != digest:
                raise AssetError(f"{item['id']}: sha256 mismatch (file changed upstream or corrupted)")
            item["sha256"] = digest
            lines.append(f"ok {kind}/{item['id']} [{item['license']}]")
    save_manifest(data, path)
    return lines


def music_for(mood: str, path: Path = MANIFEST) -> dict | None:
    """The first music entry for a mood whose file is present locally."""
    for item in load_manifest(path).get("music", []):
        if item.get("mood") == mood and (PROJECT_ROOT / item["file"]).is_file():
            return item
    return None


def moods(path: Path = MANIFEST) -> list[str]:
    return sorted({m["mood"] for m in load_manifest(path).get("music", [])})
