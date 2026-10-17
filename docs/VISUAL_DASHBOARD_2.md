# Visual Functional Dashboard 2.0

## Scope and evidence mapping

Frontend-only enhancement from main `dcd6961`. The current API continues to admit only approved/corrected records with matching human decision, reviewer, original/reviewed text/domain, timestamp and verbatim source evidence. No migration, dependency, new inference request, record replacement or write endpoint is introduced. Operations, Functional Intelligence, AI Governance and Session Workspace are unchanged.

| Visual | Persisted input | Meaning and traceability |
| --- | --- | --- |
| Task initiation marker | Selected session's `evidence` with `initiation` topic | Literal reviewed account, e.g. three verbal prompts only when recorded. |
| Attention marker | `attention` topic | Literal account retains approximation, e.g. approximately eight minutes. |
| Motor marker | `motor` topic | Literal account retains independence and denominator, e.g. seven out of ten attempts; never converted into a success/clinical score. |
| Transition marker | `transitions` topic | Literal account retains bound and assistance, e.g. within two minutes with verbal guidance. |
| Session matrix | Each session's eligible topic presence | Filled dot = reviewed account for that topic; dash = no reviewed account. Explicit no-observation state differs from recorded but not reviewed evidence. No activity outcome, denominator or missing measurement is inferred. |
| Reading sequence | Fixed topic navigation labels | A reading guide only, explicitly not observed temporal activity order. |
| Child illustration | Original handwritten SVG | Fictional conceptual block activity, not a patient representation, posture assessment, sensor output or reconstruction of this session. |

Every marker links to an observation card with exact source, authoritative reviewed text, reviewer ID, approval/correction status and audit-event IDs. Its existing trace button opens the original source/human-decision inspector. Multiple eligible observations are retained; none is selected as “best.” Missing topics remain unavailable. Empty sessions do not show an activity overview. Other cases may contain different activities: the illustration is explicitly illustrative, not evidence that blocks were used. No parser silently turns text, negation, approximation or a correction into a numeric claim. This intentionally uses large literal narrative metrics rather than an unsupported donut or Excellent/Good/Missed categories.

The matrix is keyboard-operable and horizontally scrollable on narrow screens. Its record numbers map to the existing newest-first session list; timestamps are entry times, not verified activity occurrence dates. Topic grouping inherits the existing heuristic and bounded API response, not a standardized assessment or longitudinal trajectory.

## Screenshots and executed validation

Before screenshots are the previously checked-in local synthetic fixture captures from the baseline implementation. After screenshots use the same persisted OT-001 fixture database and source observations, without rewriting it. They are not production screenshots or new AMD output.

- [Before desktop](visual-dashboard-evidence/before-desktop.png) / [After desktop](visual-dashboard-evidence/after-desktop.png)
- [Before mobile](visual-dashboard-evidence/before-mobile.png) / [After mobile](visual-dashboard-evidence/after-mobile.png)
- [Empty session](visual-dashboard-evidence/empty-session.png) / [Qualitative-only session](visual-dashboard-evidence/qualitative-session.png)

Executed: backend complete suite **95 passed**, one existing Starlette/httpx deprecation warning; frontend **45 passed**; TypeScript/Vite production build passed. New UI regressions cover marker provenance, matrix selection/empty-session isolation and corrected negative wording. Chromium smoke passed exact four OT-001 narratives, audit/source drill-down, empty and qualitative sessions, another synthetic case, widths 390/768/1440 without page overflow, no runtime exceptions and no POST/extraction/provider requests. Production data and live AMD connectivity were not accessed.

## Manual review, impact and rollback

1. Open Functional progress with existing local synthetic records; choose OT-001 if present. Confirm the conceptual illustration and literal reviewed accounts. Follow each marker to its source card and open the audit inspector.
2. Select matrix columns and corresponding session-list items. Check no-observation and qualitative-only sessions never inherit the previous session's quantities. Try another case, a missing-topic record and a narrow viewport; horizontally scroll the matrix.
3. Revisit Operations, Governance, Functional Intelligence and Session Workspace. Existing review, source decisions and deterministic documentation remain separate.
4. Run frontend `npm test` / `npm run build` and backend `PYTHONPATH=. .venv/bin/python -m pytest -q`.

Deployment requires separate authorization. This changes frontend assets only, reuses the existing read-only endpoint and adds no runtime service, image publication, infrastructure or schema change. An authorized rollback restores the previous approved frontend image digest/configuration. Keep API/PostgreSQL digests and all persisted data unchanged; never reset the database or re-extract observations. Actual approved digests must be supplied from operator release records, not invented here.
