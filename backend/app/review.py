"""Human review workflow for synthetic observations.

No authentication/authorization: reviewer_id is a synthetic reference, not verified identity.
Not suitable for real patient data or production clinical records.
"""
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.database import db, one, all_rows, execute

router = APIRouter(prefix="/registry", tags=["synthetic-observation-review"])

class ReviewInput(BaseModel):
    reviewer_id: str
    decision: Literal["approve", "correct", "reject"]
    reviewed_text: str | None = Field(default=None, min_length=1)
    reason: str | None = Field(default=None, min_length=1)
    reviewed_domain: str | None = Field(default=None, min_length=2, max_length=80)

@router.post("/observations/{observation_id}/review")
def review_observation(observation_id: str, payload: ReviewInput):
    if payload.decision == "correct" and not payload.reviewed_text:
        raise HTTPException(422, "Correction requires reviewed_text")
    if payload.decision == "reject" and not payload.reason:
        raise HTTPException(422, "Rejection requires reason")
    if payload.decision != "correct" and payload.reviewed_text is not None:
        raise HTTPException(422, "reviewed_text is only accepted for corrections")
    if payload.decision != "correct" and payload.reviewed_domain is not None:
        raise HTTPException(422, "Domain can only change during correction")
    now = datetime.now(timezone.utc).isoformat()
    with db() as conn:
        observation = one(conn, """SELECT o.*, s.status AS session_status, c.patient_id,
            p.organization_id AS patient_organization_id
            FROM observations o JOIN sessions s ON s.id=o.session_id
            JOIN cases c ON c.id=s.case_id
            LEFT JOIN patients p ON p.id=c.patient_id
            WHERE o.id=:id""", {"id": observation_id})
        if observation is None:
            raise HTTPException(404, "Observation not found")
        reviewer = one(conn, "SELECT id, organization_id FROM professionals WHERE id=:id", {"id": payload.reviewer_id})
        if reviewer is None:
            raise HTTPException(404, "Professional not found")
        if observation["patient_organization_id"] is None:
            raise HTTPException(409, "Session case must be linked to a synthetic patient before review")
        if reviewer["organization_id"] != observation["patient_organization_id"]:
            raise HTTPException(409, "Professional and patient must belong to the same organization")
        if observation["session_status"] == "approved":
            raise HTTPException(409, "Approved session is immutable")
        if observation["review_status"] != "pending":
            raise HTTPException(409, "Observation has already been reviewed")
        status = {"approve": "approved", "correct": "corrected", "reject": "rejected"}[payload.decision]
        final_text = payload.reviewed_text if payload.decision == "correct" else (
            observation["observation_text"] if payload.decision == "approve" else None)
        final_domain = (payload.reviewed_domain or observation["functional_domain"]) if status != "rejected" else None
        if payload.decision == "correct":
            # Compare whitespace-normalized values without rewriting either the
            # original evidence or the professional's meaningful correction.
            normalized_text = " ".join(final_text.split())
            normalized_domain = " ".join(final_domain.split())
            if not normalized_text or len(normalized_domain) < 2:
                raise HTTPException(422, "Correction requires nonblank text and a functional domain")
            if (normalized_text == " ".join(observation["observation_text"].split())
                    and normalized_domain == " ".join(observation["functional_domain"].split())):
                raise HTTPException(422, "Correction must change the text or functional domain; approve unchanged observations instead")
        result = execute(conn, """UPDATE observations SET review_status=:status, reviewed_text=:text, reviewed_domain=:domain,
            reviewed_by=:reviewer, reviewed_at=:now WHERE id=:id AND review_status='pending'""",
            {"status": status, "text": final_text, "domain": final_domain, "reviewer": reviewer["id"], "now": now, "id": observation_id})
        if result.rowcount != 1:
            raise HTTPException(409, "Observation review conflict")
        execute(conn, """INSERT INTO observation_review_events
            (id,observation_id,reviewer_id,decision,previous_status,previous_text,reviewed_text,reason,created_at,previous_domain,reviewed_domain)
            VALUES (:id,:observation_id,:reviewer_id,:decision,:previous_status,:previous_text,:reviewed_text,:reason,:created_at,:previous_domain,:reviewed_domain)""",
            {"id": str(uuid4()), "observation_id": observation_id, "reviewer_id": reviewer["id"],
             "decision": payload.decision, "previous_status": observation["review_status"],
             "previous_text": observation["observation_text"], "reviewed_text": final_text,
             "reason": payload.reason, "created_at": now,
             "previous_domain": observation["functional_domain"], "reviewed_domain": final_domain})
        return one(conn, "SELECT * FROM observations WHERE id=:id", {"id": observation_id})

@router.get("/observations/{observation_id}/review-events")
def review_events(observation_id: str):
    with db() as conn:
        if one(conn, "SELECT id FROM observations WHERE id=:id", {"id": observation_id}) is None:
            raise HTTPException(404, "Observation not found")
        return all_rows(conn, """SELECT * FROM observation_review_events
            WHERE observation_id=:id ORDER BY created_at, id""", {"id": observation_id})

@router.get("/sessions/{session_id}/approved-observations")
def approved_observations(session_id: str):
    with db() as conn:
        if one(conn, "SELECT id FROM sessions WHERE id=:id", {"id": session_id}) is None:
            raise HTTPException(404, "Session not found")
        return all_rows(conn, """SELECT * FROM observations WHERE session_id=:id
            AND review_status IN ('approved', 'corrected') ORDER BY created_at, id""", {"id": session_id})
