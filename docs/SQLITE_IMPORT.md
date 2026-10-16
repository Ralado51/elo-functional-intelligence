# SQLite backup to PostgreSQL — controlled import

**Never delete the original SQLite volume or the backup.** The API continues to use SQLite; this script only copies existing synthetic records to a separate PostgreSQL database. No clinical inference occurs.

Prerequisites: Alembic baseline already applied; PostgreSQL running; **both target cases and sessions tables empty**; backup SQLite integrity already checked. Use only synthetic test data.

After merging the PR, in PowerShell at `D:\Elo\elo-functional-intelligence`:

```powershell
git pull origin main
$env:ELO_POSTGRES_PASSWORD = Read-Host "PostgreSQL password"
$env:ELO_DATABASE_URL = "postgresql+psycopg://elo:$($env:ELO_POSTGRES_PASSWORD)@postgres:5432/elo"
```

**Do not use the URL string above with a password containing reserved URL characters** (such as `@`, `:`, `/`, `#`, `%`). For those passwords, percent-encode the password or use a safe connection configuration.

Dry-run (no writes):

```powershell
docker run --rm --network elo-functional-intelligence_default `
  -v "${PWD}\backend:/app:ro" -v "D:\Elo\Backups:/backup:ro" -w /app `
  -e ELO_DATABASE_URL="$env:ELO_DATABASE_URL" python:3.12-slim `
  sh -c "pip install --no-cache-dir -r requirements.txt && python -m scripts.import_sqlite --sqlite /backup/elo-backup.db"
```

Only if dry-run prints `dry-run: 1 cases, 2 sessions`, run the same command with `--execute` added after the SQLite path. The script uses a single transaction and verifies row counts, statuses and all session fields before commit. It refuses a nonempty destination.

Afterwards verify via PostgreSQL:

```powershell
docker compose -f docker-compose.yml -f docker-compose.postgres.yml exec postgres `
  psql -U elo -d elo -c "SELECT status, COUNT(*) FROM sessions GROUP BY status;"
```

Expected: one `approved`, one `pending`. The API is **not** yet switched to PostgreSQL. Keep the SQLite source and backup intact.
