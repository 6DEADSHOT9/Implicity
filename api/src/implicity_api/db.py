import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url

PROJECT_ROOT = Path(__file__).resolve().parents[3]


def database_url() -> str:
    configured_url = os.getenv("DATABASE_URL")
    url = (
        make_url(configured_url)
        if configured_url
        else make_url(f"sqlite:///{PROJECT_ROOT / 'data' / 'implicity.db'}")
    )
    if url.get_backend_name() == "sqlite" and url.database not in (
        None,
        "",
        ":memory:",
    ):
        path = Path(url.database)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        path.parent.mkdir(parents=True, exist_ok=True)
        url = url.set(database=str(path.resolve()))
    return url.render_as_string(hide_password=False)


engine = create_engine(database_url())
