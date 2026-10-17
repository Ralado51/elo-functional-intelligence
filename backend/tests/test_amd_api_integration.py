"""End-to-end AMD-mode API tests. No external requests; disposable SQLite only."""
import pytest
from fastapi.testclient import TestClient

from app.amd_inference import AMDInferenceError, Candidate, CandidateResponse
from app.database import engine_for
from app.main import app


NOTES = "The synthetic child needed three verbal prompts to begin the transition."


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("ELO_DATABASE_URL", "sqlite+pysqlite:///" + str(tmp_path / "amd-integration.db"))
    monkeypatch.setenv("ELO_INFERENCE_MODE", "amd")
    monkeypatch.setenv("ELO_SYNTHETIC_ONLY_ACK", "true")
    monkeypatch.setenv("RADEON_API_KEY", "synthetic-test-key-not-real")
    engine_for.cache_clear()
    yield TestClient(app)
    engine_for.cache_clear()


def new_session(client):
    response = client.post("/sessions", json={"case_id": "AMD-SYNTHETIC", "notes": NOTES, "duration_minutes": 40})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_amd_extraction_creates_pending_observation_and_preserves_evidence(client, monkeypatch):
    def fake_extract(notes):
        assert notes == NOTES
        return CandidateResponse(observations=[Candidate(
            functional_domain="Activity transitions",
            observation_text="Three verbal prompts were required to begin transition.",
            source_excerpt="needed three verbal prompts to begin the transition",
        )], missing_information=["Baseline not documented"])
    monkeypatch.setattr("app.main.extract_candidates", fake_extract)
    sid = new_session(client)
    response = client.post(f"/sessions/{sid}/extract")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "pending"
    assert body["approved_at"] is None
    assert len(body["extraction"]["observations"]) == 1
    observations = client.get(f"/registry/sessions/{sid}/observations")
    assert observations.status_code == 200, observations.text
    records = observations.json()
    assert len(records) == 1
    assert records[0]["review_status"] == "pending"
    assert records[0]["source_excerpt"] in NOTES
    assert client.post(f"/sessions/{sid}/extract").status_code == 409


def test_amd_failure_does_not_mutate_session(client, monkeypatch):
    def fake_failure(_notes):
        raise AMDInferenceError("Simulated AMD timeout")
    monkeypatch.setattr("app.main.extract_candidates", fake_failure)
    sid = new_session(client)
    response = client.post(f"/sessions/{sid}/extract")
    assert response.status_code == 502
    session = client.get(f"/sessions/{sid}").json()
    assert session["status"] == "draft"
    assert session["extraction"] is None
    assert client.get(f"/registry/sessions/{sid}/observations").json() == []


def test_unsupported_evidence_rejected_without_persistence(client, monkeypatch):
    def fake_invalid(_notes):
        from app.amd_inference import parse_candidates
        return parse_candidates('{"observations":[{"functional_domain":"Transitions","observation_text":"Independent","source_excerpt":"independently completed everything"}]}', NOTES)
    monkeypatch.setattr("app.main.extract_candidates", fake_invalid)
    sid = new_session(client)
    response = client.post(f"/sessions/{sid}/extract")
    assert response.status_code == 502
    assert client.get(f"/sessions/{sid}").json()["status"] == "draft"
    assert client.get(f"/registry/sessions/{sid}/observations").json() == []


def test_explicit_synthetic_ack_required(client, monkeypatch):
    monkeypatch.setenv("ELO_SYNTHETIC_ONLY_ACK", "false")
    monkeypatch.setattr("app.main.extract_candidates", lambda _: pytest.fail("Inference must not run"))
    sid = new_session(client)
    response = client.post(f"/sessions/{sid}/extract")
    assert response.status_code == 503
    assert client.get(f"/sessions/{sid}").json()["status"] == "draft"


def test_existing_observations_block_amd_inference(client, monkeypatch):
    sid = new_session(client)
    created = client.post(f"/registry/sessions/{sid}/observations", json={
        "source_excerpt": "needed three verbal prompts",
        "functional_domain": "Transitions",
        "observation_text": "Three prompts needed",
    })
    assert created.status_code == 201, created.text
    monkeypatch.setattr("app.main.extract_candidates", lambda _: pytest.fail("Inference must not run"))
    assert client.post(f"/sessions/{sid}/extract").status_code == 409
    assert client.get(f"/sessions/{sid}").json()["status"] == "draft"


def test_no_observations_still_requires_human_session_review(client, monkeypatch):
    monkeypatch.setattr("app.main.extract_candidates", lambda _: CandidateResponse(
        observations=[], missing_information=["Insufficient evidence"]))
    sid = new_session(client)
    response = client.post(f"/sessions/{sid}/extract")
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "pending"
    assert client.get(f"/registry/sessions/{sid}/observations").json() == []
