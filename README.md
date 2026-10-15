# Elo Functional Intelligence

**Elo IA Labs · AMD Developer Hackathon ACT III · Health and Wellbeing**

AI-assisted documentation of **40-minute pediatric occupational therapy sessions**, with structured functional observations, evidence traceability and mandatory human approval.

> Hackathon research prototype. Not a medical device, not for diagnosis or autonomous clinical decision-making. Use synthetic data only.

## Status

**Sprint 1 foundation — backend scaffold.** The extraction endpoint currently runs in **mock mode** and does **not** call AMD or invent extracted observations. AMD integration will be added once authorized Token Factory credentials are available.

## Quick start

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Windows PowerShell activation: `.venv\Scripts\Activate.ps1`.

API docs: http://localhost:8000/docs

Run tests: `cd backend && PYTHONPATH=. pytest -q`

Alternatively: `docker compose up --build`.

## Endpoints

- `GET /health` — declares mock mode
- `POST /sessions` — create synthetic 40-minute session
- `GET /sessions/{id}` — retrieve session
- `POST /sessions/{id}/extract` — mock pending-review result, **not AMD inference**
- `POST /sessions/{id}/approve` — save human-reviewed text in memory

## Next steps

1. Add persistence and case entities
2. Integrate evidence-validated structured extraction using AMD Token Factory
3. Build React/TypeScript review interface
4. Create synthetic evaluation dataset and report measured results

See [product specification](docs/PRODUCT_SPEC.md). Licensed under MIT.
