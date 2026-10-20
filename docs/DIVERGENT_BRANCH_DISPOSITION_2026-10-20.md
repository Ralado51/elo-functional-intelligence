# Divergent branch disposition — 2026-10-20

This report follows [issue #40](https://github.com/Ralado51/elo-functional-intelligence/issues/40) and the baseline inventory merged via PR #39. GitHub PR state and compare results are authoritative for **ancestry and PR history**, not semantic equivalence of code.

## Branch/PR cross-reference

| Divergent branch | Ahead of main at inspection | Historical PR | Historical disposition | Proposed classification |
| --- | ---: | --- | --- | --- |
| `feat/amd-token-factory-inference` | 10 | #14 | merged | merged history; retain until equivalence and deployment references checked |
| `feat/demo-ghcr-pipeline` | 10 | #18 | closed without merge | investigate superseding container/image workflow before cleanup |
| `feat/functional-documentation-preview` | 8 | none found by head branch in current PR history | no matching PR found | unreviewed historical branch; investigate source and semantic differences |
| `feat/portainer-gitops-demo` | 1 | #25 | closed without merge | investigate superseding Portainer configuration before cleanup |
| `feat/protected-portainer-stack` | 2 | #22 | closed without merge | investigate superseding infrastructure configuration before cleanup |
| `feat/sprint-9b-consolidated-draft` | 12 | #17 | merged | merged history; check squash equivalence |
| `feat/ux-review-workspace-sprint6` | 3 | #13 | merged | merged history; check squash equivalence |
| `fix/pr18-container-validation` | 13 | #23 | closed without merge | investigate superseding container validation workflow |
| `fix/review-integrity-loading` | 12 | #16 | merged | merged history; check squash equivalence |

Comparison file scopes:
- Clinical/review overlap: `backend/app/main.py`, `backend/app/review.py`, `backend/app/functional_documentation.py`, `frontend/src/ReviewWorkspace.tsx`, `frontend/src/FunctionalDocumentationPreview.tsx`, CI and tests.
- Infrastructure overlap: `.github/workflows/demo-images.yml`, `.github/workflows/container-validation.yml`, Dockerfiles, `frontend/nginx.conf`, `deploy/portainer/compose.demo.yml`.

## Evidence and remaining checks

1. Merged PRs may have been squash-merged; ahead counts alone are not evidence of missing work.
2. Closed-without-merge PRs must not be treated as approved. Compare current `main` behavior and workflows to their patches before marking superseded.
3. For each divergent branch, inspect unique commit patches and check deployment/workflow references before any deletion.
4. No release tags were found in the inspected release API; independently confirm exact AMD submitted SHA and deployed immutable digests before creating a historical tag.
5. The GitHub rulesets endpoint returned `[]`, while reading branch protection returned `403 Resource not accessible by integration`. This does not prove that branch protection is absent; owner must inspect settings.
6. Do not set required CI status checks until their exact names and stability are verified.

## Suggested owner approval gates
- Review a final per-branch deletion candidate list after semantic checks.
- Confirm AMD release provenance from operator records.
- Configure `main` protection using owner permissions, ensuring rules do not deadlock the repository.
- Approve any deletions separately; no force pushes or history rewrites.

**No deletion, deployment, merge, release publication or production mutation is authorized by this document.**
