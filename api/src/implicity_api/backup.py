import asyncio
import logging
import os
import re
import sqlite3
import sys
import tempfile
from contextlib import closing
from datetime import date, datetime, time, timedelta
from pathlib import Path

from sqlalchemy.engine import make_url

from implicity_api.db import database_url

logger = logging.getLogger(__name__)
SNAPSHOT_NAME = re.compile(r"^(\d{4}-\d{2}-\d{2})\.db$")


def database_path(url: str | None = None) -> Path:
    parsed = make_url(url or database_url())
    if parsed.get_backend_name() != "sqlite" or parsed.database in (
        None,
        "",
        ":memory:",
    ):
        raise ValueError("A file-backed SQLite database is required for backups")
    path = Path(parsed.database)
    if not path.is_absolute():
        path = Path(__file__).resolve().parents[3] / path
    return path.resolve()


def backup_database(
    database: Path, directory: Path | None = None, day: date | None = None
) -> Path:
    database = database.resolve()
    if not database.is_file():
        raise FileNotFoundError(database)
    directory = directory or database.parent / "backups"
    directory.mkdir(parents=True, exist_ok=True)
    destination = directory / f"{(day or date.today()).isoformat()}.db"
    descriptor, temp_name = tempfile.mkstemp(
        prefix=".backup-", suffix=".tmp", dir=directory
    )
    os.close(descriptor)
    temp = Path(temp_name)
    try:
        with closing(
            sqlite3.connect(f"{database.as_uri()}?mode=ro", uri=True)
        ) as source:
            with closing(sqlite3.connect(temp)) as target:
                source.backup(target)
        os.replace(temp, destination)
    finally:
        temp.unlink(missing_ok=True)

    snapshots = []
    for candidate in directory.iterdir():
        match = SNAPSHOT_NAME.fullmatch(candidate.name)
        if match and candidate.is_file():
            try:
                snapshots.append((date.fromisoformat(match[1]), candidate))
            except ValueError:
                continue
    for _, old_snapshot in sorted(snapshots, reverse=True)[7:]:
        old_snapshot.unlink()
    return destination


async def daily_backups(now=datetime.now, sleep=asyncio.sleep) -> None:
    while True:
        current = now()
        try:
            database = database_path()
            directory = database.parent / "backups"
            expected = directory / f"{current.date().isoformat()}.db"
            if not expected.exists():
                await asyncio.to_thread(
                    backup_database, database, directory, current.date()
                )
        except Exception:
            logger.exception("Daily SQLite backup failed")
        tomorrow = datetime.combine(current.date() + timedelta(days=1), time.min)
        await sleep(max(0.0, (tomorrow - current).total_seconds()))


def main() -> None:
    try:
        backup_database(database_path())
    except Exception as error:
        print(f"SQLite backup failed: {error}", file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
