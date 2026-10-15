import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Elo Functional Intelligence API", version="0.2.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

def database_path() -> str:
    return os.environ.get("ELO_DB_PATH", str(Path(__file__).resolve().parents[1] / "data" / "elo.db"))

@contextmanager
def db():
    path = database_path()
    if path != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=10)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, created_at TEXT NOT NULL)")
        connection.execute("""CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id),
            notes TEXT NOT NULL, duration_minutes INTEGER NOT NULL CHECK(duration_minutes=40),
            created_at TEXT NOT NULL, status TEXT NOT NULL,
            extraction_json TEXT, reviewed_text TEXT, approved_at TEXT
        )""")
        yield connection
        connection.commit()
    finally:
        connection.close()

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

def to_session(row: sqlite3.Row) -> SessionRecord:
    data = dict(row)
    data["extraction"] = json.loads(data.pop("extraction_json")) if data["extraction_json"] else None
    return SessionRecord.model_validate(data)

@app.get("/health")
def health():
    return {"status": "ok", "mode": "mock", "amd_inference": False, "persistence": "sqlite"}

@app.post("/cases", response_model=CaseRecord, status_code=201)
def create_case(payload: CaseInput):
    now = datetime.now(timezone.utc).isoformat()
    with db() as conn:
        try:
            conn.execute("INSERT INTO cases(id, created_at) VALUES (?, ?)", (payload.id, now))
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="Case already exists")
    return CaseRecord(id=payload.id, created_at=now)

@app.get("/cases", response_model=list[CaseRecord])
def list_cases():
    with db() as conn:
        return [CaseRecord.model_validate(dict(row)) for row in conn.execute("SELECT * FROM cases ORDER BY created_at DESC")]

@app.get("/cases/{case_id}/sessions", response_model=list[SessionRecord])
def case_sessions(case_id: str):
    with db() as conn:
        if not conn.execute("SELECT 1 FROM cases WHERE id=?", (case_id,)).fetchone():
            raise HTTPException(status_code=404, detail="Case not found")
        return [to_session(row) for row in conn.execute("SELECT * FROM sessions WHERE case_id=? ORDER BY created_at DESC, id DESC", (case_id,))]

@app.post("/sessions", response_model=SessionRecord, status_code=201)
def create_session(payload: SessionInput):
    now = datetime.now(timezone.utc).isoformat()
    session_id = str(uuid4())
    with db() as conn:
        # Backward-compatible creation of synthetic case identifiers.
        conn.execute("INSERT OR IGNORE INTO cases(id, created_at) VALUES (?, ?)", (payload.case_id, now))
        conn.execute("""INSERT INTO sessions(id,case_id,notes,duration_minutes,created_at,status)
            VALUES(?,?,?,?,?,?)""", (session_id, payload.case_id, payload.notes, 40, now, "draft"))
        row = conn.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone()
        return to_session(row)

@app.get("/sessions/{session_id}", response_model=SessionRecord)
def get_session(session_id: str):
    with db() as conn:
        row = conn.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone()
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
        row = conn.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Session not found")
        if row["status"] == "approved":
            raise HTTPException(status_code=409, detail="Approved sessions cannot be reprocessed")
        conn.execute("UPDATE sessions SET extraction_json=?, status='pending' WHERE id=?",
                     (extraction.model_dump_json(), session_id))
        return to_session(conn.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone())

@app.post("/sessions/{session_id}/approve", response_model=SessionRecord)
def approve(session_id: str, payload: ApprovalInput):
    with db() as conn:
        row = conn.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Session not found")
        if row["status"] != "pending":
            raise HTTPException(status_code=409, detail="Session must be pending review")
        now = datetime.now(timezone.utc).isoformat()
        conn.execute("UPDATE sessions SET reviewed_text=?, status='approved', approved_at=? WHERE id=?",
                     (payload.reviewed_text, now, session_id))
        return to_session(conn.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone())
