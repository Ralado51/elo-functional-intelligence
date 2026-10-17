# Portainer GitOps synthetic demo — preparation only

This directory prepares a **new, isolated Docker Standalone stack**, not a Swarm service. It does not deploy, build/publish images, change existing VPS stacks, use a shared database, or enable automatic updates. Runtime deployment requires separate explicit authorization. Only the existing external network `portainer_default` is reused.

Public URL: **`https://app.eloterapia.com.br`**. Traefik must already have entrypoint `websecure` and certificate resolver `leresolver`. One HTTPS router covers the whole hostname, including `/api`, with mandatory BasicAuth. Frontend, API and PostgreSQL have **no published host ports**. Do not add direct-port overrides or an unprotected second router.

## Mandatory image prerequisites — deployment is blocked until satisfied

The reviewed packaging source supplies the production frontend Dockerfile and manual GHCR application workflow, including Alembic assets. Artifact publication and verification are still separate gates: workflow presence is not evidence that any usable registry digest exists. The application workflow publishes `-api` and `-frontend`; older `-web` artifacts are incompatible with this contract. The manual `postgres-mirror.yml` workflow prepares the third artifact only after an operator supplies an independently reviewed official PostgreSQL 16 source digest. No publication is triggered by a PR or merge.
Prepare and publish the following immutable artifacts through an independently reviewed build/release process. Image publication is not performed by this PR or by Portainer. Use source from an explicitly approved application release: configuration main does not itself include the separate dashboard/documentation/audit integration changes. Record the source commit, build recipe, platform and resolved registry digest for every release.

| GHCR repository under `GHCR_NAMESPACE` | Required contract |
| --- | --- |
| `elo-functional-intelligence-api` | Python 3.12; installed `backend/requirements.txt`; `/app/app`, `/app/alembic.ini`, complete `/app/migrations` from the **same** source commit; readable by UID/GID `10001:10001`; Python and `python -m alembic` on PATH; no required writes outside `/tmp`. Same digest used for migration and API. Compose intentionally overrides its entrypoint. |
| `elo-functional-intelligence-frontend` | Production static React/Vite build with **`VITE_API_URL=/api` at build time**; unprivileged Nginx-compatible gateway on port **8080**, UID/GID `101:101`; serves `/` and proxies `/api/` to `http://api:8000/`, stripping the prefix; handles SPA fallback. No Vite dev server, localhost API URL, required runtime templating in read-only `/etc`, or baked credentials. |
| `elo-functional-intelligence-postgres:16` | A trusted mirror of the official **PostgreSQL 16** image, preserving its official entrypoint, `postgres`, `pg_isready` and `/var/lib/postgresql/data` contract. Verify source registry manifest and major version before mirroring; record the destination GHCR manifest digest (which can differ after copying). No custom initialization importing any existing/shared database. |

All three image references require `@sha256:` plus a supplied 64-character digest. The PostgreSQL `:16` tag is descriptive; the digest is authoritative, so verify that its contents really are version 16. Verify architecture matches the VPS, including any multi-platform manifest. Digest pinning prevents tag drift but does not authenticate an untrusted publisher; review provenance and scan artifacts before approval.

The frontend image must bake an equivalent gateway configuration into its reviewed artifact (this is an image contract, **not** a fourth file mounted from Git):

```nginx
# See frontend/nginx.conf for the complete image configuration.
# Inside the non-root server listening on 8080:
absolute_redirect off;
resolver 127.0.0.11 valid=10s ipv6=off;
set $api_upstream api;
location = /api { return 308 /api/$is_args$args; }
location /api/ {
    rewrite ^/api/(.*)$ /$1 break;
    proxy_pass http://$api_upstream:8000;
    proxy_set_header Host $host;
    proxy_set_header Authorization "";
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_redirect http://$host/ /;
    proxy_read_timeout 120s;
}
location / { try_files $uri $uri/ /index.html; }
```

Preserve POST bodies/Content-Type and query strings. Compose supplies Uvicorn's `/api` root path for generated documentation/redirect URLs while the gateway strips that prefix before forwarding. Uvicorn does not trust client proxy headers; the gateway rewrites its HTTP absolute redirects to relative URLs so browsers retain external HTTPS. Test both trailing-slash redirects and Swagger/OpenAPI paths. Do not apply the SPA fallback to failed API responses. Nginx writable PID/cache/temp paths must fit the declared tmpfs mounts; start it without entrypoint scripts rewriting `/etc`. Configure process-level worker/connection limits appropriate to the host. Test image compatibility with the configured users, read-only root filesystems, dropped capabilities and tmpfs before release. None of these image behavior contracts can be proved by Compose parsing alone.

