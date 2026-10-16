"""Review endpoint integration tests using synthetic SQLite fixtures."""
import os
from pathlib import Path
import pytest

from fastapi.testclient import TestClient
from app.database import engine_for


@pytest.fixture
def pending_review(tmp_path, monkeypatch):
    monkeypatch.setenv("ELO_DATABASE_URL", "sqlite+pysqlite:///" + str(tmp_path / "integrity.db"))
    engine_for.cache_clear()
    from app.main import app
    with TestClient(app) as client:
        org = client.post("/registry/organizations", json={"name": "Synthetic Org"}).json()
        prof = client.post("/registry/professionals", json={"organization_id": org["id"], "display_name": "Synthetic Reviewer"}).json()
        patient = client.post("/registry/patients", json={"organization_id": org["id"], "synthetic_code": "SYN-INTEGRITY"}).json()
        client.post("/cases", json={"id": "CASE-INTEGRITY"})
        client.post("/registry/cases/CASE-INTEGRITY/patient", json={"patient_id": patient["id"]})
        notes = "Completed activity with verbal support."
        session = client.post("/sessions", json={"case_id": "CASE-INTEGRITY", "notes": notes, "duration_minutes": 40}).json()
        obs = client.post(f"/registry/sessions/{session['id']}/observations", json={
            "source_excerpt": notes, "functional_domain": "Motor Skills", "observation_text": notes
        }).json()
        # Creation returns input fields; read back the full persisted review state.
        obs = client.get(f"/registry/sessions/{session['id']}/observations").json()[0]
        yield client, prof, session, obs
    engine_for.cache_clear()


@pytest.mark.parametrize("domain", [None, "Motor Skills", "  Motor\t Skills  "])
@pytest.mark.parametrize("text", ["Completed activity with verbal support.", "  Completed\n activity   with verbal support.  "])
def test_no_op_correction_leaves_observation_and_audit_unchanged(pending_review, text, domain):
    client, prof, session, obs = pending_review
    payload = {"reviewer_id": prof["id"], "decision": "correct", "reviewed_text": text}
    if domain is not None:
        payload["reviewed_domain"] = domain
    path = f"/registry/observations/{obs['id']}"
    response = client.post(path + "/review", json=payload)
    assert response.status_code == 422, response.text
    assert "change" in response.json()["detail"].lower()
    assert client.get(path + "/review-events").json() == []
    assert client.get(f"/registry/sessions/{session['id']}/observations").json() == [obs]
    preview = client.get(f"/registry/sessions/{session['id']}/functional-documentation").json()
    assert preview["counts"]["pending"] == 1
    assert preview["reviewed_observations"] == []
    # A rejected no-op must not consume the pending review.
    assert client.post(path + "/review", json={"reviewer_id": prof["id"], "decision": "approve"}).status_code == 200


@pytest.mark.parametrize("text,domain", [
    ("Completed activity with minimal verbal support.", None),
    ("Completed activity with verbal support.", "Participation"),
    ("Completed activity with minimal verbal support.", "Participation"),
])
def test_meaningful_corrections_preserve_originals_and_preview(pending_review, text, domain):
    client, prof, session, obs = pending_review
    payload = {"reviewer_id": prof["id"], "decision": "correct", "reviewed_text": text}
    if domain is not None:
        payload["reviewed_domain"] = domain
    path = f"/registry/observations/{obs['id']}"
    response = client.post(path + "/review", json=payload)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["review_status"] == "corrected"
    for key in ("source_excerpt", "observation_text", "functional_domain"):
        assert result[key] == obs[key]
    events = client.get(path + "/review-events").json()
    assert len(events) == 1
    assert events[0]["previous_text"] == obs["observation_text"]
    assert events[0]["previous_domain"] == obs["functional_domain"]
    assert events[0]["reviewed_text"] == text
    assert events[0]["reviewed_domain"] == (domain or obs["functional_domain"])
    item = client.get(f"/registry/sessions/{session['id']}/functional-documentation").json()["reviewed_observations"][0]
    assert item["final_text"] == text
    assert item["final_domain"] == (domain or obs["functional_domain"])
    assert item["audit_event_ids"] == [events[0]["id"]]


