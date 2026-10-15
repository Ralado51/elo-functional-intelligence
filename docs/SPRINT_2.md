# Sprint 2 — persistent synthetic case history

The API now uses SQLite (stdlib sqlite3) instead of an in-memory dictionary. By default it stores a local file at `backend/data/elo.db`, ignored by Git. Override with `ELO_DB_PATH` for testing or other local paths. Docker Compose mounts a named volume at `/app/data`.

## New endpoints

- `POST /cases`: create synthetic case ID (letters, digits, underscore or hyphen)
- `GET /cases`: list synthetic cases
- `GET /cases/{case_id}/sessions`: history ordered by creation date

The original session endpoints are backward compatible. Creating a session with an unknown synthetic case ID creates that case automatically. Approval records an `approved_at` timestamp and preserves reviewed text across requests and restarts (provided the database path is persistent).

## Limitations

- **Synthetic data only.** Do not enter identifiable patient information.
- No authentication, authorization, encryption-at-rest, production migrations, audit events or concurrency hardening. Not suitable for clinical production.
- SQLite is for local prototype persistence; PostgreSQL migration is planned.
- AMD integration is not implemented; `/extract` remains explicitly mock-only.
- UI history and case management are upcoming; the API can already list them.

## Validation

Run `cd backend && PYTHONPATH=. pytest -q`. CI results must be checked before merging.
