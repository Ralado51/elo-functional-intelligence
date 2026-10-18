# Hackathon technical evidence index

**Elo Functional Intelligence · AMD Developer Hackathon ACT III · Health and Wellbeing**

Documentation baseline: main `dcd6961ce2172da76a39a33ea00fe8b1b5317516`. This index describes evidence and its limits; it is not an independent production certification. This release candidate includes the pinned PR #34 visual snapshot and PR #36 guarded family reports; see [combined validation](COMBINED_RELEASE_CANDIDATE.md).

## Evidence classes

| Class | What it establishes | What it does not establish |
| --- | --- | --- |
| Verified source-code facts | Implemented routes, validation, persistence, UI behavior encoded in this checkout and CI configuration. | That this exact commit/image is running in production or every runtime path succeeded. |
| Committed local synthetic screenshots | A captured local synthetic fixture state as described in the associated validation record. | Production state, clinical effectiveness, live AMD provenance or extraction accuracy. |
| User/operator-provided production observations | The operator reports the stated deployment/HTTP/review results. | Independent reproduction by Codex or proof of exact deployed digests/request lineage. |
| Provider-account usage counters | User reports account-level usage displayed by the provider dashboard. | Per-request Elo attribution, model attribution, timing, billing currency or association with OT-001. |
| Assumptions / evidence gaps | Explicitly unresolved facts and proposed future verification. | Permission to fabricate missing measurements or rerun production extraction. |

## Demo, source and architecture

