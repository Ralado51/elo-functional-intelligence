import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

@pytest.fixture(autouse=True)
def isolated_database(tmp_path, monkeypatch):
    monkeypatch.setenv("ELO_DB_PATH", str(tmp_path / "test.db"))

def test_health_discloses_mock_mode():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["amd_inference"] is False
    assert response.json()["persistence"] == "sqlite"

def test_case_and_session_persist_across_requests():
    case = client.post("/cases", json={"id": "OT-001"})
    assert case.status_code == 201
    assert client.post("/cases", json={"id": "OT-001"}).status_code == 409
    created = client.post("/sessions", json={
        "case_id": "OT-001", "notes": "Participou de brincadeira com blocos com ajuda mínima.",
        "duration_minutes": 40,
    })
    assert created.status_code == 201
    session_id = created.json()["id"]
    assert client.get(f"/sessions/{session_id}").json()["status"] == "draft"
    pending = client.post(f"/sessions/{session_id}/extract")
    assert pending.status_code == 200
    assert pending.json()["extraction"]["observations"] == []
    approved = client.post(f"/sessions/{session_id}/approve", json={"reviewed_text": "Registro revisado pela terapeuta."})
    assert approved.status_code == 200
    assert approved.json()["approved_at"] is not None
    assert client.get(f"/sessions/{session_id}").json()["status"] == "approved"
    assert len(client.get("/cases/OT-001/sessions").json()) == 1
    assert client.post(f"/sessions/{session_id}/extract").status_code == 409
    assert client.post(f"/sessions/{session_id}/approve", json={"reviewed_text": "Outro"}).status_code == 409

def test_duration_must_be_40():
    response = client.post("/sessions", json={
        "case_id": "OT-002", "notes": "Uma descrição sintética válida da sessão.",
        "duration_minutes": 30,
    })
    assert response.status_code == 422

def test_case_is_created_for_legacy_session_flow():
    response = client.post("/sessions", json={
        "case_id": "OT-003", "notes": "Registro sintético de sessão com blocos.",
        "duration_minutes": 40,
    })
    assert response.status_code == 201
    assert len(client.get("/cases/OT-003/sessions").json()) == 1

def test_missing_case_and_session():
    assert client.get("/cases/UNKNOWN/sessions").status_code == 404
    assert client.get("/sessions/missing").status_code == 404
