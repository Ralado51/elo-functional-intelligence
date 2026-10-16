"""Review endpoint integration tests using synthetic SQLite fixtures."""
import os
from pathlib import Path

from fastapi.testclient import TestClient
from app.database import engine_for

def test_review_lifecycle(tmp_path, monkeypatch):
    url = "sqlite+pysqlite:///" + str(tmp_path / "review.db")
    monkeypatch.setenv("ELO_DATABASE_URL", url)
    engine_for.cache_clear()
    from app.main import app
    client = TestClient(app)
    org = client.post("/registry/organizations", json={"name": "Synthetic Org"}).json()
    prof = client.post("/registry/professionals", json={"organization_id": org["id"], "display_name": "Synthetic Therapist"}).json()
    patient = client.post("/registry/patients", json={"organization_id": org["id"], "synthetic_code": "SYN-001"}).json()
    assert client.post("/cases", json={"id": "CASE-REVIEW"}).status_code == 201
    assert client.post("/registry/cases/CASE-REVIEW/patient", json={"patient_id": patient["id"]}).status_code == 200
    session = client.post("/sessions", json={"case_id": "CASE-REVIEW", "notes": "Completed activity with verbal support.", "duration_minutes": 40}).json()
    obs = client.post(f"/registry/sessions/{session['id']}/observations", json={
        "source_excerpt": "Completed activity with verbal support.",
        "functional_domain": "Participation",
        "observation_text": "Completed activity with verbal support."
    }).json()
    url = f"/registry/observations/{obs['id']}/review"
    assert client.post(url, json={"reviewer_id": prof["id"], "decision": "correct"}).status_code == 422
    reviewed = client.post(url, json={"reviewer_id": prof["id"], "decision": "correct", "reviewed_text": "Completed activity with verbal support (reviewed)."})
    assert reviewed.status_code == 200, reviewed.text
    assert reviewed.json()["review_status"] == "corrected"
    assert reviewed.json()["source_excerpt"] == obs["source_excerpt"]
    assert client.post(url, json={"reviewer_id": prof["id"], "decision": "approve"}).status_code == 409
    events = client.get(f"/registry/observations/{obs['id']}/review-events").json()
    assert len(events) == 1
    assert events[0]["decision"] == "correct"
    approved = client.get(f"/registry/sessions/{session['id']}/approved-observations").json()
    assert len(approved) == 1
    engine_for.cache_clear()
