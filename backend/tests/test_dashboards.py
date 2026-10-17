"""Dashboard contracts exercised against isolated persisted synthetic records."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.database import db
from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.delenv("ELO_DATABASE_URL", raising=False)
    monkeypatch.setenv("ELO_DB_PATH", str(tmp_path / "dashboard.db"))
    monkeypatch.setenv("ELO_INFERENCE_MODE", "mock")
    with TestClient(app) as instance:
        yield instance


@pytest.fixture
def records(client):
    def post(path, data):
        response = client.post(path, json=data)
        assert response.is_success, response.text
        return response.json()
    org = post('/registry/organizations', {"name": "Synthetic Dashboard Lab"})
    prof = post('/registry/professionals', {"organization_id": org['id'], "display_name": "Synthetic Reviewer"})
    patient = post('/registry/patients', {"organization_id": org['id'], "synthetic_code": "SYN-DASH"})
    for case in ['DASH-A', 'DASH-B', 'EMPTY-CASE']:
        post('/cases', {"id": case})
        post(f'/registry/cases/{case}/patient', {"patient_id": patient['id']})
    notes = "Synthetic child completed a block task with three verbal prompts."
    sessions = [post('/sessions', {"case_id": case, "notes": notes, "duration_minutes": 40}) for case in ['DASH-A', 'DASH-A', 'DASH-B']]
    observations = []
    for index, decision in enumerate(['approve', 'correct', 'reject', None, None]):
        session = sessions[0 if index < 4 else 1]
        obs = post(f"/registry/sessions/{session['id']}/observations", {
            "source_excerpt": "completed a block task", "functional_domain": "Motor Skills",
            "observation_text": "Completed the synthetic block task with prompts."})
        observations.append(obs)
        if decision:
            payload = {"reviewer_id": prof['id'], "decision": decision}
            if decision == 'correct':
                payload.update(reviewed_text="Completed the block activity after three prompts.", reviewed_domain="Transitions")
            if decision == 'reject':
                payload['reason'] = 'Synthetic observation is insufficiently specific.'
            post(f"/registry/observations/{obs['id']}/review", payload)
    post(f"/sessions/{sessions[0]['id']}/extract", {})
    post(f"/sessions/{sessions[0]['id']}/approve", {"reviewed_text": "Synthetic manually reviewed session."})
    post(f"/sessions/{sessions[1]['id']}/extract", {})
    return sessions, observations, prof


def test_empty_dashboard_has_no_invented_rates(client):
    operations = client.get('/dashboards/operations').json()
    assert operations['total_cases'] == operations['total_sessions'] == operations['total_observations'] == 0
    assert operations['review_completion_percent'] is None
    assert operations['observation_statuses'] == dict.fromkeys(['pending', 'approved', 'corrected', 'rejected'], 0)
    functional = client.get('/dashboards/functional').json()
    assert functional['domains'] == functional['sessions'] == []
    governance = client.get('/dashboards/governance').json()
    assert governance['total_decisions'] == 0
    assert governance['decision_percentages'] == dict.fromkeys(['approve', 'correct', 'reject'], None)
    assert governance['telemetry']['latency_ms'] is None
    assert governance['telemetry']['tokens'] is None
    assert governance['telemetry']['cost'] is None
    assert governance['health']['provider_connectivity'] == 'unverified'


def test_operations_counts_do_not_multiply_across_joins(client, records):
    response = client.get('/dashboards/operations')
    assert response.status_code == 200
    data = response.json()
    assert (data['total_cases'], data['total_sessions'], data['total_observations']) == (3, 3, 5)
    assert data['session_statuses'] == {'draft': 1, 'pending': 1, 'approved': 1}
    assert data['observation_statuses'] == {'pending': 2, 'approved': 1, 'corrected': 1, 'rejected': 1}
    assert data['reviewed_observations'] == 3
    assert data['review_completion_percent'] == 60


def test_functional_uses_reviewed_domain_and_keeps_zero_observation_sessions(client, records):
    sessions, _, _ = records
    data = client.get('/dashboards/functional').json()
    assert data['domains'] == [{'domain': 'Motor Skills', 'count': 1}, {'domain': 'Transitions', 'count': 1}]
    assert len(data['sessions']) == 3
    rows = {row['id']: row for row in data['sessions']}
    assert rows[sessions[0]['id']]['total_observations'] == 4
    assert rows[sessions[0]['id']]['pending'] == 1
    assert rows[sessions[2]['id']]['total_observations'] == 0
    filtered = client.get('/dashboards/functional', params={'case_id': 'DASH-B'}).json()
    assert filtered['scope'] == 'persisted synthetic records for case DASH-B'
    assert filtered['domains'] == []
    assert filtered['total_sessions'] == len(filtered['sessions']) == 1
    capped = client.get('/dashboards/functional?limit=1').json()
    assert len(capped['sessions']) == 1 and capped['total_sessions'] == 3


def test_reviewed_drill_down_filters_and_retains_original_evidence(client, records):
    sessions, observations, prof = records
    data = client.get('/dashboards/reviewed-observations', params={'domain': 'Transitions', 'case_id': 'DASH-A'}).json()
    assert data['total'] == 1
    corrected = data['observations'][0]
    assert corrected['id'] == observations[1]['id']
    assert corrected['functional_domain'] == 'Motor Skills'
    assert corrected['reviewed_domain'] == 'Transitions'
    assert client.get('/dashboards/reviewed-observations', params={'domain': "' OR 1=1 --"}).json()['total'] == 0
    detail = client.get(f"/dashboards/sessions/{sessions[0]['id']}/evidence").json()
    assert 'notes' not in detail['session']
    row = next(obs for obs in detail['observations'] if obs['id'] == corrected['id'])
    assert row['verbatim_match'] is True
    assert row['reviewed_by'] == prof['id']
    assert row['events'][0]['previous_domain'] == 'Motor Skills'
    assert row['events'][0]['reviewed_domain'] == 'Transitions'
    assert row['events'][0]['decision'] == 'correct'
    assert row['events'][0]['previous_text'] == observations[1]['observation_text']
    assert row['source_excerpt'] == observations[1]['source_excerpt']
    assert client.get('/dashboards/sessions/missing/evidence').status_code == 404


def test_governance_event_denominator_and_exact_provenance(client, records):
    sessions, observations, _ = records
    data = client.get('/dashboards/governance?limit=1').json()
    assert data['total_decisions'] == 3
    assert data['decisions'] == {'approve': 1, 'correct': 1, 'reject': 1}
    assert data['decision_percentages'] == dict.fromkeys(['approve', 'correct', 'reject'], 33.3)
    assert len(data['events']) == 1
    assert data['events'][0]['session_id'] == sessions[0]['id']
    assert data['provenance'] == {'total_observations': 5, 'verbatim_matches': 5, 'unmatched': 0}
    # Case-insensitive LIKE would falsely accept this synthetic mismatch.
    with db() as conn:
        conn.execute(text("UPDATE observations SET source_excerpt='COMPLETED A BLOCK TASK' WHERE id=:id"), {'id': observations[0]['id']})
    assert client.get('/dashboards/governance').json()['provenance']['unmatched'] == 1


@pytest.mark.parametrize('mode,key,effective', [('mock', '', 'mock'), ('amd', '', 'mock'), ('amd', 'test-only', 'amd')])
def test_governance_reports_configuration_without_claiming_provider_success(client, monkeypatch, mode, key, effective):
    monkeypatch.setenv('ELO_INFERENCE_MODE', mode)
    monkeypatch.setenv('RADEON_API_KEY', key)
    data = client.get('/dashboards/governance').json()
    assert data['health']['effective_inference_mode'] == effective
    assert data['health']['configured_inference_mode'] == mode
    assert data['health']['provider_connectivity'] == 'unverified'
    assert data['health']['historical_inference_provenance'] == 'unavailable'


def test_dashboard_gets_never_mutate_persisted_records(client, records):
    def snapshot():
        with db() as conn:
            return {name: [tuple(row) for row in conn.execute(text(f'SELECT * FROM {name} ORDER BY id'))]
                    for name in ['cases', 'sessions', 'observations', 'observation_review_events']}
    before = snapshot()
    for path in ['/dashboards/operations', '/dashboards/functional', '/dashboards/governance', '/dashboards/reviewed-observations', f'/dashboards/sessions/{records[0][0]["id"]}/evidence']:
        assert client.get(path).status_code == 200
    assert snapshot() == before


def test_limits_are_bounded(client):
    for path in ['/dashboards/functional', '/dashboards/governance', '/dashboards/reviewed-observations']:
        assert client.get(path + '?limit=0').status_code == 422
        assert client.get(path + '?limit=1000').status_code == 422


def test_database_failure_returns_actionable_safe_error(client, monkeypatch):
    import app.dashboards as dashboards
    def unavailable():
        raise OperationalError('sensitive connection details', {}, Exception('secret'))
    monkeypatch.setattr(dashboards, 'db', unavailable)
    response = client.get('/dashboards/operations')
    assert response.status_code == 503
    assert 'migrations' in response.json()['detail']
    assert 'secret' not in response.text and 'sensitive' not in response.text


def test_legacy_accepted_record_does_not_invent_an_audit_decision(client, records):
    _, observations, _ = records
    with db() as conn:
        conn.execute(text('DELETE FROM observation_review_events WHERE observation_id=:id'), {'id': observations[0]['id']})
        conn.execute(text('UPDATE observations SET reviewed_domain=NULL WHERE id=:id'), {'id': observations[0]['id']})
    # Legacy accepted observations can be described, but are not counted as
    # authenticated or newly recorded human decisions without an actual event.
    assert client.get('/dashboards/operations').json()['reviewed_observations'] == 3
    data = client.get('/dashboards/governance').json()
    assert data['total_decisions'] == 2
    assert data['decisions']['approve'] == 0
    assert client.get('/dashboards/functional').json()['domains'][0] == {'domain': 'Motor Skills', 'count': 1}


def test_demo_seed_refuses_to_overwrite_an_existing_file(tmp_path):
    import subprocess
    import sys
    from pathlib import Path
    path = tmp_path / 'protected.db'
    original = b'existing synthetic data must remain unchanged'
    path.write_bytes(original)
    result = subprocess.run([sys.executable, '-m', 'scripts.seed_dashboard_demo', '--database', str(path)],
                            cwd=Path(__file__).resolve().parents[1], capture_output=True, text=True)
    assert result.returncode != 0
    assert 'protected' in result.stderr
    assert path.read_bytes() == original
