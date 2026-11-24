import asyncio
import logging
import os
import sqlite3
from datetime import date, datetime, time, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)


def backup_database(database: Path, directory: Path) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    destination = directory / f"{date.today().isoformat()}.db"
    with sqlite3.connect(database) as source, sqlite3.connect(destination) as target:
        source.backup(target)
    for old_backup in sorted(directory.glob("*.db"), reverse=True)[7:]:
        old_backup.unlink()
    return destination


def database_path() -> Path:
    url = os.getenv("DATABASE_URL", "sqlite:///./implicity.db")
    if not url.startswith("sqlite:///"):
        raise ValueError("SQLite is required for file backups")
    return Path(url.removeprefix("sqlite:///"))


async def daily_backups() -> None:
    while True:
        tomorrow = datetime.combine(date.today() + timedelta(days=1), time.min)
        await asyncio.sleep((tomorrow - datetime.now()).total_seconds())
        try:
            await asyncio.to_thread(backup_database, database_path(), Path("backups"))
        except Exception:
            logger.exception("Daily SQLite backup failed")


def main() -> None:
    backup_database(database_path(), Path("backups"))
