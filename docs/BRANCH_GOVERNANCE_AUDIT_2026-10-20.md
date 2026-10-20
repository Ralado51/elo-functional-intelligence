# Branch inventory — 2026-10-20

Read-only comparison of each remote branch against `main` using GitHub compare API. Ahead/behind counts describe commit ancestry, **not** whether equivalent changes have been integrated by squash/cherry-pick.

## Branches with unique commits (do not delete without inspecting diffs)
| Branch | Ahead | Behind |
| --- | ---: | ---: |
| feat/amd-token-factory-inference | 10 | 42 |
| feat/demo-ghcr-pipeline | 10 | 41 |
| feat/functional-documentation-preview | 8 | 42 |
| feat/portainer-gitops-demo | 1 | 41 |
| feat/protected-portainer-stack | 2 | 41 |
| feat/sprint-9b-consolidated-draft | 12 | 42 |
| feat/ux-review-workspace-sprint6 | 3 | 59 |
| fix/pr18-container-validation | 13 | 41 |
| fix/review-integrity-loading | 12 | 42 |

## Branches without unique commits relative to main (eligible for later cleanup review)
- chore/hackathon-demo-temporary-public-access
- docs/hackathon-demo-runbook
- docs/hackathon-evidence
- docs/orchestrator-handoff
- feat/auditable-functional-domain-review
- feat/competition-dashboards
- feat/family-report-draft
- feat/functional-progress-dashboard
- feat/sprint-1-foundation
- feat/sprint-2-persistence
- feat/sprint-3-case-history-ui
- feat/sprint-4-evidence-contract
- feat/sprint-4b-http-transport
- feat/sprint-5a-api-postgres-cutover
- feat/sprint-5a-postgres-foundation
- feat/sprint-5a-sqlite-import
- feat/sprint-5b-relational-model
- feat/sprint-5c-clinical-api
- feat/sprint-5d-observation-review
- feat/sprint-5e-review-workspace
- feat/visual-functional-dashboard
- fix/approval-review-integration
- fix/elo-api-dns-alias
- fix/gitops-image-contracts
- fix/synthetic-review-registry
- integration/act-iii-release-candidate
- integration/reviewed-functional-demo
- release/act-iii-combined-rc

## Safety gates
1. Verify the exact AMD submitted commit and deployed GHCR digests before creating any historical release tag.
2. Inspect unique commits and PR history for all nine divergent branches before deciding whether to archive or delete.
3. Verify no deployment or external automation depends on a branch before removing it.
4. Obtain explicit approval for remote branch deletion and for branch protection changes.
5. Never force-push or rewrite historical commits.
