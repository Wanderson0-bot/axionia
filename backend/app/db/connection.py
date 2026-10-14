"""PostgreSQL connection pool for API runtime."""
from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path

from dotenv import load_dotenv
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=True)


def _database_url() -> str:
    value = os.environ.get("DATABASE_URL")
    if not value:
        raise RuntimeError("DATABASE_URL não está definida")
    return value


class HybridRow(dict):
    def __getitem__(self, key):
        if isinstance(key, int):
            key = tuple(self.keys())[key]
        return super().__getitem__(key)


def _row_factory(cursor):
    factory = dict_row(cursor)
    return lambda values: HybridRow(factory(values))


pool = ConnectionPool(
    conninfo=_database_url,
    min_size=1,
    max_size=10,
    kwargs={"row_factory": _row_factory},
    open=False,
)


def open_pool() -> None:
    pool.open(wait=True)


def close_pool() -> None:
    if not pool.closed:
        pool.close()


@contextmanager
def connection():
    """Borrow a pooled connection; commit on success and rollback on error."""
    with pool.connection() as db:
        yield db