## GHCR and Git authentication in Portainer

1. For private images, add a **GHCR registry credential** for `ghcr.io` in Portainer, scoped to this Docker environment. Use a dedicated account/token with package read access (`read:packages` where applicable), proper package permissions and organization SSO authorization if required. Portainer must use that registry credential for all three image pulls. Public images may not need pull credentials. Do not put registry tokens in Compose, stack environment variables, Git URLs or chat.
2. Private Git checkout is a separate credential: use Portainer's repository authentication with read-only access to this repository. Registry access does not establish Git access, or vice versa. Never embed either token in the repository URL.
3. Image pushes belong to the separate release process; the VPS/Portainer pull credential must not have package write/delete privileges. A GHCR image can be private even if its linked repository is public.

## Portainer stack environment variables

Use `.env.example` as a **name/reference template only**, not a populated file to commit. Enter actual values in Portainer's environment-variable UI for this new stack. Restrict access to Portainer, Docker and backups: environment values and the BasicAuth password hash are visible to administrators, and the hash is stored in Docker labels. Environment variables are not a secret vault.

| Variable | Required value |
| --- | --- |
| `GHCR_NAMESPACE` | Approved lowercase GHCR owner/organization; default `ralado51`. All three repositories above must exist there. |
| `API_IMAGE_DIGEST` | Verified API image digest, **64 lowercase hex characters without `sha256:`**. |
| `FRONTEND_IMAGE_DIGEST` | Verified frontend image digest, same format. |
| `POSTGRES16_IMAGE_DIGEST` | Verified PostgreSQL 16 GHCR mirror digest, same format. Keep the same major version for updates/rollback. |
| `POSTGRES_PASSWORD` | A new strong password used **only by this stack's** `elo_demo` role/database. Generate securely, e.g. `openssl rand -hex 32`, and enter securely in Portainer. The Python entrypoint URL-encodes arbitrary characters and fixes the target to this stack's `postgres:5432/elo_demo`; no shared/external DSN override is accepted. |
| `DEMO_BASIC_AUTH_USERS` | One or more comma-separated `username:bcrypt-hash` htpasswd records. Generate interactively with `htpasswd -nB demo-operator` on a trusted workstation. Never commit hashes or plaintext passwords. All operators/audience receive synthetic-only instructions. |
| `TRAEFIK_ROUTE_PREFIX` | Unique router/service/middleware name prefix, default `elo-functional-demo`. Verify it does not collide with another existing stack; do not rename others. |
| `ELO_INFERENCE_MODE` | `mock` by default. Set `amd` only after explicit approval for **synthetic** outbound inference. No automatic switch when a key exists. |
| `ELO_SYNTHETIC_ONLY_ACK` | `false` by default. Must be exactly `true` to allow AMD extraction. This is an operator acknowledgment, **not** automated detection/removal of real patient data. |
| `RADEON_API_KEY` | Empty in mock mode; valid AMD key supplied securely in Portainer only when enabling approved synthetic inference. Never use a `VITE_` variable for it. |
| `RADEON_MODEL` | Approved provider model, default `DeepSeek-V4-Flash`. Check actual account/model availability separately. |

For Portainer UI values, paste bcrypt hashes with **literal single `$` characters** and no surrounding shell quotes. Compose does not recursively interpolate a value inserted by `${DEMO_BASIC_AUTH_USERS}`. Do **not** paste `$$` into the UI value. If validating with a local `.env` instead, single-quote the entire hash value in that local file to suppress `.env` interpolation; if ever writing a literal hash directly in Compose YAML, `$` escaping differs—do not do that here. Validate the resolved hash locally without printing it. Credentials containing `$` must remain literal too.

Compose's rendered `config` output can serialize literal `$` as `$$` for safe re-parsing. This is output-format escaping, not an instruction to double dollars in the Portainer input. Do not copy serialized secret values back into the UI. Actual authentication must still be tested against the authorized running release.

`POSTGRES_DB`/`POSTGRES_USER` are fixed to `elo_demo`. The PostgreSQL initialization account also owns this **isolated demo cluster**; it is not a least-privilege production role design. This user/password cannot target another VPS database through these services. Changing `POSTGRES_PASSWORD` on an already initialized volume does **not** rotate the database role password; plan an authorized database-level rotation and synchronized stack change separately.

