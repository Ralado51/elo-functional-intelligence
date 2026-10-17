# Visual Functional Dashboard 2.0 — PR #34 revision

## Revised composition

This revision updates PR #34's existing branch, not a replacement PR. A compact analytics strip shows a documented independent-attempt ratio and grouped domain bars per session. The central fictional-child SVG sits between four concise source-linked highlights. Full reviewed narratives, session timestamps, sources, assistance, patient/reviewer references and audit IDs remain in expandable details below. Other dashboards, review, registry and documentation components are unchanged.

The complete analytics strip, central illustration and highlights fit together at **1440 × 900** in the local browser capture. At **390px** the charts and activity overview stack; session bars scroll horizontally when needed. Keyboard-operable session buttons and native evidence details retain focus indicators.

## Evidence mapping and conservative projection

The existing read-only API admits only accepted records with matching source and human audit evidence. The frontend does not write measurements or change this API.

| Visual | Input and meaning |
| --- | --- |
| Attempts ring | Explicit independent numerator / recorded attempts denominator from a supported full reviewed motor sentence. The remainder is not labeled failed, dependent or missed; no percentage or clinical score is presented. |
| Initiation | Supported complete reviewed account states a count of verbal prompts. |
| Attention | Supported complete reviewed account explicitly says approximately a number of minutes; the Approximate qualifier is retained. |
| Transition | Supported complete reviewed account says within a number of minutes with verbal guidance; both bound and support are retained. |
| Grouped bars | Count of eligible reviewed observations per domain/topic in each session, not activity performance. Empty or unreviewed sessions remain explicit. No interpolated curve or improvement claim. |
| Child | Original handwritten conceptual SVG, not patient imagery, movement analysis or reconstruction of this session. |

[Projection rules](../frontend/src/documentedMeasurements.ts) match the **whole** reviewed sentence against a deliberately small English template set; number words zero–twelve and integer numerals are supported. No default clinical quantities are embedded in application display logic. An unrecognized sentence, negative/uncertain statement, added caveat, unsupported range, impossible denominator or multiple records in one topic produces **Measurement unavailable**, with the full evidence still accessible. This is a conservative presentation projection, not general clinical NLP, structured measurement storage or independent validation that a value was measured correctly. Unsupported languages/phrasing stay narrative; no value is fabricated to fill a card. App case selection remains dynamic, not OT-001-only.

Each highlight links to its exact observation card and expands the source section. The card retains human-reviewed wording, verbatim original source, approval/correction, reviewer ID, time and audit-event IDs. The existing trace action opens the source/decision inspector. Corrections remain authoritative; source wording is shown separately. Sessions are newest-record-first, not a verified occurrence-time sequence. One observation can appear in multiple topic counts; bars do not imply mutually exclusive measurements.

## Before/after evidence

All screenshots use existing local persisted synthetic OT-001 fixture records. No production data, AMD calls, reset, automatic seed or record replacement occurred.

- **Before this revision:** [1440px desktop](visual-dashboard-evidence/revision-before-desktop.png), [390px mobile](visual-dashboard-evidence/revision-before-mobile.png). These preserve the prior PR #34 captures.
- **After:** [Full desktop](visual-dashboard-evidence/revised-desktop.png), [Full mobile](visual-dashboard-evidence/revised-mobile.png).
- **First viewport:** [1440 × 900 analytics composition](visual-dashboard-evidence/revised-desktop-fold.png).
- **Close-ups:** [Charts](visual-dashboard-evidence/revised-charts-closeup.png), [central activity](visual-dashboard-evidence/revised-activity-closeup.png), [mobile activity](visual-dashboard-evidence/revised-mobile-closeup.png).
- **Missing evidence:** [Empty session](visual-dashboard-evidence/revised-empty.png), [qualitative-only session](visual-dashboard-evidence/revised-qualitative.png).

Original baseline and first-iteration captures are preserved in the evidence directory for historical comparison; they do not represent this revision.

## Executed validation

- Frontend: **49 tests passed** across six files; TypeScript/Vite production build passed.
- Complete backend suite: **95 passed**, one existing Starlette/httpx TestClient deprecation warning. No backend change.
- Regression coverage: exact templates and qualifiers, denominator validation, negative/uncertain/range/caveated wording, qualitative absence, ambiguous multiple accounts, marker-to-expanded-source navigation, session selection and no evidence carryover, existing loading/error/retry/cancellation behavior.
- Chromium: explicit 3 prompts, approximately 8 minutes, 7/10 independent attempts and within 2 minutes with verbal guidance from the selected persisted records; ring and grouped bars; first-viewport fit at 1440×900; source/audit expansion; empty/qualitative sessions; no page overflow at 390/768/1440px; no runtime errors, POSTs or inference requests.
- `git diff --check` passed. No inference, auth, infrastructure, database, dependency or publication-workflow changes. No deployment/runtime image claim is made.

Commands: frontend `npm test` and `npm run build`; backend `PYTHONPATH=. .venv/bin/python -m pytest -q`. Product tests ran locally; latest GitHub CI is a separate check on the PR.

## Manual visual review and rollback

1. Open Functional progress with existing local synthetic records; select OT-001 if available. At 1440×900 verify chart strip, central illustration and compact highlights are visible together. Check the Approximate/Within qualifiers and ratio denominator.
2. Follow each evidence link; confirm details expand with exact text, excerpt, reviewer and audit IDs, then use the existing trace inspector.
3. Select an empty, qualitative-only or different session. Counts/measurements must not carry over. Inspect unsupported wording through details. At 390px verify readable stacked cards and usable chart scrolling.
4. Revisit Operations, Functional Intelligence, Governance and Session Workspace. They retain existing implementations. No live extraction is needed for review.

Frontend assets only; no new schema, runtime service or API contract. Publication/deployment require separate explicit authorization. An authorized rollback restores the previously approved frontend image digest/configuration, preserving API/PostgreSQL digests and every record/audit event. Obtain actual approved digests from operator records; never reset the database or re-extract observations. No merge, image publication, production modification, deployment or submission is performed by this PR.