@pytest.mark.parametrize("text,domain", [(" \n\t ", "Participation"), ("Meaningful corrected activity text.", "  ")])
def test_blank_normalized_correction_is_rejected(pending_review, text, domain):
    client, prof, session, obs = pending_review
    path = f"/registry/observations/{obs['id']}"
    response = client.post(path + "/review", json={
        "reviewer_id": prof["id"], "decision": "correct", "reviewed_text": text, "reviewed_domain": domain
    })
    assert response.status_code == 422
    assert client.get(path + "/review-events").json() == []

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
    assert reviewed.json()["reviewed_domain"] == "Participation"
    assert reviewed.json()["source_excerpt"] == obs["source_excerpt"]
    assert client.post(url, json={"reviewer_id": prof["id"], "decision": "approve"}).status_code == 409
    events = client.get(f"/registry/observations/{obs['id']}/review-events").json()
    assert len(events) == 1
    assert events[0]["decision"] == "correct"
    assert events[0]["previous_domain"] == "Participation"
    assert events[0]["reviewed_domain"] == "Participation"
    approved = client.get(f"/registry/sessions/{session['id']}/approved-observations").json()
    assert len(approved) == 1
    engine_for.cache_clear()


def test_corrected_domain_preserves_original_and_audit(tmp_path, monkeypatch):
    monkeypatch.setenv("ELO_DATABASE_URL", "sqlite+pysqlite:///" + str(tmp_path / "domain.db"))
    engine_for.cache_clear()
    from app.main import app
    client = TestClient(app)
    org = client.post("/registry/organizations", json={"name": "Synthetic Organization"}).json()
    prof = client.post("/registry/professionals", json={"organization_id": org["id"], "display_name": "Synthetic Reviewer"}).json()
    patient = client.post("/registry/patients", json={"organization_id": org["id"], "synthetic_code": "SYN-DOMAIN"}).json()
    assert client.post("/cases", json={"id": "CASE-DOMAIN"}).status_code == 201
    assert client.post("/registry/cases/CASE-DOMAIN/patient", json={"patient_id": patient["id"]}).status_code == 200
    notes = "The child transitioned to the activity after three verbal prompts."
    session = client.post("/sessions", json={"case_id": "CASE-DOMAIN", "notes": notes, "duration_minutes": 40}).json()
    obs = client.post(f"/registry/sessions/{session['id']}/observations", json={
        "source_excerpt": notes, "functional_domain": "Motor Skills", "observation_text": notes
    }).json()
    endpoint = f"/registry/observations/{obs['id']}/review"
    invalid = client.post(endpoint, json={"reviewer_id": prof["id"], "decision": "approve", "reviewed_domain": "Transitions"})
    assert invalid.status_code == 422
    corrected = client.post(endpoint, json={
        "reviewer_id": prof["id"], "decision": "correct",
        "reviewed_text": "The child transitioned to the activity with three verbal prompts.",
        "reviewed_domain": "Transitions"
    })
    assert corrected.status_code == 200, corrected.text
    result = corrected.json()
    assert result["functional_domain"] == "Motor Skills"
    assert result["reviewed_domain"] == "Transitions"
    assert result["source_excerpt"] == notes
    assert result["review_status"] == "corrected"
    events = client.get(f"/registry/observations/{obs['id']}/review-events").json()
    assert len(events) == 1
    assert events[0]["previous_domain"] == "Motor Skills"
    assert events[0]["reviewed_domain"] == "Transitions"
    assert client.post(endpoint, json={"reviewer_id": prof["id"], "decision": "approve"}).status_code == 409
    engine_for.cache_clear()
