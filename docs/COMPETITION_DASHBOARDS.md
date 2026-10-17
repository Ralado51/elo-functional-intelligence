# Competition dashboard demo

Three read-only dashboards use the application's persisted synthetic records. Operations is the default screen; navigation also exposes Functional intelligence, AI governance and the original Session workspace. Dashboard drill-down opens the existing review workspace without replacing its components.

## Base and dependencies

Built from actual `main` at `93a6968`. That branch includes reviewed functional domains and opt-in AMD extraction. Functional documentation preview and Sprint 9A are not merged into that main and are not prerequisites for these dashboards. No feature branches were merged or cherry-picked. Existing functional documentation and review components are unchanged.

No migrations, schema changes, chart dependencies or AMD calls were added. The current application models and existing migrations (including `0004_reviewed_functional_domain`) are required. An older SQLite file lacking reviewed-domain columns cannot support the functional queries; the API returns an actionable 503 rather than fabricating data. Preserve/back up older databases and handle their existing migration path separately. The demo below uses a fresh isolated file and does not modify existing records.

## Start an isolated demonstration

From `backend`, with Python 3.12 and installed `requirements.txt`:

```bash
.venv/bin/python -m scripts.seed_dashboard_demo --database data/dashboard-demo.db
ELO_DB_PATH="$PWD/data/dashboard-demo.db" ELO_INFERENCE_MODE=mock \
  .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Unset `ELO_DATABASE_URL` in the server shell if it points at another database: that variable overrides `ELO_DB_PATH`. Never print a credential-bearing database URL. The seed process explicitly selects the new file, refuses existing files and refuses the default `data/elo.db`. To repeat the demo, choose a new filename. It creates 2 synthetic cases, 6 sessions, 24 observations and 12 simulated review decisions through existing API routes. These are demonstration fixtures, not real clinician assessments or model evaluations. No AMD provider request occurs. Fixture session timestamps reflect creation time; there are no invented longitudinal dates.

From `frontend`, in a second terminal:

```bash
npm install --package-lock=false
VITE_API_URL=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Use the running local application in your development environment. Port 5173 is supported by the existing backend CORS policy. No public preview or deployment is needed.

## Demonstration path

1. Operations: inspect 2 cases, 6 sessions, 24 observations and 50% review completion. Session statuses are 2 draft, 2 pending and 2 approved. Observation statuses are 12 pending, 4 approved, 4 corrected and 4 rejected. These numbers are queried from the seeded database, not hardcoded UI values.
2. Functional intelligence: select a synthetic case if desired. Inspect reviewed-domain distribution and the session comparison table. Select **Transitions**, then **View evidence** on a reviewed observation. Compare original text/domain, reviewed text/domain, source excerpt, exact substring match and persisted audit event ID. **Open session workspace** loads the original session and review component.
3. AI governance: inspect decision rates, evidence matches and decision traces. The fixture contains 4 approvals, 4 corrections and 4 rejections: each rate rounds to 33.3% of 12 audit events. Pending observations are excluded from this denominator.
4. Confirm inference is Mock, provider connectivity is unverified, and historical model attribution, latency, tokens and cost are unavailable. Configuring AMD mode does not establish a historical inference call or provider health.
5. Check narrow/mobile layouts. Session comparison tables scroll inside their container. Use **Refresh dashboard** after making changes in the Session workspace. Analytics are snapshots, not a live subscription.
6. For an empty-state demo, start the API with a different fresh database file without seeding it. To validate errors, stop the API and refresh a dashboard; restart it and use **Retry**. Stalled dashboard requests time out after 12 seconds and are cancelled on navigation.

## Metric definitions and API

| GET endpoint | Meaning |
| --- | --- |
| `/dashboards/operations` | Global case/session counts, session/observation statuses, reviewed observations / all observations |
| `/dashboards/functional?case_id=...&limit=100` | Accepted observations by final domain; per-session counts, including sessions with no observations |
| `/dashboards/reviewed-observations?case_id=...&domain=...&limit=100` | Approved/corrected records with original and reviewed values and identifiers |
| `/dashboards/sessions/{id}/evidence` | Persisted source excerpts, exact case-sensitive note matching, reviewer and decision audit events; 404 for a missing session |
| `/dashboards/governance?limit=30` | Human audit decision distribution/rates, evidence-match counts, current runtime configuration and explicit telemetry unavailability |

Operations review completion includes approved, corrected and rejected observations; an empty denominator returns `null`/Unavailable. Governance rates use persisted audit events, not inferred clinician activity or model accuracy. Legacy accepted observations with no event do not create an implied audit decision. Corrected domains take precedence over original domains, falling back for legacy null/blank reviewed domains. Pending and rejected observations are excluded from reviewed-domain distributions, but remain visible with their status in evidence drill-down.

Domain totals and rate denominators cover the selected/all data, even when a detail list is capped. Functional sessions and reviewed lists default to the newest 100 (maximum 500); audit events default to 30 (maximum 200). Displayed totals and limits are explicit. There is no pagination UI in this hackathon scope. Cross-case totals are administrative descriptions, not longitudinal clinical comparisons. No counts imply progress, diagnosis, clinical effectiveness or quality.

## Validation

```bash
# backend
PYTHONPATH=. .venv/bin/python -m pytest -q

# frontend
npm test
npm run build

# With the isolated seeded API + Vite running:
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

If system Chromium is unavailable, install Playwright's Chromium using your normal development setup and omit `CHROMIUM_PATH`. The browser check requires the exact isolated fixture above and performs no writes. `DASHBOARD_BASE_URL` can change the frontend address. Screenshots default to ignored `frontend/dist/dashboard-evidence`; set `DASHBOARD_EVIDENCE_DIR` to another writable directory if needed.

The automated browser flow verifies all dashboards, domain/evidence/audit drill-down, loading a session into the existing workspace, unavailable telemetry, no page overflow at 390/768/1440 pixels, and no browser runtime exceptions. Unit/API tests also exercise empty/error/timeout states, retry, cancellation, SQL-bound filters, denominators, old records without audits and record immutability under dashboard GETs. Frontend unit tests run in CI before the production build.

## Limits

This is an unauthenticated, synthetic-only research prototype; dashboard queries are global, not tenant-authorized. Reviewer IDs are synthetic references. Counts do not verify that an identity was authenticated. Provider health is not tested by dashboard requests, and historical inference telemetry is not persisted. Global evidence matching scans the small synthetic dataset; no large-data performance claim or PostgreSQL runtime validation is made. Original review behavior is inherited from main; Sprint 9A remains separate. No clinical report signing, automatic clinical approval, deployment or final competition submission was added.

The complete review description and captured desktop/mobile evidence are in [the PR description](COMPETITION_DASHBOARDS_PR.md).