- Published demo URL supplied by the user: [https://app.eloterapia.com.br](https://app.eloterapia.com.br). Protected access may require authorization. Codex did not visit or probe it for this task.
- [README](../README.md): current product, local commands, safety and architecture.
- [API implementation](../backend/app/main.py), [registry](../backend/app/registry.py), [human review](../backend/app/review.py), [database](../backend/app/database.py), [models](../backend/app/models.py) and [migrations](../backend/migrations).
- [Frontend](../frontend/src/main.tsx), [dashboard navigation](../frontend/src/Dashboards.tsx), [Functional Progress](../frontend/src/FunctionalProgress.tsx) and [guided setup](../frontend/src/SyntheticRegistrySetup.tsx).
- [Functional architecture / privacy-gated longitudinal proposal](FUNCTIONAL_PROGRESS_ARCHITECTURE.md). Future design is not implemented lifetime storage.
- [Integration release-candidate record](ACT_III_RELEASE_CANDIDATE.md): exact source commits, local/CI validation, release gates and rollback plan. Original sprint/specification files remain historical context, not a shipped-feature checklist.

## Human-reviewed evidence and committed screenshots

The user reports four persisted AMD-extracted synthetic OT-001 observations, four explicit human approvals and durable reviewer/audit references, plus deterministic documentation. Those production observations were not independently retrieved by Codex in this task; no production export or production capture is added here.

Actual committed captures below are **local synthetic fixture screenshots**, not the user-provided production screenshots:

| Evidence | Existing committed file | Interpretation |
| --- | --- | --- |
| Functional Progress desktop/mobile | [Desktop](functional-progress-evidence/overview.png), [mobile](functional-progress-evidence/mobile.png) | Selected synthetic case/session narrative quantities and source references. |
| Missing/qualitative evidence | [Empty session](functional-progress-evidence/empty-session.png), [qualitative session](functional-progress-evidence/qualitative-session.png) | Missing values remain unavailable; no cross-session carryover. |
| Integrated professional setup/review | [Registry and review](release-candidate-evidence/registry-review.png) | Explicit local organization/professional/patient linkage workflow. |
| Original excerpt and reviewer decisions | [Audit/evidence inspector](release-candidate-evidence/audit-evidence.png) | Local source text, human decision and references. |
| Integrated participation/documentation | [Functional view](release-candidate-evidence/functional-progress.png), [preview](release-candidate-evidence/documentation-preview.png) | Local persisted evidence and deterministic preview rendering. |

The existing source inspector uses `GET /dashboards/sessions/{session_id}/evidence`. Individual decisions use `GET /registry/observations/{observation_id}/review-events`; records use `GET /registry/sessions/{session_id}/observations`. The [review implementation](../backend/app/review.py) appends decision/reviewer/text/domain/time references transactionally and rejects repeat reviews; it has no audit update/delete route. Database-owner tamper resistance and verified professional identity are not established.

## Endpoint inventory verified against source

Paths below are direct FastAPI paths; the demo gateway adds `/api`. Placeholders are route parameters, not invented production IDs.

| Methods | Path | Purpose / source |
| --- | --- | --- |
| GET | `/health` | Configured mode and persistence driver; not a live inference probe. |
| GET, POST | `/cases` | Case registry. |
| GET | `/cases/{case_id}/sessions` | Persisted case history. |
| POST | `/sessions` | Create synthetic session (40 minutes). |
| GET | `/sessions/{session_id}` | Persisted notes/session. |
| POST | `/sessions/{session_id}/extract` | Explicit AMD or mock extraction path. |
| POST | `/sessions/{session_id}/approve` | Session-text approval, separate from observation decisions. |
| GET, POST | `/registry/organizations` | Synthetic organization registration/selection. |
| POST | `/registry/professionals`, `/registry/patients` | Synthetic professional/patient registration. |
| GET | `/registry/organizations/{organization_id}/professionals`, `/registry/organizations/{organization_id}/patients` | Existing organization members. |
| POST | `/registry/cases/{case_id}/patient` | Explicit patient/case linkage. |
| GET, POST | `/registry/sessions/{session_id}/observations` | Observation records/manual synthetic registration. |
| POST | `/registry/observations/{observation_id}/review` | Explicit approve/correct/reject with organization/linkage validation. |
| GET | `/registry/observations/{observation_id}/review-events` | Audit history. |
| GET | `/registry/sessions/{session_id}/approved-observations` | Accepted observations. |
| GET | `/registry/sessions/{session_id}/functional-documentation` | Deterministic preview/eligibility used by consolidated draft; no separate generation POST. |
| GET | `/dashboards/operations`, `/dashboards/functional`, `/dashboards/governance` | Read-only aggregate dashboards. |
| GET | `/dashboards/functional-progress` | Case listing or selected-case session evidence via `case_id` query. |
| GET | `/dashboards/sessions/{session_id}/evidence`, `/dashboards/reviewed-observations` | Source/decision drill-down and filtered reviewed records. |

## Operator-provided production validation — October 17, 2026

These observations were supplied by the user/operator, **not independently reproduced by Codex**. No exact probe timestamps, response bodies, live image digests or redacted operator log bundle were supplied with this task.

| Component / route | Operator-reported result |
| --- | --- |
| API | Healthy |
| Frontend | Healthy |
| PostgreSQL | Healthy |
| Migration job | Exited with code 0 |
| `/api/health` | HTTP 200 |
| `/api/dashboards/operations` | HTTP 200 |
| `/api/dashboards/functional-progress` | HTTP 200 |
| `/api/dashboards/functional-progress?case_id=OT-001` | HTTP 200 |
| Session evidence endpoint | HTTP 200; concrete session ID/URL not supplied. Corresponding implemented route is `/api/dashboards/sessions/{session_id}/evidence`. |

HTTP 200 alone is not a clinical correctness assessment or full end-to-end review audit. `/health` itself reports mode/key presence and persistence driver rather than executing an AMD request or a database query. The configured container healthcheck separately probes SQL connectivity.

Repository deployment evidence: [Portainer Compose](../deploy/portainer/compose.demo.yml), [runbook](../deploy/portainer/README.md), [API exposure guidance](DEMO_API_EXPOSURE.md), [Compose validator](../scripts/validate-portainer.py) and [proxy runtime smoke](../scripts/proxy-smoke.sh). These verify/configure digest pinning, isolated database/volume, migration sequencing, protected routing and no application/database host ports. They do not independently verify the currently deployed environment. Capture previous approved image digests through secure operator release records before an authorized update; do not invent them.

## AMD usage and request attribution

[AMD execution evidence](AMD_EXECUTION_EVIDENCE.md) records the supplied all-time and October 17 counters exactly, explains the active Token Factory/DeepSeek-V4-Flash-default integration, and identifies attribution gaps. Counters are account-wide, not six proven Elo calls; model defaults do not certify the model serving each historical request. No request IDs, latency, cost conversion or accuracy claim is fabricated. No provider usage screenshot/export is committed with this documentation.

## CI and test evidence

Verified historical GitHub results as inspected during this documentation task:

- [Main CI at `dcd6961`](https://github.com/Ralado51/elo-functional-intelligence/actions/runs/39063153605): backend and frontend jobs successful.
- [Integration CI](https://github.com/Ralado51/elo-functional-intelligence/actions/runs/39062496647): backend/frontend successful; [container validation](https://github.com/Ralado51/elo-functional-intelligence/actions/runs/39062496662) successful, including image builds without push and Nginx/synthetic GET/POST/changed-IP proxy checks.
- The [integration validation record](ACT_III_RELEASE_CANDIDATE.md) reports **95 backend tests**, **42 frontend tests**, successful production build, one targeted isolated PostgreSQL workflow test, and local browser workflow verification. These are historical baseline results, not newly executed product tests for this documentation-only change.

Actual commands/configuration: [CI](../.github/workflows/ci.yml) installs backend requirements and runs `PYTHONPATH=. pytest -q`; frontend uses `npm ci`, `npm test`, `npm run build`. [Container CI](../.github/workflows/container-validation.yml) runs the Compose validator, builds both images locally and runs proxy smoke. [Manual image workflow](../.github/workflows/demo-images.yml) is distinct from PR container validation; it is not invoked by this task. Browser scripts in [frontend/scripts](../frontend/scripts) require prepared fixtures/server and Chromium, rather than being automatic arbitrary-data checks.

For this change, executed documentation checks passed: **63 relative repository links** resolve, **27 listed route/method pairs** match generated OpenAPI, and both provider token sums reconcile. CI commands were compared with workflow/package sources; `git diff --check` passed and the changed-file list contains only the README and these two evidence documents. No fresh product-suite execution, live probe, AMD call, container publication or deployment is claimed.

## Remaining evidence gaps and limits

- No committed production screenshots/log bundle or provider-counter export supplied here. Existing fixture captures must not be relabeled as production evidence.
- No independently verified mapping from provider requests to OT-001 observation IDs, exact model used per request, deployed digests, request timestamps, latency or monetary cost.
- Verbatim source matching proves textual provenance, not semantic correctness; no labeled clinical benchmark, clinical outcome, developmental norm or longitudinal improvement is established.
- Human UUID references are not authenticated professional identities; append-only API history is not a tamper-proof database. Real-patient privacy/consent, access control and retention are future design gates.
- Session creation is limited to 40 minutes. Functional evidence remains narrative with heuristic topic grouping and bounded session selection; missing information is not zero.
- The combined release includes the selected-session visual snapshot and opt-in family reports. Live family inference remains unverified; see the combined release record.
- Any additional production collection, image publication, deployment, live inference or hackathon submission requires separate authorization. Do not rerun extraction or replace existing synthetic records to fill evidence gaps.
