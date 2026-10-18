# Synthetic family participation report — bounded MVP

## Status and scope

Implemented on a separate main-based feature branch, independent of PR #34. **No live AMD inference, production change, image publication, deployment or hackathon submission was performed.** Tests and screenshots use mocked provider responses. Live execution requires separate explicit user authorization.

The Session Workspace now offers **Generate Family Report**, a printable draft with a descriptive evidence map, factual participation/strength/support accounts, optional activity proposals, source/audit links and explicit therapist approval/rejection. Functional Progress and existing review/documentation dashboards are unchanged.

## Architecture, privacy and authorization

- Three new API routes under `/registry/sessions/{session_id}/family-report`: GET reads saved state (`reviewer_id` query); POST reserves/generates; POST `/review` records the one explicit approve/reject decision.
- All require `X-Family-Report-Token`, checked against a server-side **32+ character** `ELO_FAMILY_REPORT_OPERATOR_TOKEN` with constant-time comparison. Default is disabled: `ELO_FAMILY_REPORTS_ENABLED=true` and `ELO_SYNTHETIC_ONLY_ACK=true` must be explicitly configured. No token is embedded in frontend builds or stored in local/session storage. UI credentials live only in component memory and are hidden from printing. Use protected HTTPS or loopback access, not an unprotected public write route.
- The reviewer must be a persisted synthetic professional in the selected case's linked patient's organization for reading, generating and reviewing. A UUID is still a reference, not authenticated professional identity: the extra operator credential is a demo boundary, not clinical identity/tenant RBAC.
- Only approved/corrected observations with an exact source substring and matching decision/reviewer/original and reviewed text/domain/timestamp audit event are eligible. Observation reviewers must belong to the linked organization. Pending/rejected observations are omitted; inconsistent accepted evidence blocks generation.
- Only aliases `O1`… and closed-vocabulary synthetic observation text, allowed family paraphrases and category choices reach AMD. No patient/professional/organization/case/session/observation IDs, original notes, source excerpts or audit metadata are transmitted. Actual evidence/reviewer/audit IDs are resolved and retained locally for traceability.
- The supported complete observation grammar currently covers the original four synthetic OT-001 accounts (verbal initiation prompts; approximate block-task attention; independent fitting attempts with both hands and minimal assistance for remaining attempts; hesitant transition completed within a bound with verbal guidance). Unknown wording, names, instructions, negation or changed clauses fail closed **before** reserving/calling AMD. Operator synthetic confirmation is also required; this is not a real-patient de-identification system.

## Constrained generation and clinical limits

The shared Token Factory transport reads the existing `RADEON_API_KEY`, `RADEON_MODEL` (default DeepSeek-V4-Flash) and fixed documented `RADEON_BASE_URL`. Existing extraction still uses its original system prompt, JSON validation, 900-token ceiling and source checks. Family generation uses one JSON-object chat-completion request, temperature 0, no reasoning effort, an 1800-token ceiling and the existing 90-second timeout. These are settings, not measured latency/usage.

To make unsupported-claim validation enforceable, this MVP **does not accept arbitrary clinical prose**. It uses a strict Pydantic schema with forbidden extra fields, fixed neutral summary/longitudinal warning, exact evidence-bound family paraphrases and references, complete factual/category coverage, and at most three distinct optional activities selected from a small safe catalog. Motor independence and remaining physical assistance appear together in participation, strengths and support. Approximation, hesitation and verbal guidance remain explicit. Invented percentages, diagnoses, norms, comparisons, outcomes, new facts or unknown references cannot pass validation.

The model's role is constrained structured assembly/order and optional idea selection, not unrestricted therapeutic reasoning. Home ideas are **AI-selected catalog proposals**, non-prescriptive, age-neutral, conditional on comfort and a therapist's review; they make no efficacy claim. Approval is an explicit synthetic report decision, not a verified clinical signature. The evidence map is descriptive and has no performance scale or longitudinal trend. Missing evidence is not zero ability.

## Durability and failure semantics

One additive migration (`0005_family_reports`) creates one `family_reports` row per session, keyed by session ID. This is necessary for durable duplicate protection across concurrent requests, refreshes, retries and process restarts. It stores a frozen evidence mapping/hash, validated report JSON, status/timestamps and one immutable-in-API reviewer decision/note. Existing observations, sessions and observation-review events are not rewritten.

The reservation commits **before** network access, using `INSERT … ON CONFLICT DO NOTHING`. Only the winning request may contact AMD. All later requests return saved state; neither failed nor rejected reports are regenerated. A timeout/invalid response marks the attempt failed; a process interruption can leave `generating` unresolved. Both states intentionally consume/lock the attempt, because the provider may already have processed it. There is no retry/reset/delete/regeneration endpoint. Operators must not delete reservations or reset records to obtain another call. The at-most-once application attempt does not promise successful provider delivery or exactly-once provider billing.

A validated response is saved as **Draft**, never automatically Approved. Evidence is rechecked after generation and before review. A stale/inconsistent report cannot be approved, and stale UI output is marked unusable. Draft→Approved or Draft→Rejected requires a reviewer in the same organization, explicit synthetic/all-content confirmations and a meaningful decision note. Repeated decisions return conflict. Approval/rejection metadata is durable; no review edit route exists. Database-owner tamper resistance is not claimed.

## Executed validation and screenshots

Local results: **117 backend tests passed** (one existing Starlette/httpx deprecation warning), **49 frontend tests passed**, TypeScript/Vite production build passed. Tests cover auth/synthetic/organization boundaries, source/audit filtering, identifier exclusion, missing credentials, provider failures, malformed/unsupported output, complete references, concurrent/restarted duplicate protection, stale evidence, approve/reject transitions, frontend double-click/stale-session/error controls, and the CLI's default read-only / one-POST-no-retry behavior. All provider responses/transports in these tests are mocked.

