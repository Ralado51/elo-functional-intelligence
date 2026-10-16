import json
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError

from app.database import db, one, all_rows, execute, database_url
from app.registry import router as registry_router
from app.review import router as review_router

app = FastAPI(title="Elo Functional Intelligence API", version="0.3.0")
app.include_router(registry_router)
app.include_router(review_router)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

class CaseInput(BaseModel):
    id: str = Field(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")

class CaseRecord(CaseInput):
    created_at: datetime

class SessionInput(BaseModel):
    case_id: str = Field(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")
    notes: str = Field(min_length=10)
    duration_minutes: Literal[40] = 40

class Observation(BaseModel):
    category: str
    description: str
    evidence: str
    requires_review: bool = True

class Extraction(BaseModel):
    observations: list[Observation] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)
    review_status: Literal["pending"] = "pending"

class SessionRecord(BaseModel):
    id: str
    case_id: str
    notes: str
    duration_minutes: int
    created_at: datetime
    status: Literal["draft", "pending", "approved"]
    extraction: Extraction | None = None
    reviewed_text: str | None = None
    approved_at: datetime | None = None

class ApprovalInput(BaseModel):
    reviewed_text: str = Field(min_length=1)

def to_session(row: dict) -> SessionRecord:
    data = dict(row)
    data["extraction"] = json.loads(data.pop("extraction_json")) if data["extraction_json"] else None
    return SessionRecord.model_validate(data)

@app.get("/health")
def health():
    return {"status": "ok", "mode": "mock", "amd_inference": False, "persistence": "postgresql" if database_url().startswith("postgresql") else "sqlite"}


@app.post("/cases", response_model=CaseRecord, status_code=201)
def create_case(payload: CaseInput):
    now = datetime.now(timezone.utc).isoformat()
    try:
        with db() as conn:
            execute(conn, "INSERT INTO cases(id, created_at) VALUES (:id, :now)",
                    {"id": payload.id, "now": now})
    except IntegrityError:
        raise HTTPException(status_code=409, detail="Case already exists")
    return CaseRecord(id=payload.id, created_at=now)


@app.get("/cases", response_model=list[CaseRecord])
def list_cases():
    with db() as conn:
        return [CaseRecord.model_validate(row) for row in all_rows(conn, "SELECT * FROM cases ORDER BY created_at DESC")]


@app.get("/cases/{case_id}/sessions", response_model=list[SessionRecord])
def case_sessions(case_id: str):
    with db() as conn:
        if not one(conn, "SELECT id FROM cases WHERE id=:id", {"id": case_id}):
            raise HTTPException(status_code=404, detail="Case not found")
        return [to_session(row) for row in all_rows(conn,
            "SELECT * FROM sessions WHERE case_id=:id ORDER BY created_at DESC, id DESC", {"id": case_id})]


@app.post("/sessions", response_model=SessionRecord, status_code=201)
def create_session(payload: SessionInput):
    now = datetime.now(timezone.utc).isoformat()
    session_id = str(uuid4())
    with db() as conn:
        execute(conn, "INSERT INTO cases(id, created_at) VALUES (:id, :now) ON CONFLICT (id) DO NOTHING",
                {"id": payload.case_id, "now": now})
        execute(conn, """INSERT INTO sessions(id,case_id,notes,duration_minutes,created_at,status)
            VALUES(:id,:case_id,:notes,40,:now,'draft')""",
            {"id": session_id, "case_id": payload.case_id, "notes": payload.notes, "now": now})
        return to_session(one(conn, "SELECT * FROM sessions WHERE id=:id", {"id": session_id}))


@app.get("/sessions/{session_id}", response_model=SessionRecord)
def get_session(session_id: str):
    with db() as conn:
        row = one(conn, "SELECT * FROM sessions WHERE id=:id", {"id": session_id})
        if row is None:
            raise HTTPException(status_code=404, detail="Session not found")
        return to_session(row)


@app.post("/sessions/{session_id}/extract", response_model=SessionRecord)
def extract(session_id: str):
    extraction = Extraction(missing_information=[
        "Extraction not performed: AMD Token Factory credentials are pending.",
        "Clinical objectives and baseline require professional confirmation.",
    ])
    with db() as conn:
        row = one(conn, "SELECT * FROM sessions WHERE id=:id", {"id": session_id})
        if row is None:
            raise HTTPException(status_code=404, detail="Session not found")
        if row["status"] == "approved":
            raise HTTPException(status_code=409, detail="Approved sessions cannot be reprocessed")
        execute(conn, "UPDATE sessions SET extraction_json=:extraction, status='pending' WHERE id=:id",
                {"extraction": extraction.model_dump_json(), "id": session_id})
        return to_session(one(conn, "SELECT * FROM sessions WHERE id=:id", {"id": session_id}))


@app.post("/sessions/{session_id}/approve", response_model=SessionRecord)
def approve(session_id: str, payload: ApprovalInput):
    with db() as conn:
        row = one(conn, "SELECT * FROM sessions WHERE id=:id", {"id": session_id})
        if row is None:
            raise HTTPException(status_code=404, detail="Session not found")
        if row["status"] != "pending":
            raise HTTPException(status_code=409, detail="Session must be pending review")
        now = datetime.now(timezone.utc).isoformat()
        execute(conn, "UPDATE sessions SET reviewed_text=:reviewed, status='approved', approved_at=:now WHERE id=:id",
                {"reviewed": payload.reviewed_text, "now": now, "id": session_id})
        return to_session(one(conn, "SELECT * FROM sessions WHERE id=:id", {"id": session_id}))
