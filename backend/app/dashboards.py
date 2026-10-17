"""Read-only synthetic research dashboards. Counts are not clinical outcomes."""
import os
from contextlib import contextmanager
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy.exc import SQLAlchemyError

from app.database import db, one, all_rows, database_url

router = APIRouter(prefix="/dashboards", tags=["synthetic-dashboards"])
OBSERVATION_STATUSES = ("pending", "approved", "corrected", "rejected")


@contextmanager
def dashboard_db():
    try:
        with db() as conn:
            yield conn
    except SQLAlchemyError:
        raise HTTPException(503, "Dashboard data unavailable. Check database connectivity and apply the repository's existing migrations.") from None


def metadata(scope="all persisted synthetic application records"):
    return {"generated_at": datetime.now(timezone.utc).isoformat(), "scope": scope}


def distribution(conn, table, column, defaults):
    # Identifiers are internal constants; all user filters use bound parameters.
    counts = dict.fromkeys(defaults, 0)
    for row in all_rows(conn, f"SELECT {column} AS label, COUNT(*) AS count FROM {table} GROUP BY {column}"):
        counts[row["label"]] = row["count"]
    return counts


def percent(numerator, denominator):
    return round(100 * numerator / denominator, 1) if denominator else None


@router.get("/operations")
def operations():
    with dashboard_db() as conn:
        cases = one(conn, "SELECT COUNT(*) AS count FROM cases")["count"]
        sessions = distribution(conn, "sessions", "status", ("draft", "pending", "approved"))
        observations = distribution(conn, "observations", "review_status", OBSERVATION_STATUSES)
        total = sum(observations.values())
        reviewed = sum(observations[key] for key in ("approved", "corrected", "rejected"))
        return {**metadata(), "total_cases": cases, "total_sessions": sum(sessions.values()),
                "session_statuses": sessions, "observation_statuses": observations,
                "total_observations": total, "reviewed_observations": reviewed,
                "review_completion_percent": percent(reviewed, total)}


@router.get("/functional")
def functional(case_id: str | None = None, limit: int = Query(100, ge=1, le=500)):
    where = "WHERE s.case_id=:case_id" if case_id is not None else ""
    accepted = "o.review_status IN ('approved', 'corrected')"
    domain = "COALESCE(NULLIF(TRIM(o.reviewed_domain), ''), o.functional_domain)"
    params = {"case_id": case_id, "limit": limit}
    with dashboard_db() as conn:
        domains = all_rows(conn, f"""SELECT {domain} AS domain, COUNT(*) AS count
            FROM observations o JOIN sessions s ON s.id=o.session_id
            {where} {'AND' if where else 'WHERE'} {accepted}
            GROUP BY {domain} ORDER BY count DESC, domain""", params)
        sessions = all_rows(conn, f"""SELECT s.id, s.case_id, s.created_at, s.status,
            COUNT(o.id) AS total_observations,
            SUM(CASE WHEN o.review_status='pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN o.review_status='approved' THEN 1 ELSE 0 END) AS approved,
            SUM(CASE WHEN o.review_status='corrected' THEN 1 ELSE 0 END) AS corrected,
            SUM(CASE WHEN o.review_status='rejected' THEN 1 ELSE 0 END) AS rejected
            FROM sessions s LEFT JOIN observations o ON o.session_id=s.id {where}
            GROUP BY s.id, s.case_id, s.created_at, s.status
            ORDER BY s.created_at DESC, s.id DESC LIMIT :limit""", params)
        count = one(conn, f"SELECT COUNT(*) AS count FROM sessions s {where}", params)["count"]
        cases = all_rows(conn, "SELECT id FROM cases ORDER BY id")
        scope = f"persisted synthetic records for case {case_id}" if case_id is not None else "all persisted synthetic application records"
        return {**metadata(scope),
                "case_id": case_id, "cases": [row["id"] for row in cases],
                "domains": domains, "sessions": sessions, "total_sessions": count,
                "session_limit": limit,
                "interpretation": "Descriptive counts only. Differences do not establish clinical progress, diagnoses or treatment effectiveness."}


