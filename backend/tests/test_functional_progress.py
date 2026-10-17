"""Read-only narrative participation evidence, never inferred clinical scores."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from app.database import db
from app.main import app

ACCOUNTS = [
    ('Task initiation', 'The child began the block-fitting activity after three verbal prompts.'),
    ('Attention', 'The child maintained attention for approximately eight minutes during the activity.'),
    ('Motor coordination', 'The child completed seven independent attempts out of ten block-fitting attempts.'),
    ('Transitions', 'The child completed the transition within two minutes with verbal guidance.'),
]


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('ELO_DB_PATH', str(tmp_path / 'functional-progress.db'))
    monkeypatch.delenv('ELO_DATABASE_URL', raising=False)
    monkeypatch.setenv('ELO_INFERENCE_MODE', 'mock')
    monkeypatch.setattr('app.main.extract_candidates', lambda _: pytest.fail('Progress must never call inference'))
    with TestClient(app) as client:
        yield client


@pytest.fixture
def records(client):
    def post(path, payload):
        response = client.post(path, json=payload)
        assert response.is_success, response.text
        return response.json()
    org = post('/registry/organizations', {'name': 'Synthetic Participation Lab'})
    reviewer = post('/registry/professionals', {'organization_id': org['id'], 'display_name': 'Synthetic Reviewer'})
    for case_id in ['OT-001', 'OTHER-SYNTHETIC', 'NO-SESSIONS']:
        patient = post('/registry/patients', {'organization_id': org['id'], 'synthetic_code': 'SYN-' + case_id})
        post('/cases', {'id': case_id})
        post(f'/registry/cases/{case_id}/patient', {'patient_id': patient['id']})
    def session(case_id, accounts):
        notes = 'Synthetic session. ' + ' '.join(account for _, account in accounts)
        record = post('/sessions', {'case_id': case_id, 'notes': notes, 'duration_minutes': 40})
        for domain, account in accounts:
            observation = post(f"/registry/sessions/{record['id']}/observations", {
                'functional_domain': domain, 'observation_text': account, 'source_excerpt': account})
            post(f"/registry/observations/{observation['id']}/review", {'reviewer_id': reviewer['id'], 'decision': 'approve'})
        return record
    measured = session('OT-001', ACCOUNTS)
    empty = session('OT-001', [])
    narrative = session('OT-001', [('Attention', 'Attention was supported with visual cues during a drawing activity.')])
    other = session('OTHER-SYNTHETIC', [('Participation', 'The synthetic participant described a cooking activity with assistance.')])
    return measured, empty, narrative, other


def test_empty_registry_and_case_without_sessions(client):
    assert client.get('/dashboards/functional-progress').json()['cases'] == []
    client.post('/cases', json={'id': 'EMPTY-SYNTHETIC'})
    data = client.get('/dashboards/functional-progress?case_id=EMPTY-SYNTHETIC').json()
    assert data['sessions'] == [] and data['total_sessions'] == 0
    assert data['case'] == {'id': 'EMPTY-SYNTHETIC', 'patient_id': None}


def test_exact_narrative_quantities_and_auditable_sources_are_retained(client, records):
    measured, empty, narrative, _ = records
    response = client.get('/dashboards/functional-progress?case_id=OT-001')
    assert response.status_code == 200
    data = response.json()
    sessions = {session['id']: session for session in data['sessions']}
    assert len(sessions) == data['total_sessions'] == 3
    result = sessions[measured['id']]
    assert result['duration_minutes'] == 40
    assert result['recorded_observations'] == len(result['evidence']) == 4
    assert [record['reviewed_text'] for record in result['evidence']] == [account for _, account in ACCOUNTS]
    for evidence in result['evidence']:
        assert evidence['source_excerpt'] == evidence['reviewed_text']
        assert evidence['reviewer_id'] and evidence['reviewed_at'] and len(evidence['audit_event_ids']) == 1
        assert not {'score', 'value', 'percentage', 'improvement', 'unit'} & evidence.keys()
        audit = client.get(f"/registry/observations/{evidence['observation_id']}/review-events").json()
        assert evidence['audit_event_ids'] == [audit[0]['id']]
    assert [record['topics'][0] for record in result['evidence'][:3]] == ['initiation', 'attention', 'motor']
    assert 'motor' not in result['evidence'][0]['topics']
    assert 'transitions' in result['evidence'][3]['topics']
    assert sessions[empty['id']]['recorded_observations'] == 0
    assert sessions[empty['id']]['evidence'] == []
    assert sessions[narrative['id']]['evidence'][0]['reviewed_text'] == 'Attention was supported with visual cues during a drawing activity.'


def test_other_case_and_session_context_never_mix(client, records):
    *_, other = records
    data = client.get('/dashboards/functional-progress?case_id=OTHER-SYNTHETIC').json()
    assert [session['id'] for session in data['sessions']] == [other['id']]
    assert 'cooking activity' in data['sessions'][0]['evidence'][0]['reviewed_text']
    assert 'seven' not in str(data['sessions'])
    for case_id in ['MISSING', "' OR 1=1 --"]:
        assert client.get('/dashboards/functional-progress', params={'case_id': case_id}).status_code == 404


def test_pending_rejected_and_unaudited_records_are_not_outcome_evidence(client, records):
    measured = records[0]
    with db() as conn:
        rows = conn.execute(text('SELECT id FROM observations WHERE session_id=:id ORDER BY created_at, id'), {'id': measured['id']}).all()
        conn.execute(text("UPDATE observations SET review_status='pending' WHERE id=:id"), {'id': rows[0][0]})
        conn.execute(text("UPDATE observations SET review_status='rejected' WHERE id=:id"), {'id': rows[1][0]})
        conn.execute(text('DELETE FROM observation_review_events WHERE observation_id=:id'), {'id': rows[2][0]})
    data = client.get('/dashboards/functional-progress?case_id=OT-001').json()
    session = next(session for session in data['sessions'] if session['id'] == measured['id'])
    assert len(session['evidence']) == 1
    assert session['unverified_accepted_observations'] == 1


def test_source_mismatch_is_excluded_not_interpreted(client, records):
    with db() as conn:
        conn.execute(text("UPDATE sessions SET notes='Synthetic unrelated source.' WHERE id=:id"), {'id': records[0]['id']})
    session = next(session for session in client.get('/dashboards/functional-progress?case_id=OT-001').json()['sessions'] if session['id'] == records[0]['id'])
    assert session['evidence'] == [] and session['unverified_accepted_observations'] == 4


def test_correction_is_authoritative_and_original_is_separate(client, records):
    sid = records[0]['id']
    original = 'The child began the block-fitting activity after three verbal prompts.'
    corrected = 'The child did not initiate the activity independently; support was needed.'
    with db() as conn:
        observation_id = conn.execute(text('SELECT id FROM observations WHERE session_id=:id ORDER BY created_at, id LIMIT 1'), {'id': sid}).scalar_one()
        conn.execute(text("UPDATE observations SET review_status='corrected', reviewed_text=:text, reviewed_domain='Task initiation' WHERE id=:id"), {'id': observation_id, 'text': corrected})
        conn.execute(text("UPDATE observation_review_events SET decision='correct', reviewed_text=:text, reviewed_domain='Task initiation' WHERE observation_id=:id"), {'id': observation_id, 'text': corrected})
    result = next(session for session in client.get('/dashboards/functional-progress?case_id=OT-001').json()['sessions'] if session['id'] == sid)['evidence'][0]
    assert result['reviewed_text'] == corrected
    assert result['source_excerpt'] == result['original_text'] == original
    assert 'three' not in result['reviewed_text'] and 'did not' in result['reviewed_text']


def test_read_only_and_bounded_lists(client, records):
    def snapshot():
        with db() as conn:
            return {table: [tuple(row) for row in conn.execute(text(f'SELECT * FROM {table} ORDER BY id'))]
                    for table in ['cases', 'sessions', 'observations', 'observation_review_events']}
    before = snapshot()
    data = client.get('/dashboards/functional-progress?case_id=OT-001&limit=1').json()
    assert len(data['sessions']) == 1 and data['total_sessions'] == 3
    assert snapshot() == before
    assert client.get('/dashboards/functional-progress?case_id=OT-001&limit=0').status_code == 422
    assert client.get('/dashboards/functional-progress?case_id=OT-001&limit=101').status_code == 422


def test_portuguese_wording_and_approximations_are_not_normalized(client, records):
    account = 'Manteve atenção por aproximadamente oito minutos, com apoio verbal.'
    with db() as conn:
        row = conn.execute(text("SELECT id FROM observations WHERE session_id=:id AND functional_domain='Attention'"), {'id': records[0]['id']}).scalar_one()
        conn.execute(text('UPDATE observations SET observation_text=:text, reviewed_text=:text, source_excerpt=:text WHERE id=:id'), {'id': row, 'text': account})
        conn.execute(text('UPDATE observation_review_events SET previous_text=:text, reviewed_text=:text WHERE observation_id=:id'), {'id': row, 'text': account})
        conn.execute(text('UPDATE sessions SET notes=notes || :text WHERE id=:id'), {'id': records[0]['id'], 'text': ' ' + account})
    session = next(session for session in client.get('/dashboards/functional-progress?case_id=OT-001').json()['sessions'] if session['id'] == records[0]['id'])
    evidence = next(evidence for evidence in session['evidence'] if evidence['observation_id'] == row)
    assert evidence['reviewed_text'] == evidence['source_excerpt'] == account
    assert 'attention' in evidence['topics'] and 'assistance' in evidence['topics']
