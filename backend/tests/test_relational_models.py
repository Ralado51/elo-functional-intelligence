from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession
import pytest

from app.models import Base, Organization, Patient, Guardian, PatientGuardian, Case, Session, Observation


def test_patient_guardian_and_observation_relationships():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    with engine.connect() as conn:
        conn.exec_driver_sql("PRAGMA foreign_keys=ON")
        Base.metadata.create_all(conn)
        with DBSession(bind=conn) as db:
            db.add(Organization(id="org-1", name="Synthetic Clinic", created_at="2026-10-16"))
            db.flush()  # Parent organization must exist before dependent records.
            db.add(Patient(id="p-1", organization_id="org-1", synthetic_code="PAT-001", created_at="2026-10-16"))
            db.add(Guardian(id="g-1", organization_id="org-1", display_name="Synthetic Guardian", created_at="2026-10-16"))
            db.flush()  # Persist patient and guardian before association rows.
            db.add(PatientGuardian(patient_id="p-1", guardian_id="g-1", relationship="parent"))
            db.add(Case(id="OT-001", patient_id="p-1", created_at="2026-10-16"))
            db.flush()
            db.add(Session(id="session-1", case_id="OT-001", notes="synthetic", duration_minutes=40, created_at="2026-10-16", status="draft"))
            db.flush()
            db.add(Observation(id="obs-1", session_id="session-1", source_excerpt="synthetic evidence", functional_domain="participation", observation_text="synthetic observation", review_status="pending", created_at="2026-10-16"))
            db.commit()
            assert db.query(Observation).count() == 1
            assert db.query(PatientGuardian).count() == 1


def test_patient_code_unique_per_organization():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    with engine.connect() as conn:
        conn.exec_driver_sql("PRAGMA foreign_keys=ON")
        Base.metadata.create_all(conn)
        with DBSession(bind=conn) as db:
            db.add(Organization(id="org-1", name="Synthetic Clinic", created_at="2026-10-16"))
            db.add(Patient(id="p-1", organization_id="org-1", synthetic_code="PAT-001", created_at="2026-10-16"))
            db.commit()
            db.add(Patient(id="p-2", organization_id="org-1", synthetic_code="PAT-001", created_at="2026-10-16"))
            with pytest.raises(IntegrityError):
                db.commit()
