# Hackathon demo runbook

## Status and dependencies

Prepared 2026-10-17 from inspected source, not a record of a live rehearsal. Workflow details below were inspected at PR #19 head `0e47e12884d9287224ed9c8e652c0b27f89e602e`, based on `feat/competition-dashboards`. This documentation branch starts from main and does not integrate those features. Confirm the eventual integrated SHA contains that workflow before following the runbook.

This is a synthetic-only pediatric occupational therapy prototype. Every session lasts **40 minutes**. Human review is mandatory for accepted observation evidence. No diagnosis, treatment recommendation, clinical progress measurement, signed report or final clinical record is demonstrated.

## Preflight and safety gate

- Record the exact application SHA, image digests and CI links in HACKATHON_EVIDENCE_CHECKLIST.md.
- Use an isolated database and synthetic notes only. Never reseed an existing database or touch shared VPS stacks/databases.
- Before any audience access, verify HTTPS, audience authentication, denial of public mutation routes and no direct public web/API/database ports. Operator mutations require a private authenticated route. CORS is not authentication.
- Confirm backend migrations on a disposable PostgreSQL instance for the intended deployment; a SQLite fixture is not PostgreSQL validation.
- Confirm GET /health through the chosen route and a same-origin /api/ request. Health mode=amd only indicates configuration; it is not evidence of a successful AMD request.
- Provision AMD secrets server-side through the deployment secret mechanism; never place keys in chat, screenshots, frontend variables or committed files. Record model/configuration without secret values.

## Two separate demonstrations

### A. Deterministic fixture and workflow rehearsal (MOCK)

From backend, with project dependencies available:

```sh
.venv/bin/python -m scripts.seed_dashboard_demo --database data/hackathon-rehearsal-new.db
```

The inspected script refuses an existing target and default elo.db, clears ELO_DATABASE_URL in its own process and explicitly uses mock mode. It creates one organization, a synthetic professional, two linked synthetic patients/cases and three sessions per case. Each session is 40 minutes. It manually registers four observations per session and prepares approve/correct/reject/pending examples. **Those manually registered observations are not AMD output. Mock extraction produces no observations.**

Start the API using that isolated file with ELO_DATABASE_URL unset in the server shell and ELO_INFERENCE_MODE=mock. Example from backend:

```sh
ELO_DB_PATH="$PWD/data/hackathon-rehearsal-new.db" ELO_INFERENCE_MODE=mock .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Use the frontend's documented dev/build command and explicit API URL. For PR #19's existing browser tests, run on a fresh fixture:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
CHROMIUM_PATH=/usr/bin/chromium npm run test:integration
```

Omit CHROMIUM_PATH if using a Playwright-installed browser. The integration script mutates the fixture; do not rerun against the same modified file. These are instructions, not claims that this documentation change executed them.

### B. Real AMD extraction (separate fresh synthetic session)

Do not reuse seeded sessions: AMD extraction rejects sessions with registered observations, and extraction only accepts draft sessions.

1. On the private operator route create an organization via POST /registry/organizations, a professional via POST /registry/professionals and patient via POST /registry/patients with the same organization_id. Create a synthetic case via POST /cases and link it using POST /registry/cases/{case_id}/patient. Preserve returned IDs in a local evidence record.
2. Create a fresh session via POST /sessions with case_id, duration_minutes=40 and invented notes, for example: "Synthetic session only. The child joined a block activity after three verbal prompts. The child placed blocks with minimal assistance. The child paused before changing activities." No real names, dates of birth or health information.
3. Confirm server configuration ELO_INFERENCE_MODE=amd and ELO_SYNTHETIC_ONLY_ACK=true. Trigger POST /sessions/{session_id}/extract only once initially. Expect a pending session; each returned source_excerpt must be an exact continuous substring of the supplied notes. All extracted observations require human decisions.
4. Save sanitized request/response evidence and inspect persisted observations. A successful health response, green mocked tests or a seeded dashboard does not prove AMD inference. Model output may contain fewer than three observations, including zero. Do not promise a fixed count.
5. If no observations are produced, preserve missing_information and honestly show the limitation. Use the separately labeled MOCK fixture for all three decision examples rather than manufacturing AMD output.

## Human review, audit and consolidation

Use the professional ID linked to the patient's organization. It is a synthetic reference, not authenticated clinician identity.

1. Open the session workspace and evidence inspection. Before review, GET /registry/sessions/{session_id}/functional-documentation must show pending observations and consolidation blocked.
2. For each pending observation call POST /registry/observations/{observation_id}/review or use the review UI:
   - approve: reviewer_id and decision=approve;
   - correct: decision=correct, reviewer_id and nonblank reviewed_text; optionally reviewed_domain. Change text or domain meaningfully; for a domain-only correction also supply the unchanged original text;
   - reject: reviewer_id, decision=reject and a nonblank reason.
3. Show at least one approve/correct/reject on the deterministic fixture. On actual AMD output, choose decisions warranted by evidence; do not force a rejection to hit a count.
4. GET /registry/observations/{observation_id}/review-events: expect exactly one new event per successful first decision, with previous/final values, reviewer reference, timestamp and ID. Original source text/excerpt must remain unchanged. Re-review must return 409 without another event.
5. Session-text approval is separate: POST /sessions/{session_id}/approve accepts a pending session with reviewed_text. In PR #19 it may occur before individual observation review; this must never make pending observations eligible for consolidation. Demonstrate a remaining pending observation can still be reviewed after session approval without rewriting session text/status/timestamps. Re-extraction and re-approval of approved sessions must remain blocked.
6. After every observation decision, inspect the preview: accepted includes only approved/corrected, rejected is counted but excluded, pending is zero. Eligibility requires a linked patient, at least one accepted observation and no pending observations. Session approval alone is not the eligibility rule.
7. Show "SYNTHETIC DRAFT — NOT A CLINICAL RECORD". The frontend deterministically assembles accepted evidence from the same read-only functional-documentation endpoint; there is no second consolidation AI call or separately persisted finalized document. Show source_excerpt, original/final values and audit IDs.
8. Return to Operations, Functional Intelligence and AI Governance. Compare counts to actual records rather than hardcoded expected totals. Missing persisted inference telemetry remains unavailable; do not infer latency, tokens, cost, historical provider/model attribution or clinical improvement from counts.

## Failures and honest fallback

- 502 on extraction: record sanitized error; inspect that session remains draft and no observations were committed. Do not retry blindly or present previous fixtures as a successful request.
- 409 on extraction: verify draft status and absence of registered observations; create a fresh synthetic session rather than deleting history.
- 409 on review: check patient linkage, same organization and pending status. Do not bypass safeguards or rewrite audit rows.
- API proxy unavailable: stop the live segment; use already captured evidence only if labeled with its original SHA/time and provenance.
- AMD unavailable: announce **MOCK WORKFLOW DEMONSTRATION — NO LIVE AMD INFERENCE** and use the isolated fixture. An API mock response is not a successful AMD extraction.
- No access protection: keep the demo local/private; deployment and merge require explicit user authorization.

## Evidence boundary

Repository code inspection supports the expected behavior above. Test commands, hosted exposure, PostgreSQL persistence and a live AMD call must be recorded separately when actually verified. Application-level append-only review behavior is not proof of database-enforced immutable history. Never claim unavailable telemetry or unexecuted tests passed.
