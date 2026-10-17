# Protected synthetic demo preparation (not deployed)

`deploy/portainer.compose.yml` is a **standalone Docker Compose** stack for
`app.eloterapia.com.br`; do not combine it with development overrides or use
Docker Swarm's stack deployment. No VPS configuration is changed by this file.

## Verified dependencies and boundaries

- PR #18 supplies the API image's Alembic files and the web image's same-origin
  `/api/` proxy to `api:8000`. Its frontend build must use `VITE_API_URL=/api`.
  Those changes are not yet main at preparation time. Do not release main images
  until the approved feature integration and container validation are complete.
- API configuration uses `ELO_DATABASE_URL`, `ELO_INFERENCE_MODE`,
  `ELO_SYNTHETIC_ONLY_ACK`, `RADEON_API_KEY`, and `RADEON_MODEL`.
- All site GET/HEAD requests require HTTPS and BasicAuth at Traefik, including
  `/api/`. No router in this stack matches POST/PUT/PATCH/DELETE/OPTIONS. This is
  an **audience read-only** route, consistent with PR #19's exposure guidance.
  Existing extraction and review buttons will be denied through this route.
- PostgreSQL belongs only to this stack, with a stack-scoped volume and private
  network. No host ports exist. Only web joins the existing Traefik network.
  API additionally joins a new stack-scoped egress network for AMD HTTPS.
- Credentials never belong in Git, frontend variables, screenshots or chat.
  BasicAuth is an audience boundary, not clinician identity or tenant authorization.

## Required private Portainer configuration

Use a new unique stack name such as `elo-functional-demo`. Create its environment
privately in Portainer. Do not reuse any JJ AI Platform or existing database.

| Variable | Required value |
| --- | --- |
| `ELO_API_IMAGE` | `ghcr.io/ralado51/elo-functional-intelligence-api:<approved-full-sha>` or `@sha256:<digest>` |
| `ELO_WEB_IMAGE` | Matching web image `ghcr.io/ralado51/elo-functional-intelligence-web:<approved-full-sha>` or digest |
| `ELO_POSTGRES_PASSWORD` | New random URL-safe password using letters, digits, `_` and `-`; URL interpolation requires this restricted alphabet |
| `ELO_SYNTHETIC_ONLY_ACK` | `true`, only after the operator verifies synthetic-only data |
| `ELO_TRAEFIK_NETWORK` | Actual existing Docker network used by Traefik |
| `ELO_TRAEFIK_ENTRYPOINT` | Actual HTTPS entrypoint name from existing Traefik configuration |
| `ELO_TRAEFIK_CERTRESOLVER` | Actual configured certificate resolver name |
| `ELO_DEMO_BASIC_AUTH_USERS` | Nonempty `username:bcrypt-hash` htpasswd entry, generated privately |
| `ELO_INFERENCE_MODE` | `mock` initially; `amd` for an explicitly approved synthetic extraction rehearsal |
| `RADEON_API_KEY` | AMD key, server-side only; required when mode is `amd` |
| `RADEON_MODEL` | Approved available model; application default is `DeepSeek-V4-Flash` |

Use immutable digests for final image selection. Tags can be overwritten; both
images must derive from the same approved source commit. Configure private GHCR
pull access through Portainer's registry integration; do not embed registry tokens
in Compose. Registry visibility and host network/entrypoint/resolver names remain
unverified prerequisites, not assumed defaults.

Enter bcrypt hashes with **single `$` characters in Portainer environment values**;
Compose variable substitution does not recursively interpolate the resulting value.
If writing a hash literally into Compose YAML instead, every `$` must become `$$`.
For a local `.env`, single-quote the value to prevent dotenv expansion. Always
inspect the effective label privately; never paste it into review evidence.

## Approval gate and rehearsal

Before deployment, an operator must inspect existing Traefik routers for this host
and ensure no wildcard/catch-all router forwards denied mutation methods elsewhere.
Confirm Docker-provider label support and disable unlabelled default exposure at
the provider; this stack cannot change the shared Traefik provider. Its external
network is a trust boundary: unrelated containers there must be trusted. No shared
stack, router, network or database is modified by this proposal.

After explicit deployment approval, use one API replica. Startup runs
`alembic upgrade head` before Uvicorn against **only the new dedicated database**;
back up this stack's data before later upgrades. A failing migration must be
investigated, not bypassed or pointed at a shared DB. PostgreSQL health is tested
before API startup, then `/health` gates web startup. These checks do not prove
AMD availability, DB integrity, audit immutability or complete workflow success.

Keep operator writes on an approved private SSH/VPN tunnel, never an additional
public router. An SSH tunnel to the web container's private port 80 can provide the
same `/api` origin for the operator; do not add host port publications. That access
bypasses audience BasicAuth and therefore relies on SSH/VPN authentication and
local access controls. Determine the target privately after deployment; container
addresses may change. Maintain original source evidence, explicit human review,
40-minute synthetic sessions and append-only review events.

Before sharing access, verify from outside the VPS:

1. No credentials: `/` and `/api/health` return 401; invalid credentials also fail.
2. Valid audience credentials: static assets, `/api/health` and synthetic dashboards
   load; POST creation/extraction/approval/review paths fail without backend mutation.
3. Remote direct API/DB ports fail; web has no published host port. Confirm no
   other router serves mutations at this hostname (a 404 alone is insufficient).
4. Recreate API in this isolated stack and verify Nginx resolves its new address.
5. On the private operator path, run one synthetic AMD extraction, mandatory human
   observation review, audit lookup and consolidation. Preserve evidence, label
   drafts and record actual outcomes. Audience has no write authorization.

## Validation recorded for this proposal

PyYAML parsing and structural assertions verified: no published ports, mandatory
nonempty environment substitutions, isolated PostgreSQL volume/network, only web
on the external network, GET/HEAD-only TLS router plus BasicAuth, and disabled API/DB
Traefik discovery. Docker/Compose is unavailable in the preparation environment;
`docker compose config`, image pulls, migration execution, Traefik behavior and
external access tests have **not** been executed. Run `docker compose -f
deploy/portainer.compose.yml config --quiet` with private environment values before
approval; never publish the resolved configuration containing credentials.
