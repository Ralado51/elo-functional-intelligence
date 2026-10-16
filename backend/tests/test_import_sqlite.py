import sqlite3
import pytest
from sqlalchemy import create_engine, text
from app.models import Base
from scripts.import_sqlite import source_rows, import_backup


def test_source_rows_preserve_all_fields(tmp_path):
    path = tmp_path / "source.db"
    with sqlite3.connect(path) as db:
        db.executescript("""
            CREATE TABLE cases(id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
            CREATE TABLE sessions(id TEXT PRIMARY KEY, case_id TEXT, notes TEXT,
              duration_minutes INTEGER, created_at TEXT, status TEXT,
              extraction_json TEXT, reviewed_text TEXT, approved_at TEXT);
            INSERT INTO cases VALUES ('OT-001','2026-10-15');
            INSERT INTO sessions VALUES ('abc','OT-001','synthetic notes',40,
              '2026-10-15','approved',NULL,'reviewed','2026-10-15');
        """)
    cases, sessions = source_rows(path)
    assert len(cases) == 1 and len(sessions) == 1
    assert sessions[0]["reviewed_text"] == "reviewed"
    assert sessions[0]["status"] == "approved"


def test_missing_sqlite_fails_closed(tmp_path):
    with pytest.raises(sqlite3.OperationalError):
        source_rows(tmp_path / "missing.db")