An isolated **PostgreSQL 16** database successfully ran the existing migrations through new revision 0005, then the family-generation/persistence/approval contract passed. The complete suite ran on disposable SQLite, not on production. Compose security normalization passed. A local container build was attempted but blocked by the cloud proxy CA not being trusted inside the build image; TLS verification was not disabled. Review the PR's separate container CI for executable image/Nginx/proxy validation.

Browser checks used newly created disposable synthetic records with explicit observation approvals and a patched provider (no real key/network). Double-click issued one generation POST/provider-stub invocation; source links expanded exact evidence; therapist approval persisted; refresh/load generated no further requests; 390px had no page overflow; print showed the marked report and hid credentials/controls. The print action is scoped to the report so other dashboard printing is unaffected.

- [Draft desktop](family-report-evidence/draft-desktop.png)
- [Draft mobile](family-report-evidence/draft-mobile.png)
- [Explicitly approved synthetic draft](family-report-evidence/approved-desktop.png)
- [Print preview](family-report-evidence/print-preview.png)

These are mocked local screenshots, not live AMD output or production observations.

## Exact one-call live verification — NOT EXECUTED

**Do not run the execution step until the user separately authorizes one real AMD request.** The flag below is not itself authorization. Do not target production, deploy this feature, run observation extraction or create/reset/reseed records as part of the smoke test.

1. Choose an existing, explicitly human-reviewed **synthetic session in an isolated local database**, with supported observation wording, valid source/audit links and no family-report reservation. Verify its existing reviewer/patient organization linkage. Do not use the already-consumed mocked screenshot session or delete its report to retry. If no eligible unused local session exists, stop and report that prerequisite instead of silently creating/replacing records.
2. On this isolated database only, apply existing Alembic migrations through `0005_family_reports` before running the API. SQLite uses the existing model initialization; PostgreSQL requires `ELO_DATABASE_URL` with the `postgresql+psycopg://` driver and `python -m alembic upgrade head`. Never apply these commands to production in this task.
3. After separate authorization, start the **unmodified application** on loopback using the existing securely injected **server-side** `RADEON_API_KEY` and configured `RADEON_MODEL`. Explicitly configure `ELO_INFERENCE_MODE=amd`, `ELO_SYNTHETIC_ONLY_ACK=true`, `ELO_FAMILY_REPORTS_ENABLED=true` and a securely supplied `ELO_FAMILY_REPORT_OPERATOR_TOKEN` of at least 32 characters. Do not print keys, paste secrets into chat, put them in `VITE_*`, use the mocked test server or patch the provider for live verification. The script uses the operator credential only; it does not transmit the provider key to the API.
4. Start backend from `backend`: `.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`. Use the existing local synthetic database path/URL; do not substitute production credentials. Inspect code/eligible text beforehand: the outgoing request consists solely of aliases, supported observation wording, allowed paraphrases and schema/prompt; no actual IDs or audit information.
5. Read-only preflight from repository root (no provider generation):

   ```bash
   backend/.venv/bin/python scripts/family-report-live-smoke.py \
     --base-url http://127.0.0.1:8000 \
     --session-id "$SYNTHETIC_SESSION_ID" \
     --reviewer-id "$SYNTHETIC_REVIEWER_ID"
   ```

   Supply `ELO_FAMILY_REPORT_OPERATOR_TOKEN` securely in the script environment too; do not pass it on the command line. A previously saved/reserved state blocks generation. The preflight only validates API access/saved status, not provider connectivity or model quality.
6. **Only following the separate explicit user authorization**, execute precisely once:

   ```bash
   backend/.venv/bin/python scripts/family-report-live-smoke.py \
     --base-url http://127.0.0.1:8000 \
     --session-id "$SYNTHETIC_SESSION_ID" \
     --reviewer-id "$SYNTHETIC_REVIEWER_ID" \
     --execute-authorized
   ```

   This makes a saved-status GET then at most **one** generation POST; the HTTP client has retries disabled and does not follow redirects. The server's durable reservation permits at most one provider attempt for this session. Do not additionally click Generate in the UI or rerun extraction.
7. On success, inspect the saved Draft through **Load saved family report** or protected GET. Verify every fact/reference/qualifier, all original source/reviewer/audit links and optional proposals. **Do not auto-approve**; therapist review is a separate explicit action. If the provider times out, returns invalid schema/claims or the connection becomes uncertain, stop: inspect saved state with GET, do not retry/delete the row. No successful report is guaranteed from the single authorized call.
8. Record only verified outcome/status and properly redacted synthetic screenshots. No raw headers/keys or terminal environment dumps. The adapter does not persist request IDs, token usage, latency, actual served-model attribution or monetary cost; do not invent them. Provider-account counters do not independently map to this report. No such live evidence exists for this PR yet.

## Deployment and rollback limits

This PR does not enable the feature in the deployed stack. Existing Portainer Compose deliberately has no family-report operator secret/enablement wiring; any production configuration, migration run, image publication or deployment needs separate review/authorization. Keep audience writes blocked/private and preserve HTTPS/BasicAuth; the operator token adds a feature gate, not clinical identity verification.

For an authorized rollout, apply additive migration 0005 first and release compatible API/frontend together with the feature initially disabled. For rollback, disable the feature and restore previous approved API/frontend digests/configuration; keep the added table/data and existing PostgreSQL volume. Previous code can ignore the new table. Do not run destructive downgrade, drop reports, reset/re-extract observations, overwrite shared databases or change unrelated stacks. Preserve consumed attempts and approval/audit records. Actual approved digests must come from secure operator release records.
