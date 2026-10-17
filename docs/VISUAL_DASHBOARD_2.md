# Functional Progress — selected-session activity snapshot

## Review-blocker correction in existing PR #34

Removed the grouped chart of approved-observation counts from Functional Progress. Documentation volume is a staff/administrative concept and is not a child-participation measure. Existing Operations/Governance implementations are unchanged; no duplicate administrative chart is added here. The primary view now has one consistent measurement scope: the **selected session only**. Session buttons navigate separate snapshots, not a longitudinal comparison. A session with no observations explicitly says **ability unknown**, never zero ability.

The original fictional-child SVG remains central, with prompts, approximate attention duration, documented independent numerator/denominator, and bounded transition with guidance. The ring depicts the selected session's documented attempt fraction, not a clinical score, achievement percentage or improvement. Full reviewed wording, original excerpts, assistance, reviewer and human-decision/audit references remain in expandable details, linked from each marker and the ring.

## Exact original OT-001 wording

The regression fixture [ot001-original.json](../frontend/tests/fixtures/ot001-original.json) preserves the four user-supplied reviewed narratives verbatim:

1. “Required three verbal prompts to begin the block-fitting activity”
2. “Maintained attention for approximately 8 minutes during the block-fitting task”
3. “Used both hands to manipulate blocks and completed 7 of 10 fitting attempts independently, with minimal physical assistance for the remaining attempts.”
4. “Hesitated during transition to a second activity but responded to verbal guidance and completed the transition within 2 minutes.”

These yield **3 verbal prompts**, **approximately 8 minutes**, **7 / 10 independent attempts**, and **within 2 minutes**. Motor qualifiers preserve both hands and minimal physical assistance for remaining attempts. Transition qualifiers preserve hesitation and verbal guidance. Neither assistance nor approximation is discarded. Exact narratives are available through the source links; numeric labels are presentation projections, not replacements for reviewed records.

[Projection rules](../frontend/src/documentedMeasurements.ts) add anchored, whole-sentence forms for these original descriptions. Required clauses remain mandatory. There is no generic search for a number near a clinical keyword: prefixes, suffix caveats, negation, uncertainty, unsupported ranges and changed assistance invalidate the projection. Existing supported full-sentence forms remain compatible. Multiple records in one topic are not silently reduced to one measurement.

If a value cannot be reliably projected, the card shows the **original reviewed narrative** and **Not structurally measurable**. No zero, guessed value or fabricated clinical conclusion is substituted. Unknown or unsupported languages remain narrative. The existing backend source/audit integrity gate is unchanged; a textual match does not independently establish measurement correctness or clinical validity.

## Tested before/after with identical original-wording records

A new disposable local database was explicitly prepared for this regression, using the exact reviewed descriptions above and explicit synthetic API approvals. For these local fixtures only, session notes/source excerpts are the supplied sentences; this is **not an export or independent verification of original production notes/excerpts**. Existing demo/local fixture records were not rewritten, reset, replaced or re-extracted. No provider request was made.

The previous `14c085d` frontend was served from a temporary read-only source copy. Before and after views read the **same persisted fixture database**. The browser asserted that the old revision failed all four numeric projections and that the corrected revision displays all four values/qualifiers. Observation records were compared before/after browser navigation and were unchanged; each retains one explicit approval audit event.

| Evidence | Before at `14c085d` | After correction |
| --- | --- | --- |
| Full desktop, 1440px | [Original wording before](visual-dashboard-evidence/original-wording-before-desktop.png) | [Original wording after](visual-dashboard-evidence/original-wording-after-desktop.png) |
| Full mobile, 390px | [Original wording before](visual-dashboard-evidence/original-wording-before-mobile.png) | [Original wording after](visual-dashboard-evidence/original-wording-after-mobile.png) |

- [Updated first viewport, 1440×900](visual-dashboard-evidence/original-wording-first-viewport.png)
- [Activity close-up](visual-dashboard-evidence/original-wording-activity-closeup.png) / [mobile close-up](visual-dashboard-evidence/original-wording-mobile-closeup.png)
- [Exact reviewed text, source and audit inspector](visual-dashboard-evidence/original-wording-source-audit.png)
- [Empty session: no measurement carryover](visual-dashboard-evidence/original-wording-empty.png)

Earlier screenshots remain historical and do not represent this correction. In particular, earlier simplified-sentence fixtures and administrative chart captures are not evidence of correct projection of the original descriptions.

## Executed verification

- Frontend: **51 tests passed** across six files; TypeScript/Vite production build passed.
- Complete backend suite: **95 passed**, one existing Starlette/httpx TestClient deprecation warning. Backend implementation unchanged.
- New regression cases cover all four exact originals, original assistance/hesitation qualifiers, refusal of negation/uncertainty/caveats or changed support wording, no documentation-count chart, source links, and empty-session no carryover.
- Chromium before/after: old revision fails four projections; corrected snapshot has all four values/qualifiers, exact source/audit links, no count chart, no empty-session carryover, full composition above fold at 1440×900, no page overflow at 390/768/1440px, no runtime errors or POST/extraction/provider requests. Persisted observations remain unchanged.
- `git diff --check` passed. No inference, schema, database reset, dependency, authentication, infrastructure or publication workflow changes.

Commands: frontend `npm test`, `npm run build`; backend `PYTHONPATH=. .venv/bin/python -m pytest -q`. These are local results, not a fresh production certification or a claim about pending PR CI.

## Manual review and limitations

Select a synthetic case/session and compare each highlight to its exact reviewed narrative. Follow the marker/ring links, verify source, approval, reviewer and audit references, then inspect the original decision through the trace action. Select the empty session: the ring must show unavailable, with ability unknown and no carried-over values. Confirm unsupported wording remains narrative and not structurally measurable. Review desktop and mobile captures, then revisit the unchanged Operations, Functional Intelligence, Governance and Session Workspace.

No longitudinal comparability, trend, diagnosis, clinical score or improvement claim is established. Session timestamps are record-entry times. Topic grouping remains heuristic and the case/session list bounded. Synthetic reviewer IDs are references, not professional authentication. Only local test evidence was accessed. Clinical privacy/consent/authorization and real-life longitudinal measurement design remain outside scope.

Frontend assets only, existing read-only API contract unchanged. No merge, image publication, deployment, production data modification, new AMD inference or submission. If later authorized, rollback restores the previously approved frontend digest/configuration, preserving API/PostgreSQL images and all records/audit events. Actual approved digests must come from secure operator records; never reset data or re-extract observations for rollback. Stop for renewed human review.
