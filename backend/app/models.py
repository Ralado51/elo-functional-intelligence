"""Proposed PostgreSQL persistence schema; not yet wired to the existing API."""
from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class Case(Base):
    __tablename__ = "cases"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    patient_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("patients.id"), nullable=True, index=True)


class Session(Base):
    __tablename__ = "sessions"
    __table_args__ = (CheckConstraint("duration_minutes = 40", name="ck_session_40_minutes"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    case_id: Mapped[str] = mapped_column(String(80), ForeignKey("cases.id"), nullable=False, index=True)
    notes: Mapped[str] = mapped_column(Text, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    extraction_json: Mapped[str | None] = mapped_column(Text)
    reviewed_text: Mapped[str | None] = mapped_column(Text)
    approved_at: Mapped[str | None] = mapped_column(Text)


class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)


class Professional(Base):
    __tablename__ = "professionals"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(160), nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)


class Patient(Base):
    __tablename__ = "patients"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    synthetic_code: Mapped[str] = mapped_column(String(80), nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    __table_args__ = (UniqueConstraint("organization_id", "synthetic_code", name="uq_patient_code_per_org"),)


class Guardian(Base):
    __tablename__ = "guardians"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id"), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(160), nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)


class PatientGuardian(Base):
    __tablename__ = "patient_guardians"
    patient_id: Mapped[str] = mapped_column(String(36), ForeignKey("patients.id"), primary_key=True)
    guardian_id: Mapped[str] = mapped_column(String(36), ForeignKey("guardians.id"), primary_key=True)
    relationship: Mapped[str] = mapped_column(String(60), nullable=False)


class Observation(Base):
    __tablename__ = "observations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("sessions.id"), nullable=False, index=True)
    source_excerpt: Mapped[str] = mapped_column(Text, nullable=False)
    functional_domain: Mapped[str] = mapped_column(String(80), nullable=False)
    observation_text: Mapped[str] = mapped_column(Text, nullable=False)
    review_status: Mapped[str] = mapped_column(String(24), nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    reviewed_text: Mapped[str | None] = mapped_column(Text)
    reviewed_at: Mapped[str | None] = mapped_column(Text)
    reviewed_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("professionals.id"))
    reviewed_domain: Mapped[str | None] = mapped_column(String(80))


class ObservationReviewEvent(Base):
    __tablename__ = "observation_review_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    observation_id: Mapped[str] = mapped_column(String(36), ForeignKey("observations.id"), nullable=False, index=True)
    reviewer_id: Mapped[str] = mapped_column(String(36), ForeignKey("professionals.id"), nullable=False)
    decision: Mapped[str] = mapped_column(String(20), nullable=False)
    previous_status: Mapped[str] = mapped_column(String(24), nullable=False)
    previous_text: Mapped[str] = mapped_column(Text, nullable=False)
    previous_domain: Mapped[str | None] = mapped_column(String(80))
    reviewed_domain: Mapped[str | None] = mapped_column(String(80))
    reviewed_text: Mapped[str | None] = mapped_column(Text)
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
