# Issue #28 — registered synthetic professional review

## Root cause and smallest safe solution

Reported production evidence is an empty organization registry, four pending observations for synthetic case `OT-001`, and `404 Professional not found` when an invented/unregistered UUID is submitted. This task did not query or modify that production instance.

The backend already implements every required operation and correctly requires a **persisted** professional and a case linked to a synthetic patient in the **same organization**. A UUID-shaped string is not a registered professional or authenticated identity. The API workflow succeeds without application backend changes; no migration, validation bypass, extraction or database reset is needed.

The missing frontend flow is now available in **Session workspace → Functional observation review → Set up or select a synthetic reviewer**. It uses only existing endpoints. Separate buttons explicitly register an organization/professional/patient and link the selected patient to the current case. A synthetic-only acknowledgment is required for setup writes. Setup does not create observations or make review decisions. Existing records can be selected without duplicate registration. An existing case link is displayed and cannot be replaced by this setup.

Once the case is linked and a professional selected, the persisted reviewer ID fills the existing review input. Each observation still needs its own explicit decision. Advanced users may paste an existing professional ID, but backend existence/linkage/organization validation remains authoritative. A `Professional not found` error explains how to register/select a real persisted synthetic record; it does not pretend a decision succeeded.

## Manual production steps — authorized operator only

These are remaining operator actions, **not actions performed by this PR**. Keep the current audience authentication/private access controls and existing synthetic-only policy. Never enter real patient or professional information, use a production seed script, or edit database rows manually.

1. Identify the existing `OT-001` session and four observation IDs using the existing UI or GET endpoints. Record their source excerpts/statuses. Do not re-extract or recreate them. Inspect `GET /api/registry/sessions/{session_id}/functional-documentation` for the current case/patient link before linking anything.
2. Open the new setup panel once the reviewed frontend release is explicitly authorized and deployed. Select an existing organization if present. If the registry is empty, explicitly register a label such as `Synthetic Demo Organization`. Confirm the inputs are synthetic before any setup action.
3. Select a registered professional from that organization, or explicitly register a label such as `Synthetic Reviewer A`. Use the ID returned by the server; do not paste an arbitrary UUID. No credentials are entered in these registry fields.
4. If the case is not linked, select an existing synthetic patient in the same organization or explicitly register a code such as `SYN-OT-001`. Click **Link selected synthetic patient to this case**. If a link already exists, select the organization containing that patient; never unlink or replace it to get around a conflict. The backend preserves the existing link and rejects a different one.
5. Confirm the registered professional ID is selected. Inspect one existing observation and its verbatim excerpt, choose the actual intended decision, and explicitly click **Confirm decision**. If one of four pending observations is approved, the expected result is three pending and one approved—not four automatically approved.
6. Reload the session, reselect the registered organization/professional, and open the reviewed observation's audit history. Verify decision, persisted professional ID, timestamp and unchanged source excerpt. Check that all four original observation IDs remain. The documentation preview should reflect the review; consolidation stays blocked while three observations remain pending.
7. Review the remaining observations individually only when the synthetic operator actually intends those decisions. No AMD call is required to review already persisted observations. Any 404/409 is a prerequisite/conflict to investigate, not a reason to weaken validation.

### Existing API-only path (does not require the new frontend)

An authorized operator can already perform the same sequence through the supported authenticated deployment API. Use returned IDs and reuse existing records; placeholders below are not real UUIDs:

| Operation | Request |
| --- | --- |
| Inspect organizations | `GET /api/registry/organizations` |
| Register only if needed | `POST /api/registry/organizations` with `{"name":"Synthetic Demo Organization"}` |
| Inspect registered professionals/patients | `GET /api/registry/organizations/{organization_id}/professionals` and `/patients` |
| Register a professional if needed | `POST /api/registry/professionals` with `{"organization_id":"<returned organization ID>","display_name":"Synthetic Reviewer A"}` |
| Register a patient if needed | `POST /api/registry/patients` with `{"organization_id":"<same organization ID>","synthetic_code":"SYN-OT-001"}` |
| Link the existing case if unlinked | `POST /api/registry/cases/OT-001/patient` with `{"patient_id":"<returned patient ID>"}` |
| Explicitly review one existing observation | `POST /api/registry/observations/{existing_observation_id}/review` with `{"reviewer_id":"<persisted professional ID>","decision":"approve"}` only when approval is intended |
| Inspect durable audit | `GET /api/registry/observations/{existing_observation_id}/review-events` |

Do not put BasicAuth passwords, API keys or tokens in example commands, URLs, registry labels, screenshots or Git. Use the existing authorized operator session/tooling. Do not call `/extract`, create replacement observations, manually insert SQL rows or run any automatic setup script against production.

## Validation performed

- Complete backend suite: **86 passed**, one existing Starlette/httpx TestClient deprecation warning. New API integration starts with an empty registry and four disposable synthetic observations, demonstrates the original 404 and unlinked/cross-organization/relink conflicts, completes setup through existing routes, and verifies one durable review/audit after disposing connections and reloading the database.
- Frontend: **34 tests passed**. Coverage includes empty registry without writes, explicit synthetic confirmation, separate registration/link actions, existing-record selection without duplicates, protected case links, request failure/retry/timeout, server conflict retention and actionable unknown-professional guidance. Existing dashboard/documentation/review tests remain passing.
- TypeScript/Vite production build: **passed**.
- Local Chromium: **passed** from empty registry through explicit setup, linkage, one observation approval, reload/reselection and audit history. All four IDs/source/text/domain fields were preserved; three observations remained pending. No extraction/AMD requests or browser runtime exceptions occurred; 390px layout checked.
- No production API/database, VPS, registry image publication or deployment was used for validation. The disposable browser fixture used manually registered synthetic observations to model pending records; it was not live AMD inference or production evidence.

Reproduce automated checks from `backend` with `PYTHONPATH=. .venv/bin/python -m pytest -q`, and from `frontend` with `npm ci`, `npm test`, `npm run build`. The API regression is `backend/tests/test_registry_review_setup.py`; frontend regression coverage is `frontend/tests/SyntheticRegistrySetup.test.tsx` and `ReviewWorkspace.test.tsx`. No automatic seed or startup hook is introduced.

## Deployment notes, rollback and limits

The application/backend API, migrations, authentication, Portainer stack, proxy and database schema are unchanged. After independent review and explicit release authorization, build/publish/deploy the frontend through the existing approved release process using `VITE_API_URL=/api`. This task does not authorize those steps or change any image digest, other VPS stack or shared database. Existing API endpoints can be used by an authorized operator before a frontend release if needed.

If the UI release must be rolled back, restore its previous approved frontend digest through the separately authorized deployment process. No database/schema rollback is needed. Preserve any correctly registered synthetic records, case link and audit events: reverting UI code must not delete audit facts or reset observations. The previous manual-ID UI can use the persisted professional ID through the same validated API.

This remains an unauthenticated application behind existing deployment controls; synthetic professional labels/IDs are references, not verified clinician identities. The checkbox is an operator acknowledgment, not a detector of real personal data. Metadata creation/linking and observation decisions are separate HTTP transactions; a network timeout can leave a successful registration even when the response is lost. Refresh the registry and select existing records before retrying; writes are never automatically retried. Existing database migration prerequisites still apply. PostgreSQL/Portainer/live AMD behavior was not revalidated here, and no signed clinical report or automatic clinical approval is supported.
