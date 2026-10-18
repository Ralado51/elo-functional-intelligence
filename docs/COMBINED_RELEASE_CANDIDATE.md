# Combined ACT III release candidate

Isolated branch `release/act-iii-combined-rc`, from main `dcd6961ce2172da76a39a33ea00fe8b1b5317516`. This is a candidate for review, not an approved production release. No merge to main, image publication, production access/change, deployment, real AMD inference or hackathon submission occurred.

## Exact integrated sources and order

| Order | Source | Exact source head | Local integration merge |
| --- | --- | --- | --- |
| 1 | PR #34 selected-session functional snapshot | `f495d3667672736348cab374c65987b46463b879` | `e5336f8` |
| 2 | PR #36 guarded family reports | `5e96dfde7cbcc6dd6ed9d94216250564c83c8979` | `c298fe3` |
| 3 | PR #35 hackathon documentation/evidence | `21bb4c3e48eb6ef199f95ad36be8eda83b750c3f` | `9063c3b` |

All three merged locally without conflicts or discarded tests. Original PRs remain open. Exact final candidate SHA and CI run links are recorded in the RC PR; no future main merge SHA or image digest is invented here.

## RC changes beyond the pinned sources

- Compose passes family-report enablement and operator credential to API only, disabled/empty by default. `.env.example` documents empty placeholders, never actual credentials.
- Compose validator explicitly tests unset defaults, opt-in wiring and absence of AMD/operator secrets in frontend, migration and PostgreSQL environments.
- README/evidence index now describe the combined features instead of treating #34 as absent. Historical test/account/production evidence remains labeled historical or operator-provided.
- New `postgres-rc` CI job and [validation harness](../scripts/validate-combined-rc.py) cover populated 0004→0005 migration, preserved protected-table fingerprint, mocked report approval/rejection, durable duplicate protection, original API compatibility and backup restoration. The harness requires an explicitly named loopback `elo_rc*` disposable database; prepare refuses nonempty data. It is not a deployment seed.

## Executed combined checks

- Complete backend: **117 passed**, one existing Starlette/httpx deprecation warning.
- Frontend: **58 passed** across seven files. TypeScript/Vite production build passed.
- Compose security/normalization: passed default-off and API-only credentials, digest binding, auth, network, migration gate and missing-required-input checks.
- Isolated PostgreSQL 16: created revision 0004, explicitly prepared eight approved original-wording observations and their audit references across two synthetic cases plus an empty session, saved a protected-table fingerprint and custom-format dump, then upgraded to 0005. Existing cases/sessions/observations/reviews/registry rows remained byte-for-byte equivalent under canonical JSON hashing.
- Mocked PostgreSQL family lifecycle: Draft→Approved and Draft→Rejected; repeat decisions blocked; generation repeats after engine recreation reused existing results; exactly two mock provider invocations for two sessions. Schema/reference checks and authorization boundaries passed. No real key or provider was used.
- Rollback compatibility: archived main `dcd6961` backend read sessions, observations, audit, documentation and dashboard endpoints successfully against upgraded PostgreSQL while preserving the fingerprint. This tests previous-source compatibility, not unavailable production image digests.
- Backup restoration: pre-upgrade logical dump restored into a separate new disposable database, then baseline API and protected-row fingerprint verification passed. No existing database/volume was overwritten.
- Chromium combined UI: Operations, Functional Intelligence and Governance; exact original-wording snapshot; source/audit drill-down into registry review; deterministic preview/consolidated draft; saved approved mocked family report. Desktop/mobile captures had no page overflow, runtime errors or POST/inference calls. Backend outbound provider/extraction functions were replaced with explicit failure guards for browser reads.
- Local container build attempted but blocked by the cloud proxy CA inside the build image. TLS verification remained enabled. Full container/proxy CI must be checked on the RC PR, separately from local results; the workflow builds without pushing.

[Functional desktop](combined-rc-evidence/functional-desktop.png) · [Functional mobile](combined-rc-evidence/functional-mobile.png) · [Family desktop](combined-rc-evidence/family-approved-desktop.png) · [Family mobile](combined-rc-evidence/family-approved-mobile.png).

All images are isolated synthetic fixtures with mocked family output, not live AMD or production evidence. The report schema uses constrained family paraphrases and optional activity catalog selection; it is not unrestricted clinical generation. Historical provider account counters cannot attribute requests to this report.

