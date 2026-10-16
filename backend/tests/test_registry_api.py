import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolated_database(tmp_path, monkeypatch):
    monkeypatch.setenv("ELO_DB_PATH", str(tmp_path / "registry.db"))
    monkeypatch.delenv("ELO_DATABASE_URL", raising=False)


def test_registry_lifecycle_and_legacy_case():
    org = client.post("/registry/organizations", json={"name": "Synthetic Clinic"})
    assert org.status_code == 201
    oid = org.json()["id"]
    patient = client.post("/registry/patients", json={"organization_id": oid, "synthetic_code": "PAT-001"})
    assert patient.status_code == 201
    pid = patient.json()["id"]
    assert client.post("/registry/patients", json={"organization_id": oid, "synthetic_code": "PAT-001"}).status_code == 409
    professional = client.post("/registry/professionals", json={"organization_id": oid, "display_name": "Synthetic Therapist"})
    assert professional.status_code == 201
    assert len(client.get(f"/registry/organizations/{oid}/professionals").json()) == 1
    guardian = client.post("/registry/guardians", json={"organization_id": oid, "display_name": "Synthetic Guardian"})
    assert guardian.status_code == 201
    gid = guardian.json()["id"]
    link = client.post(f"/registry/patients/{pid}/guardians", json={"guardian_id": gid, "relationship": "parent"})
    assert link.status_code == 201
    assert client.post(f"/registry/patients/{pid}/guardians", json={"guardian_id": gid, "relationship": "parent"}).status_code == 409
    assert len(client.get(f"/registry/patients/{pid}/guardians").json()) == 1
    assert client.post("/cases", json={"id": "OT-001"}).status_code == 201
    assert client.post("/registry/cases/OT-001/patient", json={"patient_id": pid}).status_code == 200
    assert len(client.get(f"/registry/patients/{pid}/cases").json()) == 1
    assert len(client.get(f"/registry/organizations/{oid}/patients").json()) == 1


def test_cross_organization_guardian_link_rejected():
    a = client.post("/registry/organizations", json={"name": "Clinic A"}).json()["id"]
    b = client.post("/registry/organizations", json={"name": "Clinic B"}).json()["id"]
    patient = client.post("/registry/patients", json={"organization_id": a, "synthetic_code": "P-1"}).json()["id"]
    guardian = client.post("/registry/guardians", json={"organization_id": b, "display_name": "Guardian B"}).json()["id"]
    response = client.post(f"/registry/patients/{patient}/guardians", json={"guardian_id": guardian, "relationship": "parent"})
    assert response.status_code == 409


def test_evidence_requires_verbatim_excerpt_and_review():
    created = client.post("/sessions", json={"case_id": "OT-001", "notes": "Synthetic child completed block task with verbal support.", "duration_minutes": 40})
    assert created.status_code == 201
    sid = created.json()["id"]
    endpoint = f"/registry/sessions/{sid}/observations"
    bad = client.post(endpoint, json={"source_excerpt": "unsupported assertion", "functional_domain": "participation", "observation_text": "Unsupported"})
    assert bad.status_code == 422
    good = client.post(endpoint, json={"source_excerpt": "completed block task", "functional_domain": "participation", "observation_text": "Task completed"})
    assert good.status_code == 201
    assert good.json()["review_status"] == "pending"
    assert len(client.get(endpoint).json()) == 1
    assert client.post(f"/sessions/{sid}/extract").status_code == 200
    assert client.post(f"/sessions/{sid}/approve", json={"reviewed_text": "Human reviewed synthetic record"}).status_code == 200
    assert client.post(endpoint, json={"source_excerpt": "completed block task", "functional_domain": "participation", "observation_text": "Task completed"}).status_code == 409
