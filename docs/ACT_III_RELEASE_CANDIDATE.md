# ACT III integration release candidate

## Source and integration

Base: `7e57b85fc49f59ca42dac60599ed3109ae2c3953` (latest main at integration).

| Source PR | Exact source commit | Integration commit |
| --- | --- | --- |
| #30 synthetic registry setup | `069a4594fa346c3fe0fff6451e242599ebe9d58b` | `94adadc` |
| #32 functional participation evidence | `5f29d6d1834dc384760ee05b751f73a7b39d0853` | `9a32c05` |

Both source PRs had successful backend, frontend and proxy-smoke CI checks when inspected. Changes were cherry-picked on an isolated branch from main without conflicts or discarded tests. Neither source PR was merged/closed. No application changes beyond those implementations were necessary. The additional integration regression exercises both contracts together, with inference replaced by a failing sentinel.

## Combined workflow and evidence

Explicit organization/professional/patient registration and case linkage permit four separate human decisions; each decision retains original excerpts and durable audit references. Functional progress reads those accepted records by case/session; the existing inspector displays source and decisions. Deterministic documentation remains separate from clinical approval. Operations, Governance and the AMD extraction implementation are unchanged.

Local screenshots use newly created disposable synthetic records, not production records or new AMD output:

- [Registry setup and observation review](release-candidate-evidence/registry-review.png)
- [Functional participation](release-candidate-evidence/functional-progress.png)
- [Original evidence and human decisions](release-candidate-evidence/audit-evidence.png)
- [Existing documentation preview](release-candidate-evidence/documentation-preview.png)

## Executed local checks

- Complete SQLite backend suite: **95 passed**, one existing Starlette/httpx deprecation warning.
- Frontend: **42 passed**; TypeScript/Vite production build passed.
- PostgreSQL **16**: existing Alembic migrations applied to a new isolated local container database; combined workflow regression **1 passed**. This is targeted PostgreSQL compatibility, not the complete suite against PostgreSQL (existing tests deliberately choose disposable SQLite).
- Chromium UI: empty registry -> explicit organization/professional/patient creation -> case linkage -> four separate approvals -> four audit events -> eligible deterministic preview -> Functional progress -> source/decision inspector. Operations/Governance navigation and preview rendering passed. Read-only progress/inspector issued no POST requests, and no extraction/provider calls occurred.
- `python scripts/validate-portainer.py`: passed normalized Compose, synthetic inputs, auth/isolation/migration contracts and missing-input rejection.
- Local image build attempted. The default build network could not reach dependencies; host networking with existing proxy bindings reached the proxy but failed certificate verification for its signing CA. Verification was not disabled. Therefore local container runtime/proxy smoke is blocked until trust is configured; source PR container CI was green. Check the integration PR's separate container CI before approving release.
- Diff review: no migrations, inference/provider changes, image-publication workflow changes, dependency changes, authentication or infrastructure changes. New dashboard is GET-only, uses bound case/session parameters, preserves literal measurements and excludes incomplete source/audit references. Test/screenshot measurement examples are synthetic fixtures, not application defaults or progress claims. No credentials added; synthetic test password only belongs to the disposable local PostgreSQL instance.

To reproduce: backend `PYTHONPATH=. .venv/bin/python -m pytest -q`; frontend `npm ci && npm test && npm run build`; `python scripts/validate-portainer.py`; then normal local image builds and `bash scripts/proxy-smoke.sh`. Optional PostgreSQL regression: create an **empty disposable database only**, run existing `alembic upgrade head` with `ELO_DATABASE_URL`, then run `tests/test_release_candidate_workflow.py` with `ELO_TEST_INTEGRATION_URL` pointing to that database. Never supply production credentials or reuse a production/shared database.

## Release checklist — requires human approval

- [ ] Review integration diff, screenshots and latest backend/frontend/container CI. Keep #30/#32 open until integration disposition is agreed.
- [ ] Independently record currently approved API/frontend/PostgreSQL digest references and source ref from the actual protected deployment. Those values are unavailable in this checkout; do not guess or replace them with current tags.
- [ ] Rehearse with synthetic records: select persisted organization and reviewer, confirm existing patient linkage, inspect four original observations, confirm audit references, open case/session participation, inspect original evidence, generate deterministic preview, revisit Operations/Governance. Do not reapprove completed production records or run extraction merely to demonstrate the UI.
- [ ] Resolve local container trust limitation or rely on reviewed successful integration container CI; validate release artifacts by immutable digest after separately authorized publication. Preserve synthetic-only AMD configuration and existing protected routes.
- [ ] Obtain separate explicit authorization for merge, image publication and eventual deployment. This PR authorizes none of those actions.
- [ ] Before authorized deployment, securely capture this stack's backup/revision and previous image references. Keep all existing records/audit events and current authentication/network settings intact. No automatic seed, reset, new AMD request or unrelated stack change.
- [ ] Release matching API/frontend source together; confirm migration state remains unchanged, health, review navigation and read-only views. No new migration is introduced.

## Rollback plan

Use the previously approved **exact** `ghcr.io/...-api@sha256:<recorded-api-digest>` and `ghcr.io/...-frontend@sha256:<recorded-frontend-digest>`, with the previously approved Git ref/configuration. These are placeholders describing required operator records, not deployable digest values. Keep the current approved PostgreSQL digest, persistent volume and credentials unchanged. There is no schema/data transformation to reverse; do not downgrade migrations, reset data, remove volumes or re-extract observations. If rollback is authorized, restore both application images together, verify health and source/audit/documentation reads, and preserve diagnostic logs. Follow the existing Portainer runbook; do not touch other stacks or shared databases.

## Remaining limitations

Live production was not accessed or modified. Actual approved rollback digests require an authorized operator record before release. Local container runtime validation is blocked by build-network CA trust; integration CI must be reviewed. PostgreSQL coverage is one end-to-end API contract rather than every SQLite-specific test. Synthetic UUID selection is not professional authentication; existing deployment protection remains required. Functional evidence is narrative and topic grouping heuristic, with bounded recent sessions, not standardized clinical progress or lifetime storage. No real data, diagnosis, automatic approval, clinical report signing, publication, deployment or submission is introduced.
