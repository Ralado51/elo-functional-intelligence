"""Issue #28: empty registry through supported setup and durable review.

Four disposable synthetic observations model the existing pending records.
No production data, seed script or AMD request is used.
"""
from fastapi.testclient import TestClient
from app.database import database_url, engine_for
from app.main import app


def test_empty_registry_setup_preserves_four_observations_and_persists_review(tmp_path, monkeypatch):
    monkeypatch.setenv('ELO_DB_PATH', str(tmp_path / 'registry-review.db'))
    monkeypatch.delenv('ELO_DATABASE_URL', raising=False)
    monkeypatch.setenv('ELO_INFERENCE_MODE', 'mock')
    monkeypatch.setattr('app.main.extract_candidates', lambda _: (_ for _ in ()).throw(AssertionError('No AMD calls allowed')))
    with TestClient(app) as client:
        def post(path, payload):
            response = client.post(path, json=payload)
            assert response.is_success, response.text
            return response.json()
        notes = 'Synthetic child joined a block task with verbal prompts and minimal assistance.'
        session = post('/sessions', {'case_id': 'OT-001', 'notes': notes, 'duration_minutes': 40})
        sid = session['id']
        path = f'/registry/sessions/{sid}/observations'
        for index in range(4):
            post(path, {'source_excerpt': 'joined a block task with verbal prompts',
                        'functional_domain': 'Participation', 'observation_text': f'Synthetic observation {index + 1}: joined the block task with prompts.'})
        before = client.get(path).json()
        assert client.get('/registry/organizations').json() == []
        observation_id = before[0]['id']
        review_path = f'/registry/observations/{observation_id}/review'
        unknown = client.post(review_path, json={'reviewer_id': 'unregistered-synthetic-id', 'decision': 'approve'})
        assert unknown.status_code == 404
        assert unknown.json()['detail'] == 'Professional not found'
        assert client.get(f'/registry/observations/{observation_id}/review-events').json() == []
        org = post('/registry/organizations', {'name': 'Synthetic Demo Organization'})
        assert client.get(f"/registry/organizations/{org['id']}/professionals").json() == []
        assert client.get(f"/registry/organizations/{org['id']}/patients").json() == []
        professional = post('/registry/professionals', {'organization_id': org['id'], 'display_name': 'Synthetic Demo Reviewer'})
        assert client.get(f"/registry/organizations/{org['id']}/professionals").json() == [professional]
        unlinked = client.post(review_path, json={'reviewer_id': professional['id'], 'decision': 'approve'})
        assert unlinked.status_code == 409
        patient = post('/registry/patients', {'organization_id': org['id'], 'synthetic_code': 'SYN-OT-001'})
        assert client.get(f"/registry/organizations/{org['id']}/patients").json() == [patient]
        assert client.post('/registry/patients', json={'organization_id': org['id'], 'synthetic_code': 'SYN-OT-001'}).status_code == 409
        post('/registry/cases/OT-001/patient', {'patient_id': patient['id']})
        assert client.get(f"/registry/patients/{patient['id']}/cases").json()[0]['id'] == 'OT-001'
        # Setup is metadata only: all four pending records are byte-for-field unchanged.
        assert client.get(path).json() == before
        other_org = post('/registry/organizations', {'name': 'Other Synthetic Organization'})
        other_professional = post('/registry/professionals', {'organization_id': other_org['id'], 'display_name': 'Other Synthetic Reviewer'})
        assert client.post(review_path, json={'reviewer_id': other_professional['id'], 'decision': 'approve'}).status_code == 409
        other_patient = post('/registry/patients', {'organization_id': other_org['id'], 'synthetic_code': 'SYN-OTHER'})
        assert client.post('/registry/cases/OT-001/patient', json={'patient_id': other_patient['id']}).status_code == 409
        reviewed = post(review_path, {'reviewer_id': professional['id'], 'decision': 'approve'})
        assert reviewed['review_status'] == 'approved'
        events = client.get(f'/registry/observations/{observation_id}/review-events').json()
        assert len(events) == 1
        assert events[0]['reviewer_id'] == professional['id'] and events[0]['created_at']
        assert events[0]['decision'] == 'approve'
        assert events[0]['previous_text'] == before[0]['observation_text']
        assert client.post(review_path, json={'reviewer_id': professional['id'], 'decision': 'approve'}).status_code == 409

    # Dispose connections and use a new client to verify persisted, not UI-only, state.
    engine_for(database_url()).dispose()
    engine_for.cache_clear()
    with TestClient(app) as reloaded:
        after = reloaded.get(path).json()
        assert {row['id'] for row in after} == {row['id'] for row in before}
        assert sum(row['review_status'] == 'pending' for row in after) == 3
        assert sum(row['review_status'] == 'approved' for row in after) == 1
        originals = {row['id']: row for row in before}
        for row in after:
            for key in ['source_excerpt', 'observation_text', 'functional_domain', 'session_id', 'created_at']:
                assert row[key] == originals[row['id']][key]
        assert reloaded.get(f'/registry/observations/{observation_id}/review-events').json() == events
        assert reloaded.get(f'/sessions/{sid}').json() == session
    engine_for.cache_clear()
