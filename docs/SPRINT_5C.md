# Sprint 5C — Synthetic clinical registry API

This sprint wires Sprint 5B's existing tables to a new `/registry` API router. **No Alembic migration is required.** Existing `/cases` and `/sessions` routes are unchanged.

## Endpoints

- `POST/GET /registry/organizations`
- `POST /registry/professionals`; `GET /registry/organizations/{id}/professionals`
- `POST /registry/patients`; `GET /registry/organizations/{id}/patients`
- `POST /registry/guardians`; `GET /registry/organizations/{id}/guardians`
- `POST/GET /registry/patients/{id}/guardians`
- `POST /registry/cases/{case_id}/patient`; `GET /registry/patients/{id}/cases`
- `POST/GET /registry/sessions/{id}/observations`

## Validation

- Duplicate synthetic patient codes within one organization return 409.
- Guardian/patient links across organizations return 409.
- Existing cases are never automatically assigned to synthetic patients.
- Reassignment of a linked case to another patient returns 409.
- Observation evidence excerpts must occur verbatim in the session notes.
- New observations begin with `review_status=pending`; no AI output is fabricated.
- Adding observations to approved sessions is blocked.

## Local verification after CI and merge

```powershell
cd D:\Elo\elo-functional-intelligence
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.postgres.yml -f docker-compose.cutover.yml up -d --build api
Invoke-RestMethod http://localhost:8000/health
```

Open `http://localhost:8000/docs` and exercise only synthetic records.

## Explicit limitations

**Research MVP only. No real patient information.** These endpoints are currently unauthenticated. Organization filtering and relationship validation are **not** authorization or tenant isolation. Do not expose the API publicly or use with clinical data. Before production, implement authentication, authorization scoped to the caller's organization, access logging, professional approvals, retention/deletion policies and legal/privacy review.

Existing approved session records remain unchanged; this sprint does not implement professional sign-off on individual observation rows.