## Networking and exposure review

- `postgres` and `migrate` only join a new project-scoped, internal `database` network. The volume is new/project-scoped, not external and has no globally shared name. Do not reuse an existing volume, `container_name`, external database network, host bind or database URL.
- The API joins internal `database`/`application` networks and a new project-scoped `api_egress` bridge for outbound AMD HTTPS. It does **not** join `portainer_default`; `traefik.enable=false` is explicit on API, PostgreSQL and migration services.
- Only the frontend joins the existing `portainer_default`. Its one Host router attaches mandatory BasicAuth and uses `websecure`/`leresolver`. It gateways `/api` to the private API, so all audience-facing frontend and API routes share authentication. BasicAuth headers are removed before forwarding. No new HTTP router or shared-Traefik setting is changed.
- The shared Traefik Docker network is a **trusted infrastructure boundary**, not tenant isolation. Containers already attached to it may reach the frontend directly without traversing Traefik middleware. Do not grant untrusted workloads access to that network; do not use this demo to host real patient data. BasicAuth is an audience gate, not application authorization or verified clinical identity.
- Writes remain available **behind BasicAuth** for explicitly authorized synthetic operators. If providing a passive audience view, enforce a separate read-only policy in the gateway image; do not expose unauthenticated write endpoints. CORS is not authentication. Same-origin `/api` avoids broadening the application's existing localhost CORS allowlist.
- AMD destination is fixed to `https://developer.amd.com.cn/radeon/api/v1`. Apply outbound restrictions at the VPS/network layer through a separately approved change if needed; this Compose file does not change firewalls or existing stacks. Synthetic acknowledgment plus BasicAuth does not prevent an authenticated operator typing real data; procedures and access restrictions are mandatory.

## Initial deployment — only after explicit authorization

1. **Read-only preflight:** verify the intended Docker Standalone environment supports Compose v2 `service_healthy` and `service_completed_successfully`. Swarm `docker stack deploy` is unsupported: it does not provide this migration sequencing. Verify `portainer_default`, the two Traefik settings, DNS/TLS reachability and available resources. Confirm **no existing router/stack already owns this hostname or route prefix**. A collision blocks deployment; do not modify the existing owner without separate approval.
2. Validate and approve image provenance/contracts above. Record the release source commit, all three digests, previous release (if any), environment-variable names, migration head and backup location in a release record **without secret values**. Use a unique stable stack name such as `elo-functional-demo` whose generated network/volume names do not collide with existing resources.
3. In **Stacks → Add stack → Repository**, select this repository, an approved immutable Git commit/ref, and Compose path **`deploy/portainer/compose.demo.yml`**. Configure repository/registry authentication separately as needed. Do not use the root development Compose files. Enter variables securely; do not load credentials from Git. Keep Git polling, webhooks, scheduled redeploys, Watchtower and other auto-update mechanisms **disabled**.
4. Validate the resolved Compose model locally/through the approved environment without printing secrets. Unset required passwords, hashes or digest fields fail parsing. Validate digest format and bcrypt records separately; `${VAR:?…}` rejects empty inputs but is not a full value validator. No runtime build or source bind mount occurs.
5. After deployment authorization, deploy **only this new stack**. PostgreSQL must become healthy, then the one-shot `migrate` container must run `python -m alembic upgrade head` and exit **0**, then API health must pass, then the frontend starts. A migration failure blocks new API startup: diagnose it, never remove the dependency or bypass verification. Confirm the migration container's actual digest/log timestamp and database Alembic revision; an old successful container is not evidence of a new migration run.
6. Check unauthenticated `https://app.eloterapia.com.br/`, `/api/health`, `/api/cases`, API POST paths and unknown paths: all should challenge with **401** and BasicAuth, not return app content or mutate data. Check no second router bypasses it. Authenticate interactively (do not put passwords in URLs/logged commands), verify frontend assets, `/api/health`, database persistence and approved **synthetic** create/review workflows. Verify no frontend/API/PostgreSQL host port is published; port 8000/5432 must not be remotely reachable.
7. Use a disposable synthetic case to check evidence, review decisions, audit history and documentation behavior in the chosen application image. Check mock mode first; enable AMD only through a separately approved variable change with synthetic acknowledgment and valid credentials. Provider mode reporting is not proof of provider success or persisted token/cost measurements.

Compose dependency conditions govern **Compose orchestration**, not Docker daemon restarts, arbitrary manual container starts or every Portainer redeploy behavior. Do not start the API independently of the migration gate. Keep backups and verify sequencing on the actual Portainer release before relying on it. No startup/runtime claim is made by this PR.

