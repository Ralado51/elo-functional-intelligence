"""Import an offline SQLite backup into an EMPTY, Alembic-migrated PostgreSQL DB.

All-or-nothing transaction. No source modifications. Never prints clinical text.
"""
import argparse
import os
import sqlite3
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

FIELDS = ("id", "case_id", "notes", "duration_minutes", "created_at", "status",
          "extraction_json", "reviewed_text", "approved_at")
CASE_FIELDS = ("id", "created_at")


def source_rows(path):
    uri = Path(path).resolve().as_uri() + "?mode=ro"
    with sqlite3.connect(uri, uri=True) as source:
        source.row_factory = sqlite3.Row
        integrity = source.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise RuntimeError("SQLite integrity check failed")
        cases = [dict(row) for row in source.execute("SELECT id, created_at FROM cases ORDER BY id")]
        sessions = [dict(row) for row in source.execute(
            "SELECT " + ", ".join(FIELDS) + " FROM sessions ORDER BY id")]
    if any(row["duration_minutes"] != 40 for row in sessions):
        raise RuntimeError("Invalid duration in SQLite source")
    if any(row["case_id"] not in {case["id"] for case in cases} for row in sessions):
        raise RuntimeError("Orphan session in SQLite source")
    return cases, sessions


def import_backup(sqlite_path, database_url, *, execute=False):
    cases, sessions = source_rows(sqlite_path)
    engine = create_engine(database_url)
    try:
        with Session(engine) as db:
            # Require an already-migrated schema and a truly empty target.
            if db.execute(text("SELECT count(*) FROM cases")).scalar_one() != 0:
                raise RuntimeError("Target cases table is not empty; import aborted")
            if db.execute(text("SELECT count(*) FROM sessions")).scalar_one() != 0:
                raise RuntimeError("Target sessions table is not empty; import aborted")
            if not execute:
                return {"cases": len(cases), "sessions": len(sessions), "mode": "dry-run"}
            with db.begin_nested():
                for row in cases:
                    db.execute(text("INSERT INTO cases (id, created_at) VALUES (:id, :created_at)"), row)
                columns = ", ".join(FIELDS)
                params = ", ".join(":" + name for name in FIELDS)
                statement = text(f"INSERT INTO sessions ({columns}) VALUES ({params})")
                for row in sessions:
                    db.execute(statement, row)
                if db.execute(text("SELECT count(*) FROM cases")).scalar_one() != len(cases):
                    raise RuntimeError("Case count mismatch")
                if db.execute(text("SELECT count(*) FROM sessions")).scalar_one() != len(sessions):
                    raise RuntimeError("Session count mismatch")
                target_status = dict(db.execute(text(
                    "SELECT status, count(*) FROM sessions GROUP BY status")).all())
                source_status = {}
                for row in sessions:
                    source_status[row["status"]] = source_status.get(row["status"], 0) + 1
                if target_status != source_status:
                    raise RuntimeError("Status count mismatch")
                # Compare all fields in-memory without logging their contents.
                target = {row["id"]: dict(row) for row in db.execute(text(
                    "SELECT " + columns + " FROM sessions")).mappings()}
                if target != {row["id"]: row for row in sessions}:
                    raise RuntimeError("Session field mismatch")
            db.commit()
            return {"cases": len(cases), "sessions": len(sessions), "mode": "imported"}
    finally:
        engine.dispose()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sqlite", required=True, help="Read-only SQLite backup")
    parser.add_argument("--execute", action="store_true", help="Actually import into empty PostgreSQL")
    args = parser.parse_args()
    url = os.environ.get("ELO_DATABASE_URL", "")
    if not url.startswith("postgresql+psycopg://"):
        parser.error("ELO_DATABASE_URL must be a postgresql+psycopg URL")
    result = import_backup(args.sqlite, url, execute=args.execute)
    print(f"{result['mode']}: {result['cases']} cases, {result['sessions']} sessions")


if __name__ == "__main__":
    main()