@router.get("/governance")
def governance(limit: int = Query(30, ge=1, le=200)):
    with dashboard_db() as conn:
        decisions = distribution(conn, "observation_review_events", "decision", ("approve", "correct", "reject"))
        total = sum(decisions.values())
        # Python's substring test matches the application's exact, case-sensitive
        # evidence rule on both SQLite and PostgreSQL (SQL LIKE does not).
        evidence = all_rows(conn, "SELECT o.source_excerpt, s.notes FROM observations o JOIN sessions s ON s.id=o.session_id")
        matched = sum(bool(row["source_excerpt"]) and row["source_excerpt"] in row["notes"] for row in evidence)
        events = all_rows(conn, """SELECT e.*, o.session_id, s.case_id
            FROM observation_review_events e JOIN observations o ON o.id=e.observation_id
            JOIN sessions s ON s.id=o.session_id ORDER BY e.created_at DESC, e.id DESC LIMIT :limit""", {"limit": limit})
        configured = os.getenv("ELO_INFERENCE_MODE", "mock")
        enabled = configured == "amd" and bool(os.getenv("RADEON_API_KEY"))
        return {**metadata(), "decisions": decisions, "total_decisions": total,
                "decision_percentages": {key: percent(value, total) for key, value in decisions.items()},
                "rate_denominator": "persisted human observation-review audit events; pending observations excluded",
                "provenance": {"total_observations": len(evidence), "verbatim_matches": matched,
                               "unmatched": len(evidence) - matched},
                "events": events, "event_limit": limit,
                "health": {"api": "responding", "database": "query succeeded",
                           "persistence": "postgresql" if database_url().startswith("postgresql") else "sqlite",
                           "configured_inference_mode": configured, "effective_inference_mode": "amd" if enabled else "mock",
                           "provider_connectivity": "unverified", "historical_inference_provenance": "unavailable"},
                "telemetry": {"latency_ms": None, "tokens": None, "cost": None,
                              "reason": "Unavailable: inference latency, token usage and cost are not persisted."}}


@router.get("/sessions/{session_id}/evidence")
def session_evidence(session_id: str):
    with dashboard_db() as conn:
        session = one(conn, "SELECT id, case_id, created_at, status, notes FROM sessions WHERE id=:id", {"id": session_id})
        if session is None:
            raise HTTPException(404, "Session not found")
        observations = all_rows(conn, "SELECT * FROM observations WHERE session_id=:id ORDER BY created_at, id", {"id": session_id})
        events = all_rows(conn, """SELECT e.* FROM observation_review_events e
            JOIN observations o ON o.id=e.observation_id WHERE o.session_id=:id
            ORDER BY e.created_at, e.id""", {"id": session_id})
        by_observation = {}
        for event in events:
            by_observation.setdefault(event["observation_id"], []).append(event)
        notes = session.pop("notes")
        for observation in observations:
            observation["events"] = by_observation.get(observation["id"], [])
            observation["verbatim_match"] = bool(observation["source_excerpt"]) and observation["source_excerpt"] in notes
        return {"session": session, "observations": observations}


@router.get("/reviewed-observations")
def reviewed_observations(domain: str | None = None, case_id: str | None = None,
                          limit: int = Query(100, ge=1, le=500)):
    where = "WHERE o.review_status IN ('approved', 'corrected')"
    if domain is not None:
        where += " AND COALESCE(NULLIF(TRIM(o.reviewed_domain), ''), o.functional_domain)=:domain"
    if case_id is not None:
        where += " AND s.case_id=:case_id"
    params = {"domain": domain, "case_id": case_id, "limit": limit}
    with dashboard_db() as conn:
        total = one(conn, f"SELECT COUNT(*) AS count FROM observations o JOIN sessions s ON s.id=o.session_id {where}", params)["count"]
        rows = all_rows(conn, f"""SELECT o.*, s.case_id, s.created_at AS session_created_at
            FROM observations o JOIN sessions s ON s.id=o.session_id {where}
            ORDER BY s.created_at DESC, o.created_at DESC, o.id DESC LIMIT :limit""", params)
        return {"observations": rows, "total": total, "limit": limit}
