"""Combined PR #30/#32 contract; optional isolated PostgreSQL test URL only."""
import os

from fastapi.testclient import TestClient
from app.main import app


def test_registry_review_progress_documentation(tmp_path, monkeypatch):
    monkeypatch.setenv('ELO_DB_PATH', str(tmp_path / 'release-candidate.db'))
    monkeypatch.delenv('ELO_DATABASE_URL', raising=False)
    if os.getenv('ELO_TEST_INTEGRATION_URL'):
        monkeypatch.setenv('ELO_DATABASE_URL', os.environ['ELO_TEST_INTEGRATION_URL'])
    monkeypatch.setenv('ELO_INFERENCE_MODE', 'mock')
    monkeypatch.setattr('app.main.extract_candidates', lambda _: (_ for _ in ()).throw(AssertionError('No inference permitted')))
    with TestClient(app) as client:
        def post(path, body):
            response = client.post(path, json=body)
            assert response.is_success, response.text
            return response.json()
        accounts = [
            ('Task initiation', 'Began a synthetic activity after three verbal prompts.'),
            ('Attention', 'Maintained attention for approximately eight minutes.'),
            ('Motor coordination', 'Completed seven independent attempts out of ten.'),
            ('Transitions', 'Completed the transition within two minutes with verbal guidance.'),
        ]
        session = post('/sessions', {'case_id': 'SYN-RC', 'duration_minutes': 40,
                                   'notes': ' '.join(text for _, text in accounts)})
        path = f"/registry/sessions/{session['id']}/observations"
        for domain, text in accounts:
            post(path, {'functional_domain': domain, 'observation_text': text, 'source_excerpt': text})
        original = client.get(path).json()
        assert client.get('/registry/organizations').json() == []
        org = post('/registry/organizations', {'name': 'Synthetic RC Organization'})
        prof = post('/registry/professionals', {'organization_id': org['id'], 'display_name': 'Synthetic RC Reviewer'})
        patient = post('/registry/patients', {'organization_id': org['id'], 'synthetic_code': 'SYN-RC'})
        post('/registry/cases/SYN-RC/patient', {'patient_id': patient['id']})
        assert client.get(path).json() == original
        for observation in original:
            post(f"/registry/observations/{observation['id']}/review", {'decision': 'approve', 'reviewer_id': prof['id']})
        reviewed = client.get(path).json()
        progress = client.get('/dashboards/functional-progress?case_id=SYN-RC').json()
        evidence = progress['sessions'][0]['evidence']
        assert len(evidence) == 4
        assert {row['reviewed_text'] for row in evidence} == {text for _, text in accounts}
        for row in evidence:
            audit = client.get(f"/registry/observations/{row['observation_id']}/review-events").json()
            assert row['audit_event_ids'] == [audit[0]['id']]
            assert audit[0]['reviewer_id'] == prof['id']
        preview_url = f"/registry/sessions/{session['id']}/functional-documentation"
        preview = client.get(preview_url).json()
        assert preview['counts'] == {'total': 4, 'accepted': 4, 'pending': 0, 'rejected': 0}
        assert preview['eligible_for_consolidation']
        assert client.get(preview_url).json() == preview
        assert client.get(path).json() == reviewed
        assert client.get(f"/sessions/{session['id']}").json() == session
        for before, after in zip(original, reviewed):
            for key in ('id', 'source_excerpt', 'observation_text', 'functional_domain', 'created_at'):
                assert before[key] == after[key]
