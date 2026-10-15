from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_discloses_mock_mode():
    result = client.get("/health")
    assert result.status_code == 200
    assert result.json()["amd_inference"] is False

def test_session_review_flow():
    created = client.post("/sessions", json={
        "case_id": "OT-001",
        "notes": "Participou de brincadeira com blocos com ajuda mínima.",
        "duration_minutes": 40,
    })
    assert created.status_code == 201
    session_id = created.json()["id"]
    pending = client.post(f"/sessions/{session_id}/extract")
    assert pending.status_code == 200
    assert pending.json()["status"] == "pending"
    assert pending.json()["extraction"]["observations"] == []
    approved = client.post(f"/sessions/{session_id}/approve", json={"reviewed_text": "Registro revisado pela terapeuta."})
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

def test_duration_must_be_40():
    result = client.post("/sessions", json={
        "case_id": "OT-002",
        "notes": "Uma descrição sintética válida da sessão.",
        "duration_minutes": 30,
    })
    assert result.status_code == 422
