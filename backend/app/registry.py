"""Synthetic-only clinical registry API. No authentication or tenant authorization yet."""
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError

from app.database import db, one, all_rows, execute

router = APIRouter(prefix="/registry", tags=["synthetic-registry"])


def now():
    return datetime.now(timezone.utc).isoformat()


def required(conn, table, identifier):
    # Table names are static internal constants, never user-controlled.
    row = one(conn, f"SELECT * FROM {table} WHERE id=:id", {"id": identifier})
    if row is None:
        raise HTTPException(404, f"{table} not found")
    return row


def create(conn, table, values):
    cols = ", ".join(values)
    placeholders = ", ".join(":" + col for col in values)
    execute(conn, f"INSERT INTO {table} ({cols}) VALUES ({placeholders})", values)


class OrganizationInput(BaseModel):
    name: str = Field(min_length=2, max_length=160)


class PersonInput(BaseModel):
    organization_id: str
    display_name: str = Field(min_length=2, max_length=160)


class PatientInput(BaseModel):
    organization_id: str
    synthetic_code: str = Field(min_length=2, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")


class GuardianLink(BaseModel):
    guardian_id: str
    relationship: str = Field(min_length=2, max_length=60)


class CaseLink(BaseModel):
    patient_id: str


class ObservationInput(BaseModel):
    source_excerpt: str = Field(min_length=1)
    functional_domain: str = Field(min_length=2, max_length=80)
    observation_text: str = Field(min_length=1)


@router.post("/organizations", status_code=201)
def add_organization(payload: OrganizationInput):
    record = {"id": str(uuid4()), "name": payload.name, "created_at": now()}
    with db() as conn:
        create(conn, "organizations", record)
    return record


@router.get("/organizations")
def organizations():
    with db() as conn:
        return all_rows(conn, "SELECT * FROM organizations ORDER BY created_at DESC")


@router.post("/professionals", status_code=201)
def add_professional(payload: PersonInput):
    record = {"id": str(uuid4()), **payload.model_dump(), "created_at": now()}
    with db() as conn:
        required(conn, "organizations", payload.organization_id)
        create(conn, "professionals", record)
    return record


@router.get("/organizations/{organization_id}/professionals")
def professionals(organization_id: str):
    with db() as conn:
        required(conn, "organizations", organization_id)
        return all_rows(conn, "SELECT * FROM professionals WHERE organization_id=:id ORDER BY created_at DESC", {"id": organization_id})


@router.post("/patients", status_code=201)
def add_patient(payload: PatientInput):
    record = {"id": str(uuid4()), **payload.model_dump(), "created_at": now()}
    try:
        with db() as conn:
            required(conn, "organizations", payload.organization_id)
            create(conn, "patients", record)
    except IntegrityError:
        raise HTTPException(409, "Synthetic patient code already exists in organization")
    return record


@router.get("/organizations/{organization_id}/patients")
def patients(organization_id: str):
    with db() as conn:
        required(conn, "organizations", organization_id)
        return all_rows(conn, "SELECT * FROM patients WHERE organization_id=:id ORDER BY created_at DESC", {"id": organization_id})


@router.post("/guardians", status_code=201)
def add_guardian(payload: PersonInput):
    record = {"id": str(uuid4()), **payload.model_dump(), "created_at": now()}
    with db() as conn:
        required(conn, "organizations", payload.organization_id)
        create(conn, "guardians", record)
    return record


@router.get("/organizations/{organization_id}/guardians")
def guardians(organization_id: str):
    with db() as conn:
        required(conn, "organizations", organization_id)
        return all_rows(conn, "SELECT * FROM guardians WHERE organization_id=:id ORDER BY created_at DESC", {"id": organization_id})


@router.post("/patients/{patient_id}/guardians", status_code=201)
def link_guardian(patient_id: str, payload: GuardianLink):
    with db() as conn:
        patient = required(conn, "patients", patient_id)
        guardian = required(conn, "guardians", payload.guardian_id)
        if patient["organization_id"] != guardian["organization_id"]:
            raise HTTPException(409, "Patient and guardian must belong to the same organization")
        try:
            create(conn, "patient_guardians", {"patient_id": patient_id, **payload.model_dump()})
        except IntegrityError:
            raise HTTPException(409, "Guardian already linked to patient")
    return {"patient_id": patient_id, **payload.model_dump()}


@router.get("/patients/{patient_id}/guardians")
def patient_guardians(patient_id: str):
    with db() as conn:
        required(conn, "patients", patient_id)
        return all_rows(conn, """SELECT g.id, g.organization_id, g.display_name, pg.relationship
            FROM patient_guardians pg JOIN guardians g ON g.id=pg.guardian_id
            WHERE pg.patient_id=:id ORDER BY g.display_name""", {"id": patient_id})


@router.post("/cases/{case_id}/patient")
def link_case(case_id: str, payload: CaseLink):
    with db() as conn:
        required(conn, "cases", case_id)
        required(conn, "patients", payload.patient_id)
        current = one(conn, "SELECT patient_id FROM cases WHERE id=:id", {"id": case_id})
        if current["patient_id"] is not None and current["patient_id"] != payload.patient_id:
            raise HTTPException(409, "Case already linked to another patient")
        execute(conn, "UPDATE cases SET patient_id=:patient_id WHERE id=:id", {"patient_id": payload.patient_id, "id": case_id})
    return {"case_id": case_id, "patient_id": payload.patient_id}


@router.get("/patients/{patient_id}/cases")
def patient_cases(patient_id: str):
    with db() as conn:
        required(conn, "patients", patient_id)
        return all_rows(conn, "SELECT * FROM cases WHERE patient_id=:id ORDER BY created_at DESC", {"id": patient_id})


@router.post("/sessions/{session_id}/observations", status_code=201)
def add_observation(session_id: str, payload: ObservationInput):
    with db() as conn:
        session = required(conn, "sessions", session_id)
        if session["status"] == "approved":
            raise HTTPException(409, "Approved sessions are immutable")
        if payload.source_excerpt not in session["notes"]:
            raise HTTPException(422, "Evidence excerpt must appear verbatim in session notes")
        record = {"id": str(uuid4()), "session_id": session_id, **payload.model_dump(),
                  "review_status": "pending", "created_at": now()}
        create(conn, "observations", record)
    return record


@router.get("/sessions/{session_id}/observations")
def observations(session_id: str):
    with db() as conn:
        required(conn, "sessions", session_id)
        return all_rows(conn, "SELECT * FROM observations WHERE session_id=:id ORDER BY created_at", {"id": session_id})
