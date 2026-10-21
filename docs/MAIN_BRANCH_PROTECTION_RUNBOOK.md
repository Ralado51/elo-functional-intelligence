# Main branch protection — owner configuration runbook

Status: **manual owner action required**. The GitHub integration can read repository rulesets but cannot create/update them. The rulesets endpoint returned an empty list on 2026-10-21. Branch protection API access was previously denied (403), so check both Settings > Rules > Rulesets and Settings > Branches.

## Before enabling

1. Open [repository Actions](https://github.com/Ralado51/elo-functional-intelligence/actions) and verify current successful check names on a PR targeting `main`.
2. Existing workflow jobs in `.github/workflows/ci.yml`: `backend`, `frontend`, `postgres-rc`. Container validation job in `.github/workflows/container-validation.yml`: `proxy-smoke`. **Do not assume these are the full GitHub check context names**; choose exact entries from the GitHub UI.
3. Confirm no required check is pending indefinitely or missing on ordinary PRs. CI runs on `pull_request` to `main` and `push` to `main`; container validation runs on `pull_request` to `main` only.
4. Review who needs permission to approve PRs, and whether a sole maintainer can satisfy any approval requirement. Avoid a rule that makes normal maintenance impossible.

## Recommended ruleset

Navigate to **Settings > Rules > Rulesets > New branch ruleset** (if the UI/plan supports it).

- Name: `Protect main`.
- Enforcement: start with **Evaluate** if available, inspect results, then change to **Active**.
- Target branches: default branch / exact `main`, not all historical branches.
- Require a pull request before merging; require at least one approval **only if a distinct reviewer is available**.
- Require status checks to pass; select only exact, recently successful job contexts from the GitHub UI, considering `backend`, `frontend`, `postgres-rc` and `proxy-smoke`.
- Block force pushes and branch deletions.
- Require conversation resolution if your review workflow uses inline comments.
- Keep admin bypasses minimal, explicit, and audited; do not grant blanket bypasses to automations.
- Do not enable merge queue or require deployments without a verified operational need.

If Rulesets are unavailable, use **Settings > Branches > Add branch protection rule** for `main` and configure equivalent protections supported by the repository plan.

## Verification

1. Open a harmless test PR to `main` and confirm all required checks appear and pass.
2. Confirm direct pushes and force pushes to `main` are blocked for applicable actors.
3. Confirm a normal reviewed PR can still merge.
4. Record the resulting rule link, check contexts, enforcement mode and any bypass actors in issue #40.
5. Do not alter deployment or historical AMD release provenance while establishing governance.

**No rules have been applied by this runbook.** This is a proposed owner checklist, not evidence of protection.