## Security boundaries

AMD key remains server-side in API environment only. Frontend build uses `VITE_API_URL=/api`, never `VITE_*` provider secrets. The separate operator credential is manually entered into component memory, sent as a custom header over protected HTTPS/loopback and excluded from print; no browser persistence. It is not the AMD credential.

Family feature defaults off. When later authorized, require a 32+ character operator token, synthetic server acknowledgement, explicit UI synthetic confirmation, registered same-organization reviewer/patient linkage, accepted source/audit-verified records, and supported closed-vocabulary text. IDs, raw notes, sources and audit metadata stay local; only aliases and bounded synthetic text/choices reach the provider. Unknown/identifier-containing input is rejected before a provider call.

The public demo is synthetic-only. BasicAuth and a shared operator token do not constitute verified clinical identity, real-patient privacy/consent or tenant RBAC. Maintain operator-only write access; do not expose port 8000/5432 or broaden CORS. Preserve all-route HTTPS/BasicAuth and redact credentials in proxy/operator logs. Health mode reports configuration, not measured provider success.

## Deployment prerequisites — no execution authorized

1. Obtain human approval of the exact RC and green backend/frontend/PostgreSQL/container CI. Independently review visual evidence and clinical-safety limits; tests do not grant approval.
2. Record actual deployed Git ref, API/frontend/PostgreSQL immutable digests, stack/project name, volume name, credentials bindings and schema revision through authorized operator records. These were not inspected in production and must not be guessed.
3. Require deployed revision 0004 (or verify already-compatible 0005). An older/divergent revision requires separate review; earlier migrations can modify existing fields, so do not blindly run all migrations.
4. Freeze the eventual approved release SHA after merge authorization. Only after separate publication authorization, dispatch the existing manual `demo-images.yml` on frozen main and verify the workflow `headSha`. Expected tags are `ghcr.io/ralado51/elo-functional-intelligence-api:<release-sha>` and `...-frontend:<release-sha>`; deploy the actual resolved **digests**, with the same API digest for migration/API. Publication rebuilds images, so smoke-test the exact published digests before deployment. Keep current approved PostgreSQL digest unchanged.
5. Pause writes/traffic for this stack only; keep PostgreSQL and all unrelated stacks available. Capture an encrypted custom-format `pg_dump` using existing secure container credentials without printing them. Record encrypted-backup checksum and validate a restore into an isolated new database. Retain original protected-record hashes/counts privately. Never store dumps or secrets in Git.
6. In the existing Portainer stack, preserve project/volume/database password/PostgreSQL digest, external Traefik network `portainer_default`, `websecure`, `leresolver`, domain and BasicAuth. Update reviewed API/frontend digests and Git ref. Keep family reports disabled; operator token is supplied only via secure API configuration. No automatic Git polling/webhooks/updates.
7. After deployment authorization only, recreate migration job with the new API digest, verify fresh exit 0 and revision 0005, then API/frontend health. Confirm unchanged original records/audits. Do not bypass the migration gate or treat an old successful job as fresh validation.
8. After separate one-call inference authorization only, follow [family-report live procedure](FAMILY_REPORT_MVP.md) on approved isolated synthetic data. Run read-only preflight, confirm no reservation and valid accepted evidence, then choose **one** generation path (UI OR CLI), not both. Leave resulting content Draft; on failure/uncertainty inspect saved state only. Never delete reservations, reset data or retry for a better result.

## Rollback

Disable family reports and restore recorded previous API/frontend digests and previous approved configuration together. Keep PostgreSQL digest, password, volume and additive 0005 table/report history. No `alembic downgrade`, table drop, `down -v`, data reset or extraction. Main `dcd6961` source was tested against upgraded schema, but actual prior image digests/provenance still require operator verification and exact-image rehearsal. Preserve diagnostic logs and consumed attempts. A destructive restore over current data is not authorized; any exceptional recovery needs its own reviewed plan using the encrypted backup and an isolated replacement, without overwriting the current volume.

## Remaining release blockers

Human approval; verified production revision/configuration; secure production operator-token provisioning if the feature is later enabled; exact approved rollback image digests; eventual release SHA and newly published/tested digests; separately authorized live AMD validation. Production rollout, publication and inference remain outside this RC authorization. The latest complete CI results are linked in the RC PR.
