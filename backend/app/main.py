from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Elo Functional Intelligence API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

class SessionInput(BaseModel):
    case_id: str = Field(min_length=1)
    notes: str = Field(min_length=10)
    duration_minutes: Literal[40] = 40

class Observation(BaseModel):
    category: str
    description: str
    evidence: str
    requires_review: bool = True

class Extraction(BaseModel):
    observations: list[Observation] = []
    missing_information: list[str] = []
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

class ApprovalInput(BaseModel):
    reviewed_text: str = Field(min_length=1)

sessions: dict[str, SessionRecord] = {}

@app.get("/health")
def health():
    return {"status": "ok", "mode": "mock", "amd_inference": False}

@app.post("/sessions", response_model=SessionRecord, status_code=201)
def create_session(payload: SessionInput):
    record = SessionRecord(id=str(uuid4()), case_id=payload.case_id, notes=payload.notes,
        duration_minutes=payload.duration_minutes, created_at=datetime.now(timezone.utc), status="draft")
    sessions[record.id] = record
    return record

@app.get("/sessions/{session_id}", response_model=SessionRecord)
def get_session(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return sessions[session_id]

@app.post("/sessions/{session_id}/extract", response_model=SessionRecord)
def extract(session_id: str):
    record = get_session(session_id)
    if record.status == "approved":
        raise HTTPException(status_code=409, detail="Approved sessions cannot be reprocessed")
    # Mock is intentionally non-generative: no fictitious model claims or inferred observations.
    record.extraction = Extraction(missing_information=[
        "Extraction not performed: AMD Token Factory credentials are pending.",
        "Clinical objectives and baseline require professional confirmation.",
    ])
    record.status = "pending"
    return record

@app.post("/sessions/{session_id}/approve", response_model=SessionRecord)
def approve(session_id: str, payload: ApprovalInput):
    record = get_session(session_id)
    if record.status != "pending":
        raise HTTPException(status_code=409, detail="Session must be pending review")
    record.reviewed_text = payload.reviewed_text
    record.status = "approved"
    return record
