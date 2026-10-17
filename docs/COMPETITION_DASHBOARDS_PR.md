# feat: add competition dashboards with traceable synthetic analytics

The application now opens on an Operations dashboard and provides clear navigation to Functional Intelligence, AI Governance and the existing session/review workspace. Metrics come from persisted synthetic records through read-only FastAPI queries; dashboard charts do not use hardcoded example results.

## Changes

- Operations: case/session totals, session and observation status distributions, and observation review completion with an explicit denominator.
- Functional Intelligence: approved/corrected observations grouped by reviewed domain, case-scoped session comparisons, domain filtering and drill-down to original/reviewed values, verbatim excerpts and audit events. Evidence drill-down can load the session into the existing workspace.
- AI Governance: human approval/correction/rejection rates from persisted audit events, exact evidence matching, current API/database/configuration health, and decision traces. AMD connectivity and historical inference attribution are not claimed. Latency, tokens and cost explicitly remain unavailable because the application does not persist them.
- Five read-only dashboard endpoints with parameter-bound filters and bounded detail lists. Empty denominators return unavailable rather than invented rates. Dashboard requests support loading, empty, error, retry, timeout and navigation cancellation states.
- Responsive CSS/SVG visualizations with no new runtime chart dependencies. Existing review components remain unchanged; the original workspace keeps its state while navigating.
- An opt-in synthetic demo seeder that refuses existing files and the default database, plus automated tests, browser smoke tooling and CI execution of frontend unit tests.

## Validation and evidence

- Complete backend suite: **57 passed**; one pre-existing Starlette/httpx TestClient deprecation warning.
- Frontend unit/component suite: **11 passed**.
- TypeScript and Vite production build: **passed**.
- Chromium browser smoke: all three dashboards, reviewed-domain drill-down, source/evidence matching, persisted audit event IDs, navigation into the existing workspace and unavailable telemetry **passed**. No page overflow at **390, 768 and 1440 px**; no browser runtime exceptions.
- API tests verify totals without join multiplication, corrected-domain precedence, case/domain filters, zero-observation sessions, missing sessions, empty denominators, audit-event denominators, exact case-sensitive evidence matching, legacy records without events, bounded limits and safe database failure responses. Dashboard GETs leave persisted cases, sessions, observations and audit events unchanged.
- Seed-file protection test verifies that an existing file cannot be overwritten. The original local application's records were preserved; live validation used a separate database file.

Screenshots show actual queries against the isolated persisted synthetic fixture: 2 cases, 6 sessions, 24 observations and 12 simulated review decisions. The fixture is not a real clinician assessment or model evaluation.

| Operations | Functional evidence drill-down |
| --- | --- |
| ![Operations](https://github.com/Ralado51/elo-functional-intelligence/blob/feat/competition-dashboards/docs/dashboard-evidence/operations.png?raw=true) | ![Functional evidence](https://github.com/Ralado51/elo-functional-intelligence/blob/feat/competition-dashboards/docs/dashboard-evidence/functional.png?raw=true) |

| Governance | Mobile operations |
| --- | --- |
| ![Governance](https://github.com/Ralado51/elo-functional-intelligence/blob/feat/competition-dashboards/docs/dashboard-evidence/governance.png?raw=true) | ![Mobile](https://github.com/Ralado51/elo-functional-intelligence/blob/feat/competition-dashboards/docs/dashboard-evidence/mobile.png?raw=true) |

## Manual validation

Full commands and metric definitions: [Competition dashboard demo](https://github.com/Ralado51/elo-functional-intelligence/blob/feat/competition-dashboards/docs/COMPETITION_DASHBOARDS.md).

1. From `backend`, create a new isolated fixture: `.venv/bin/python -m scripts.seed_dashboard_demo --database data/dashboard-demo.db`. Use a new filename if it already exists. Do not seed or overwrite the default application's database.
2. Start the API with `ELO_DB_PATH="$PWD/data/dashboard-demo.db" ELO_INFERENCE_MODE=mock .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`. Ensure `ELO_DATABASE_URL` is unset in this server shell, since it overrides `ELO_DB_PATH`.
3. From `frontend`, run `npm install --package-lock=false`, then `VITE_API_URL=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`.
4. Operations should show 2 cases, 6 sessions and 24 observations, with 50% reviewed. Open Functional Intelligence, select a case or domain, select a reviewed record and trace the source excerpt, reviewed text/domain, reviewer and audit ID. Open its Session workspace and confirm the existing review UI loads.
5. Open AI Governance. The fixture has 4 approvals, 4 corrections and 4 rejections, each 33.3% of 12 audit events. Confirm Mock mode, unverified provider connectivity and unavailable historical model attribution, latency, tokens and cost.
6. Test a fresh unseeded database for empty states; stop the API and refresh for error/retry behavior. Check mobile navigation and scrollable session tables. Return from the workspace and refresh dashboards after making a review change.
7. Optional automated browser repetition, with the fixture/API/frontend running: `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser` from `frontend`. If using Playwright-installed Chromium, omit `CHROMIUM_PATH`. Screenshots are written under ignored `frontend/dist/dashboard-evidence` by default.

## Dependencies, scope and limitations

- Source: `feat/competition-dashboards`; target: `main`. Inspected base: `93a6968`. Main includes AMD configuration and reviewed functional domains; the functional documentation preview and Sprint 9A changes remain on separate branches and were not imported or overwritten.
- No new database migrations, schema changes, changes to AMD integration, deployment, merge, report signing or final competition submission. Dashboard reads make no provider calls and never approve records.
- Existing databases need main's existing reviewed-domain schema. The local legacy SQLite file lacks these fields, so it was preserved and the demo used a separate fresh file. Missing schema/connectivity yields an actionable 503; automatic migration of existing records is outside this PR.
- All views are synthetic-only research tools, without authentication or tenant authorization. Reviewer IDs are synthetic references. Rates describe stored decisions, not verified identity, model accuracy, clinical progress or diagnoses.
- Detail lists are capped (sessions/reviewed observations default 100; audit events default 30), with total counts and caps displayed. No pagination UI, large-dataset performance claim, PostgreSQL runtime validation or provider-connectivity check is included. Global provenance matching scans the small synthetic dataset.
- Analytics are refreshable snapshots. Historical inference mode/latency/tokens/cost are unavailable, not inferred from today's configuration or prices. Synthetic fixture timestamps are actual creation timestamps, not fabricated longitudinal measurements.
