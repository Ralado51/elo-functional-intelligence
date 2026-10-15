# Sprint 5A — PostgreSQL foundation (phase 1)

The existing FastAPI application **still uses SQLite**. This PR prepares PostgreSQL, SQLAlchemy models and an Alembic baseline; it does not switch production storage, import data or modify the API.

## Local opt-in (PowerShell)

From the repository root, set a local password without committing it:

```powershell
$env:ELO_POSTGRES_PASSWORD = Read-Host "Local PostgreSQL password"
docker compose -f docker-compose.yml -f docker-compose.postgres.yml up -d postgres
docker compose -f docker-compose.yml -f docker-compose.postgres.yml ps
```

PostgreSQL listens only on `127.0.0.1:5433` on Windows. The data resides in the named volume `elo_postgres_data`. Do not run `docker compose down -v`.

To apply migrations with Python dependencies installed:

```powershell
cd backend
$env:ELO_DATABASE_URL = "postgresql+psycopg://elo:$($env:ELO_POSTGRES_PASSWORD)@localhost:5433/elo"
alembic upgrade head
```

**Password caution:** special URL characters must be percent-encoded. Prefer constructing a SQLAlchemy URL programmatically for such passwords.

## Migration/cutover safeguards

1. Preserve the original Docker volume and `D:\Elo\Backups\elo-backup.db`.
2. Verify SQLite `PRAGMA integrity_check` and count rows in both `cases` and `sessions`.
3. Apply the Alembic schema to an empty PostgreSQL database.
4. Implement a separate, tested one-time import preserving IDs, timestamps, status, extraction JSON and approvals; verify counts and sample records.
5. Switch API persistence only after parity tests and explicit local validation. Roll back to SQLite if verification fails.

No identifiable patient data. No AMD inference. No database cutover in this PR.
