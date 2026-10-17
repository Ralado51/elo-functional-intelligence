"""Read-only, case-centered narrative evidence; never compute clinical progress."""
import re

from fastapi import APIRouter, HTTPException, Query
from app.database import all_rows, one
from app.dashboards import dashboard_db, metadata

router = APIRouter(prefix="/dashboards", tags=["synthetic-functional-progress"])

# Presentation topics, not measurement extraction or clinical classification.
# Numeric values, units, approximation, negation and assistance wording remain
# opaque strings in their persisted original/reviewed context.
TOPICS = {
    "initiation": r"initiat|\binici|\bbegin|\bstart|come[çc]",
    "attention": r"attention|aten[çc]|engagement|engaj|concentra|focus|foco",
    "motor": r"motor|coordena|coordina",
    "transitions": r"transit|transi[çc]|mudan[çc]a|troca de atividade",
    "assistance": r"assistan|independen|support|guidance|ajuda|aux[ií]lio|apoio|orienta|assist[eê]ncia|verbal",
}


@router.get("/functional-progress")
def functional_progress(case_id: str | None = None, limit: int = Query(50, ge=1, le=100)):
    with dashboard_db() as conn:
        cases = all_rows(conn, "SELECT id FROM cases ORDER BY id")
        if case_id is None:
            return {**metadata(), "cases": cases, "case": None, "sessions": [], "total_sessions": 0, "limit": limit}
        case = one(conn, "SELECT id, patient_id FROM cases WHERE id=:id", {"id": case_id})
        if case is None:
            raise HTTPException(404, "Synthetic case not found")
        sessions = all_rows(conn, """SELECT id, created_at, duration_minutes FROM sessions
            WHERE case_id=:case_id ORDER BY created_at DESC, id DESC LIMIT :limit""", {"case_id": case_id, "limit": limit})
        total = one(conn, "SELECT COUNT(*) AS count FROM sessions WHERE case_id=:id", {"id": case_id})['count']
        if sessions:
            params = {f"s{index}": session['id'] for index, session in enumerate(sessions)}
            slots = ','.join(':' + key for key in params)
            observations = all_rows(conn, f"SELECT * FROM observations WHERE session_id IN ({slots}) ORDER BY created_at, id", params)
            events = all_rows(conn, f"""SELECT e.* FROM observation_review_events e
                JOIN observations o ON o.id=e.observation_id WHERE o.session_id IN ({slots})
                ORDER BY e.created_at, e.id""", params)
            notes = {row['id']: row['notes'] for row in all_rows(conn, f"SELECT id, notes FROM sessions WHERE id IN ({slots})", params)}
        else:
            observations, events, notes = [], [], {}
        by_observation = {}
        for event in events:
            by_observation.setdefault(event['observation_id'], []).append(event)
        by_session = {session['id']: [] for session in sessions}
        for observation in observations:
            by_session[observation['session_id']].append(observation)
        for session in sessions:
            rows = by_session[session['id']]
            session['recorded_observations'] = len(rows)
            session['evidence'] = []
            session['unverified_accepted_observations'] = 0
            for observation in rows:
                if observation['review_status'] not in ('approved', 'corrected'):
                    continue
                audit = by_observation.get(observation['id'], [])
                # A status flag alone is not an auditable human decision.
                matching = [event for event in audit if
                            event['reviewer_id'] == observation['reviewed_by'] and
                            event['decision'] == ('approve' if observation['review_status'] == 'approved' else 'correct') and
                            event['previous_text'] == observation['observation_text'] and
                            (event['previous_domain'] or observation['functional_domain']) == observation['functional_domain'] and
                            event['reviewed_text'] == observation['reviewed_text'] and
                            event['reviewed_domain'] == observation['reviewed_domain'] and
                            event['created_at'] == observation['reviewed_at']]
                excerpt = observation['source_excerpt']
                if not (matching and observation['reviewed_at'] and observation['reviewed_text'] and
                        excerpt and excerpt in notes[session['id']]):
                    session['unverified_accepted_observations'] += 1
                    continue
                text = observation['reviewed_text']
                domain = observation['reviewed_domain'] or observation['functional_domain']
                # Prefer the professional's domain. Mentioning an activity
                # (e.g. starting blocks) must not become motor performance.
                topics = [topic for topic, pattern in TOPICS.items() if topic != 'assistance' and re.search(pattern, domain, re.IGNORECASE)]
                if not topics:
                    topics = [topic for topic, pattern in TOPICS.items() if topic != 'assistance' and re.search(pattern, text, re.IGNORECASE)]
                if re.search(TOPICS['assistance'], domain + ' ' + text, re.IGNORECASE):
                    topics.append('assistance')
                session['evidence'].append({
                    "observation_id": observation['id'], "review_status": observation['review_status'],
                    "original_domain": observation['functional_domain'], "domain": domain,
                    "original_text": observation['observation_text'], "reviewed_text": text,
                    "source_excerpt": excerpt, "reviewer_id": observation['reviewed_by'],
                    "reviewed_at": observation['reviewed_at'],
                    "audit_event_ids": [event['id'] for event in matching],
                    "topics": topics,
                })
        return {**metadata(f"synthetic case {case_id}; narrative evidence only"), "cases": cases,
                "case": case, "sessions": sessions, "total_sessions": total, "limit": limit}