## Updating and rollback — no automatic updates

Before an authorized update, capture current Git ref, all digests, schema revision and encrypted database backup for **this stack only**. Arrange a maintenance window: stop traffic and this stack's frontend/API before migrations so old code cannot write against a changing schema. Leave PostgreSQL available for backup/migration. Update reviewed digests/ref in Portainer, recreate the migration job if needed, and inspect a **fresh** successful migration run before starting the new API/frontend. Do not update another stack, shared network, shared database or Traefik installation.

If migrations did not change the schema (or backward compatibility was explicitly tested), restore the previous Git ref and previous application digests, verify migration sequencing/health and reopen traffic. **Reverting an image does not revert database migrations.** If schema compatibility is unknown or a migration is destructive, keep the application stopped; obtain separate authorization for a tested restore of this stack's pre-update backup to an isolated replacement volume/stack, or a reviewed migration recovery. Do not run an unreviewed `alembic downgrade`, change PostgreSQL major versions, delete volumes, or restore over a shared database. Never use `down -v` as rollback. Preserve the failed release logs and existing volume for diagnosis.

Back up with an authorized operator using this stack's PostgreSQL tooling (`pg_dump`/`pg_restore`) and encrypted off-host storage; never commit database exports or print password environment values. Rehearse restoring a backup and verifying audit/evidence records before the actual demo. Passwords remain in Portainer's secure configuration during rollback, not in the Git release record. Retain previous images in GHCR so their recorded digests remain pullable.

## Validation scope for this PR

Compose parsing/normalization and static configuration checks can be run with explicitly synthetic validation inputs, e.g. non-existent all-zero digests and an obviously test-only hash/password, **without pulling or starting services**. These values are only for `docker compose config`; never deploy them. Inspect the resolved model programmatically for digest format, all auth/router bindings, no host ports/builds, network separation, same API/migration digest, dependency gates and absence of external/shared volumes. `docker compose config` prints secrets unless suppressed or captured privately—do not paste its full output into logs.

For a securely stored local validation-only environment file outside the repository, syntax validation without printing its values is:

```bash
docker compose --env-file /secure/path/elo-demo.env --project-name elo-functional-demo \
  -f deploy/portainer/compose.demo.yml config --quiet
```

No registry artifact pull, image signature/provenance verification, PostgreSQL initialization, Alembic execution in a container, actual Portainer startup ordering, Traefik/BasicAuth/TLS request or VPS change has been performed. Runtime release validation remains mandatory and separately authorized. This is deployment preparation, not a deployed or certified secure environment.

Configuration checks executed with Docker Compose **v2.40.3**: normalization passed using synthetic-only inputs; programmatic assertions passed for all four GHCR digest references, no host ports/builds/bind mounts, the single authenticated TLS router, network/volume isolation, migration/API/frontend dependency gates, safe mock defaults and missing-required-variable failures. Compiling the healthcheck and executing the Python DSN entrypoint with `os.execvp` mocked verified reserved password characters and fixed isolated database targeting without starting a service. An independent Codex agent reviewed all three files and reported no blocking static defects; its required follow-up is real image-contract and authorized Portainer/TLS/BasicAuth validation once artifacts exist.

A local FastAPI TestClient check also passed for the ASGI `/api` root path, Swagger's `/api/openapi.json` reference and trailing-slash redirect paths. This exercised the checked-out Python application only, not a pinned image, real Uvicorn/Nginx/Traefik chain or Portainer deployment.

## Reproducible pre-release checks

Run `python scripts/validate-portainer.py` with Docker Compose v2 installed. It supplies only synthetic, nondeployable inputs and captures normalized configuration without printing credentials. PR CI runs this check and the no-push container smoke. The latter uses UID 101, port 8080, a read-only root, dropped capabilities and the exact writable tmpfs paths; checks GET/POST/query/redirect/docs handling and recreates API at a different IP. CI does not certify Portainer, Traefik, TLS or BasicAuth runtime behavior.

The PostgreSQL mirror workflow is manual-only, main-only and requires a reviewed official source SHA256. It verifies PostgreSQL major 16 on the selected platform before copying, and records source/platform/destination digest in its summary. Independently review upstream provenance/security advisories before authorizing dispatch, and verify that the destination digest remains pullable. No digest is supplied by this repository; deployment remains blocked until all three artifacts are verified.
