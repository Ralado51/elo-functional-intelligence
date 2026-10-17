"""Synthetic functional documentation preview integration tests."""
from fastapi.testclient import TestClient
from app.database import engine_for


def test_preview_requires_review_and_preserves_evidence(tmp_path, monkeypatch):
    monkeypatch.setenv("ELO_DATABASE_URL", "sqlite+pysqlite:///" + str(tmp_path / "preview.db"))
    engine_for.cache_clear()
    from app.main import app
    client = TestClient(app)
    assert client.get("/registry/sessions/missing/functional-documentation").status_code == 404
    org = client.post("/registry/organizations", json={"name": "Synthetic Organization"}).json()
    professional = client.post("/registry/professionals", json={
        "organization_id": org["id"], "display_name": "Synthetic Reviewer"}).json()
    patient = client.post("/registry/patients", json={
        "organization_id": org["id"], "synthetic_code": "SYN-PREVIEW"}).json()
    client.post("/cases", json={"id": "CASE-PREVIEW"})
    client.post("/registry/cases/CASE-PREVIEW/patient", json={"patient_id": patient["id"]})
    notes = "The child transitioned to the table after three verbal prompts."
    session = client.post("/sessions", json={
        "case_id": "CASE-PREVIEW", "notes": notes, "duration_minutes": 40}).json()
    obs = client.post(f"/registry/sessions/{session['id']}/observations", json={
        "source_excerpt": notes, "functional_domain": "Motor Skills", "observation_text": notes}).json()
    path = f"/registry/sessions/{session['id']}/functional-documentation"
    before = client.get(path)
    assert before.status_code == 200
    assert before.json()["eligible_for_consolidation"] is False
    assert before.json()["counts"]["pending"] == 1
    assert before.json()["reviewed_observations"] == []
    response = client.post(f"/registry/observations/{obs['id']}/review", json={
        "reviewer_id": professional["id"], "decision": "correct",
        "reviewed_text": "The child transitioned after three verbal prompts.",
        "reviewed_domain": "Transitions"})
    assert response.status_code == 200, response.text
    after = client.get(path)
    assert after.status_code == 200
    data = after.json()
    assert data["eligible_for_consolidation"] is True
    assert data["is_final_record"] is False
    assert data["counts"] == {"total": 1, "accepted": 1, "pending": 0, "rejected": 0}
    item = data["reviewed_observations"][0]
    assert item["original_domain"] == "Motor Skills"
    assert item["final_domain"] == "Transitions"
    assert item["source_excerpt"] == notes
    assert item["original_text"] == notes
    assert len(item["audit_event_ids"]) == 1
    engine_for.cache_clear()


def test_preview_without_patient_is_blocked(tmp_path, monkeypatch):
    monkeypatch.setenv("ELO_DATABASE_URL", "sqlite+pysqlite:///" + str(tmp_path / "unlinked.db"))
    engine_for.cache_clear()
    from app.main import app
    client = TestClient(app)
    session = client.post("/sessions", json={
        "case_id": "CASE-UNLINKED", "notes": "Synthetic observations for a forty minute session.",
        "duration_minutes": 40}).json()
    result = client.get(f"/registry/sessions/{session['id']}/functional-documentation")
    assert result.status_code == 200
    assert result.json()["eligible_for_consolidation"] is False
    assert "Case is not linked to a synthetic patient" in result.json()["blockers"]
    engine_for.cache_clear()
