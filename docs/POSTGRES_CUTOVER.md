# Sprint 5A — opt-in FastAPI PostgreSQL cutover

This PR changes FastAPI database access to SQLAlchemy. By default it still uses SQLite, retaining existing behavior. PostgreSQL is enabled **only** when ELO_DATABASE_URL is set. No automatic SQLite import, no database reset, and no AMD inference.

## Before running

- PostgreSQL migrations have been applied.
- The separate import script reported `imported: 1 cases, 2 sessions`.
- PostgreSQL has one approved and one pending session.
- Keep `D:\Elo\Backups\elo-backup.db` and the original SQLite Docker volume.
- Use only synthetic test data.

## Run PostgreSQL-backed API locally (PowerShell)

From `D:\Elo\elo-functional-intelligence` after PR merge and `git pull origin main`:

```powershell
$env:ELO_POSTGRES_PASSWORD = Read-Host "PostgreSQL password"
docker compose -f docker-compose.yml -f docker-compose.postgres.yml -f docker-compose.cutover.yml up -d --build api
Invoke-RestMethod http://localhost:8000/health
Invoke-RestMethod http://localhost:8000/cases
Invoke-RestMethod http://localhost:8000/cases/OT-001/sessions | Select-Object id,status
```

Expected health: `persistence=postgresql`, `mode=mock`, `amd_inference=false`. Expected history: two sessions, one approved and one pending. The API requires PostgreSQL to be healthy before starting. No frontend changes required.

**Passwords with URL-reserved characters** require percent encoding; do not post passwords in chat or screenshots. For this local test, use a URL-safe password or configure a safely encoded URL.

## Rollback without data loss

Stop the API only (not PostgreSQL volumes), then start using the original Compose configuration:

```powershell
docker compose -f docker-compose.yml -f docker-compose.postgres.yml -f docker-compose.cutover.yml stop api
docker compose -f docker-compose.yml up -d --build --no-deps api
```

The original SQLite volume remains mounted in the base Compose file. Do not run `docker compose down -v`.

## Validation

Run `pytest` with the default SQLite configuration to check backwards compatibility. PostgreSQL end-to-end tests must be validated in the user's local Docker environment before calling the cutover complete.
