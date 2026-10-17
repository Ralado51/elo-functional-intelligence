# Agent handoff
Snapshot: 2026-10-17. Recheck branch tips before acting; this is not deployment authorization.

## Constraints
Synthetic pediatric occupational therapy data only; sessions are 40 minutes. No automated diagnosis, clinical progress claims, automatic human approval or signed clinical records. Preserve original evidence and append-only application audit events. Never request or commit credentials. Never merge, deploy, modify shared VPS stacks/databases, or submit without explicit user authorization.

## Verified repository facts
- Main inspected at 93a69684798768e2e3a6625935e9e8085bab1889.
- Main CI run 39022715964 succeeded: logs show 44 backend tests and TypeScript/Vite production build.
- PR18 head inspected at e69b5962fd1962a8b13fb5699f93e96372658409, branch feat/demo-ghcr-pipeline, target main. It normalizes GHCR names, uses Docker DNS dynamically, includes migrations in backend image and excludes local files from Docker contexts.
- At that PR18 snapshot, frontend uses npm install without a lockfile, container validation is workflow_dispatch-only, and no runtime proxy smoke exists. Publishing is main-only and manual.
- PR19 head inspected at 0e47e12884d9287224ed9c8e652c0b27f89e602e, branch fix/approval-review-integration, target feat/competition-dashboards. Dashboard parent is 17580b2232e21de686ccfa8079a800dff18cc9c7.
- PR19 contains dashboard parent plus review/documentation integration, ahead of inspected main by two commits. Its claimed test counts require independent verification.
- Existing CI pull_request filter targets main only; PR19 targets a feature branch.
- Backend research API has no application authentication. CORS is not access control.
- Current orchestration runtime has no Docker executable; container execution and production network verification cannot be claimed here.

## Active ownership
- Existing external Builder: dashboard/application branches. Do not edit its branch or infer shared chat access.
- Session pipeline agent: isolated supplemental branch based on PR18; reproducible frontend dependencies, PR container checks and GET/POST/DNS-recreation smoke. No image publication.
- Session deployment agent: deploy files and deployment documentation only; protected app.eloterapia.com.br template, isolated PostgreSQL and no host ports. No deployment.
- Session independent reviewer: read-only PR19/dashboard review and integration dependency plan.
- Orchestrator: handoff, dependency coordination, independent checks and focused PR descriptions.

## Integration plan (requires review and user-approved merges)
1. Review complete dashboard + PR19 feature chain against main; use a main-target PR to obtain CI without silently merging any branches.
2. Complete PR18 supplemental corrections, review CI and runtime smoke evidence.
3. Reconcile pipeline with final functional source before manually publishing release images. Do not present packaging-only source as complete application.
4. Select verified API/web image digests and validate migrations in isolated PostgreSQL.
5. Validate HTTPS, audience authentication, rejection of unauthorized writes, no direct API/web ports and full synthetic operator flow before approved deployment.

## Assumptions and unverified dependencies
- Traefik network, entrypoint and certificate resolver names are unknown and must be supplied from actual infrastructure.
- Portainer GHCR pull permissions/package visibility are unverified.
- AMD live provider connectivity, credentials, PostgreSQL runtime/migrations and production routing have not been verified by this orchestration session.
- A source excerpt substring match proves provenance of quoted text, not semantic or clinical correctness.
- Audience read-only access and private authenticated operator writes need explicit routing in deployment; do not silently expose every POST behind a public proxy.

## Acceptance evidence
Record SHA, command, environment and actual output for backend tests, frontend tests/build, Docker builds, proxy GET/POST/query handling, API recreation, migration upgrade and immutable original evidence/single decision audit regression. Mark unexecuted checks pending. Live AMD validation must use synthetic input with acknowledgment, preserve pending review state, record reviewer decision/audit, and produce only a labeled draft. Never invent latency, costs, tokens or success measurements.

## Execution update
- PR20 owns this handoff; PR21 is a main-target snapshot of PR19/dashboard, without branch merges.
- Independent detached-worktree tests at 0e47e12 executed: 85 backend tests passed (one existing deprecation warning), 26 frontend tests passed, production TypeScript/Vite build passed. CI39029221235 also succeeded. These supersede the earlier author-claims-only caveat for those three checks only.
- PR22 proposes protected standalone Portainer stack. YAML/structural checks passed; Compose/runtime/external checks remain pending. Audience is authenticated read-only; operator writes require private access.
- PR23 targets PR18 branch and adds real lockfile/npm ci and no-push container/proxy/DNS-change validation. Container Actions are pending at update time; never treat workflow presence as passed execution.
- Final combined package.json differs from packaging baseline: regenerate lockfile after feature integration and preserve npm test.

- Container validation run39029252132 at PR23 initial commit 1e0a1fe succeeded: both Docker images, nginx syntax, synthetic 40-minute GET/POST and API IP-change recovery without restarting web. Latest PR23 605fcab restores exclusions and reduces token permissions; its CI39029295554 succeeded, container rerun39029295547 pending at this update. No registry image push was executed.
