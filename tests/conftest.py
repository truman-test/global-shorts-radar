from datetime import datetime, timezone

import pytest

from radar.config import load_settings
from radar.storage.db import Database

NOW = datetime(2026, 10, 3, tzinfo=timezone.utc)


@pytest.fixture
def settings():
    return load_settings(env={}, dotenv_path="/nonexistent/.env")


@pytest.fixture
def db():
    d = Database(":memory:")
    d.init_schema()
    yield d
    d.close()


@pytest.fixture
def now():
    return NOW
