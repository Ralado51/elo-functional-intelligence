"""Database connection layer. PostgreSQL requires Alembic migrations before startup."""
import os
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path

from sqlalchemy import create_engine, text
from app.models import Base


def database_url():
    configured = os.getenv("ELO_DATABASE_URL")
    if configured:
        return configured
    path = os.getenv("ELO_DB_PATH", str(Path(__file__).resolve().parents[1] / "data" / "elo.db"))
    if path == ":memory:":
        return "sqlite+pysqlite:///:memory:"
    return "sqlite+pysqlite:///" + str(Path(path).resolve()).replace("\\", "/")


@lru_cache(maxsize=32)
def engine_for(url):
    if url.startswith("sqlite"):
        path = url.split("///", 1)[-1]
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        engine = create_engine(url, connect_args={"timeout": 10})
        from sqlalchemy import event
        @event.listens_for(engine, "connect")
        def enable_foreign_keys(dbapi_conn, _):
            dbapi_conn.execute("PRAGMA foreign_keys=ON")
        Base.metadata.create_all(engine)
        return engine
    if not url.startswith("postgresql+psycopg://"):
        raise RuntimeError("Unsupported ELO_DATABASE_URL driver")
    return create_engine(url, pool_pre_ping=True)


@contextmanager
def db():
    with engine_for(database_url()).begin() as connection:
        yield connection


def one(connection, sql, params=None):
    row = connection.execute(text(sql), params or {}).mappings().first()
    return dict(row) if row else None


def all_rows(connection, sql, params=None):
    return [dict(row) for row in connection.execute(text(sql), params or {}).mappings().all()]


def execute(connection, sql, params=None):
    return connection.execute(text(sql), params or {})
