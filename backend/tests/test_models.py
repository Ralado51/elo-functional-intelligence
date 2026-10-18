from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session as DBSession
from sqlalchemy.exc import IntegrityError
import pytest

from app.models import Base, Case, Session


def test_schema_and_foreign_keys():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    with engine.connect() as conn:
        conn.exec_driver_sql("PRAGMA foreign_keys=ON")
        Base.metadata.create_all(conn)
        assert set(inspect(conn).get_table_names()) == {"cases", "sessions", "organizations", "professionals", "patients", "guardians", "patient_guardians", "observations", "observation_review_events", "family_reports"}
        review_fks = inspect(conn).get_foreign_keys("observation_review_events")
        assert {fk["referred_table"] for fk in review_fks} == {"observations", "professionals"}
        conn.commit()
        with DBSession(bind=conn) as db:
            db.add(Case(id="OT-001", created_at="2026-10-15T00:00:00+00:00"))
            db.add(Session(id="00000000-0000-0000-0000-000000000001", case_id="OT-001", notes="synthetic", duration_minutes=40, created_at="2026-10-15T00:00:00+00:00", status="draft"))
            db.commit()
            assert db.query(Session).count() == 1
            db.add(Session(id="00000000-0000-0000-0000-000000000002", case_id="OT-001", notes="synthetic", duration_minutes=30, created_at="2026-10-15T00:00:00+00:00", status="draft"))
            with pytest.raises(IntegrityError):
                db.commit()
