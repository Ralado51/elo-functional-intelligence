"""Read-only functional documentation preview for synthetic sessions.

This is not a clinical report, a signed record, or authorization to use real patient data.
"""
from fastapi import APIRouter, HTTPException
from app.database import db, one, all_rows

router = APIRouter(prefix="/registry", tags=["synthetic-functional-documentation"])


@router.get("/sessions/{session_id}/functional-documentation")
def functional_documentation(session_id: str):
    with db() as conn:
        session = one(conn, """SELECT s.id, s.case_id, s.duration_minutes, s.status,
            s.created_at, c.patient_id FROM sessions s
            JOIN cases c ON c.id=s.case_id WHERE s.id=:id""", {"id": session_id})
        if session is None:
            raise HTTPException(404, "Session not found")
        observations = all_rows(conn, """SELECT id, functional_domain, reviewed_domain,
            observation_text, reviewed_text, source_excerpt, review_status, reviewed_by,
            reviewed_at, created_at FROM observations WHERE session_id=:id
            ORDER BY created_at, id""", {"id": session_id})
        accepted = []
        for observation in observations:
            if observation["review_status"] not in ("approved", "corrected"):
                continue
            events = all_rows(conn, """SELECT id, reviewer_id, decision, previous_domain,
                reviewed_domain, previous_text, reviewed_text, reason, created_at
                FROM observation_review_events WHERE observation_id=:id
                ORDER BY created_at, id""", {"id": observation["id"]})
            accepted.append({
                "observation_id": observation["id"],
                "original_domain": observation["functional_domain"],
                "final_domain": observation["reviewed_domain"] or observation["functional_domain"],
                "original_text": observation["observation_text"],
                "final_text": observation["reviewed_text"] or observation["observation_text"],
                "source_excerpt": observation["source_excerpt"],
                "review_status": observation["review_status"],
                "reviewed_by": observation["reviewed_by"],
                "reviewed_at": observation["reviewed_at"],
                "audit_event_ids": [event["id"] for event in events],
            })
        pending = sum(o["review_status"] == "pending" for o in observations)
        rejected = sum(o["review_status"] == "rejected" for o in observations)
        eligible = bool(session["patient_id"]) and bool(accepted) and pending == 0
        blockers = []
        if not session["patient_id"]:
            blockers.append("Case is not linked to a synthetic patient")
        if not accepted:
            blockers.append("No approved or corrected observations")
        if pending:
            blockers.append(f"{pending} observations still require human review")
        return {
            "document_type": "synthetic_functional_documentation_preview",
            "is_final_record": False,
            "session_id": session["id"],
            "case_id": session["case_id"],
            "synthetic_patient_id": session["patient_id"],
            "session_status": session["status"],
            "duration_minutes": session["duration_minutes"],
            "counts": {"total": len(observations), "accepted": len(accepted),
                       "pending": pending, "rejected": rejected},
            "eligible_for_consolidation": eligible,
            "blockers": blockers,
            "reviewed_observations": accepted,
            "disclaimer": "Synthetic data only. Human-reviewed evidence preview; not a clinical report or signed record.",
        }
