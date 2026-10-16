# Sprint 5B — Relational clinical foundation

This is an **additive schema-only** change. The existing case `OT-001`, three sessions, review statuses and existing FastAPI endpoints remain unchanged.

## Entities

- `organizations`: clinic/institution.
- `professionals`: organization-linked staff.
- `patients`: organization-linked synthetic patient codes (unique per organization).
- `guardians` and `patient_guardians`: separate legal-guardian relationships.
- `cases.patient_id`: nullable foreign key to patients; **legacy cases remain unlinked** until explicit mapping.
- `observations`: session-linked functional observations with source excerpt and review status.

All sample/test identities are synthetic. No real patient data, no clinical inference, and no automatic linking of existing sessions to invented patients.

## Apply only after PR checks and merge

Verify Docker PostgreSQL is healthy and make a fresh backup first. From the repository root:

```powershell
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.postgres.yml ps
```

To apply the new Alembic migration using a temporary Python container:

```powershell
$env:ELO_POSTGRES_PASSWORD = Read-Host "PostgreSQL password"
$env:ELO_DATABASE_URL = "postgresql+psycopg://elo:$($env:ELO_POSTGRES_PASSWORD)@postgres:5432/elo"
docker run --rm --network elo-functional-intelligence_default -v "${PWD}\backend:/app:ro" -w /app -e ELO_DATABASE_URL="$env:ELO_DATABASE_URL" python:3.12-slim sh -c "pip install --no-cache-dir -r requirements.txt && alembic upgrade head"
```

Passwords containing URL-reserved characters require percent encoding. Do not expose credentials in screenshots.

Verify migration version, legacy case and session counts:

```powershell
docker compose -f docker-compose.yml -f docker-compose.postgres.yml exec postgres psql -U elo -d elo -c "SELECT version_num FROM alembic_version; SELECT COUNT(*) FROM cases; SELECT status, COUNT(*) FROM sessions GROUP BY status;"
```

Expected: revision `0002_relational`, one legacy case, three legacy sessions (two approved, one pending), unless further synthetic sessions have been added. No new clinical data is seeded by the migration.

## Future increments

Organization scoping, authenticated professional access, guardian authorization, audit trails, tenant isolation and API CRUD must be designed and tested before any use beyond a synthetic hackathon MVP. **Do not treat the schema alone as HIPAA/LGPD compliance.**
