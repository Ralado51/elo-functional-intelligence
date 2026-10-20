# Contributing to Elo Functional Intelligence

## Scope and safety
- The current application is a research prototype using synthetic data only. Never commit real patient data, credentials, production exports, or clinical identifiers.
- Preserve the AMD ACT III submission and deployed artifacts. Changes to production, infrastructure, secrets, and submissions require explicit owner approval.
- Use `main` as the integration branch. Work on short-lived branches: `feat/*`, `fix/*`, `docs/*`, `test/*`, or `chore/*`.
- Open a pull request for each bounded change; do not push directly to `main`, rewrite published history, or force-push.
- Prefer squash merging after checks and review. Avoid merging unrelated changes together.

## Pull request requirements
1. Link the relevant issue and describe motivation, scope, risks, and rollback.
2. Include tests or explain why no test applies.
3. Run backend tests, frontend tests and build, and any affected migration/container checks.
4. Declare whether the change affects sensitive data, access control, AI inference, database schema, or deployment.
5. Require human approval before merge or deployment. A passing CI run is not a clinical safety certification.

## Releases and branches
- Record the exact source commit and deployed image digests for each release; do not assume a release branch matches production.
- Before deleting a remote branch, compare it with `main`, check its PR and unique commits, and preserve any relevant artifacts.
- Do not create a historical AMD release tag until the exact submitted commit is verified.
