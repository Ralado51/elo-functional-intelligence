# Sprint 9B — Functional Documentation Consolidation

Status: **Specification only**. No production endpoint, database migration, merge, deployment or submission is authorized by this document.

## Objective

Create a deterministic, read-only **synthetic functional documentation draft** from human-reviewed observations. Do not ask an LLM to compose clinical conclusions, diagnoses, progress claims, treatment recommendations or any content absent from source evidence.

## Existing source contract

Use `GET /registry/sessions/{session_id}/functional-documentation`, which already provides:
- `document_type`, `is_final_record`, `session_id`, `case_id`, `synthetic_patient_id`, `session_status`, `duration_minutes`
- `counts`, `eligible_for_consolidation`, `blockers`, `reviewed_observations`, `disclaimer`
- Each accepted observation: original/final domain and text, source excerpt, review status, reviewer, review timestamp and audit event IDs.

## Eligibility and safety

- When `eligible_for_consolidation` is false, show blockers and **do not render an eligible consolidated document**.
- Eligibility is controlled by the backend, not recomputed or overridden by the frontend.
- `is_final_record` remains false. Label every document **SYNTHETIC DRAFT — NOT A CLINICAL RECORD**.
- Do not show rejected observations as accepted findings. Never silently omit blockers.
- Never use real patient data; synthetic identifiers only.
- No new inference call or automatic approval.

## Document structure

1. **Header** — document type, synthetic-only label, case ID, session ID, duration, session status.
2. **Review summary** — total, accepted, pending, rejected, consolidation eligibility.
3. **Functional observations** — final functional domain and final reviewed text for each accepted item. Preserve backend ordering.
4. **Evidence and traceability** — original text/domain, verbatim source excerpt, review decision, reviewer ID, review timestamp, audit event IDs.
5. **Limitations** — explicitly state that this is a synthetic evidence draft, not a diagnosis, treatment plan, signed report or finalized clinical record.

## Proposed UI

Add a separate `FunctionalConsolidatedDraft` component **without changing** `ReviewWorkspace.tsx`, `backend/app/review.py`, or review tests owned by Codex Sprint 9A.

The draft should consume the same existing preview response or a shared parent-fetched response to avoid conflicting duplicate sources. It must show a blocked state when ineligible, and a read-only document view when eligible. No persistence or export in this sprint.

## Acceptance criteria

1. Four accepted observations and zero pending => draft shows all four with traceability, still not final.
2. Three pending => blocked, no consolidated document.
3. Zero accepted => blocked.
4. Missing synthetic patient association => blocked.
5. Rejected items never appear among accepted observations.
6. API failure => visible error; never render stale content from another session.
7. Changing session => clear prior draft and fetch new session.
8. No mutation endpoints, no external calls, no real patient data.
9. Frontend build and existing tests pass.

## Workstream boundary

Codex Sprint 9A owns correction validation and audit loading behavior. Sprint 9B owns only documentation consolidation. Do not merge, deploy or submit without explicit confirmation.
