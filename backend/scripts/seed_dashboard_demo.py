"""Create an isolated, synthetic-only dashboard demo through the existing API.

Usage (from backend): .venv/bin/python -m scripts.seed_dashboard_demo --database data/dashboard-demo.db
Refuses existing files; never overwrites or seeds the application's default database.
"""
import argparse
import os
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', required=True)
    args = parser.parse_args()
    path = Path(args.database).resolve()
    default = Path(__file__).resolve().parents[1] / 'data' / 'elo.db'
    if path == default or path.exists():
        parser.error('Choose a new, isolated database file. Existing files and the default elo.db are protected.')
    path.parent.mkdir(parents=True, exist_ok=True)
    # Reserve the target before importing the app, preventing accidental reseeding.
    path.touch(exist_ok=False)
    os.environ.pop('ELO_DATABASE_URL', None)
    os.environ['ELO_DB_PATH'] = str(path)
    os.environ['ELO_INFERENCE_MODE'] = 'mock'
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as client:
        def post(endpoint, data):
            response = client.post(endpoint, json=data)
            response.raise_for_status()
            return response.json()
        org = post('/registry/organizations', {'name': 'Synthetic Elo Demonstration Lab'})
        reviewer = post('/registry/professionals', {'organization_id': org['id'], 'display_name': 'Synthetic Demo Reviewer'})
        for case_index in range(2):
            case_id = f'DEMO-SYN-{case_index + 1:03}'
            patient = post('/registry/patients', {'organization_id': org['id'], 'synthetic_code': case_id})
            post('/cases', {'id': case_id})
            post(f'/registry/cases/{case_id}/patient', {'patient_id': patient['id']})
            for session_index in range(3):
                notes = 'Synthetic session only. The child joined a block activity after three verbal prompts. The child placed blocks with minimal assistance.'
                session = post('/sessions', {'case_id': case_id, 'notes': notes, 'duration_minutes': 40})
                for index, decision in enumerate(['approve', 'correct', 'reject', None]):
                    obs = post(f"/registry/sessions/{session['id']}/observations", {
                        'source_excerpt': 'The child joined a block activity after three verbal prompts.',
                        'functional_domain': ['Participation', 'Motor Skills', 'Participation', 'Transitions'][index],
                        'observation_text': 'Joined a block activity after three verbal prompts.'})
                    if decision and session_index != 2:
                        payload = {'reviewer_id': reviewer['id'], 'decision': decision}
                        if decision == 'correct':
                            payload.update(reviewed_domain='Transitions', reviewed_text='Joined the block activity with three verbal prompts.')
                        if decision == 'reject':
                            payload['reason'] = 'Synthetic duplicate observation; excluded by the demo reviewer.'
                        post(f"/registry/observations/{obs['id']}/review", payload)
                if session_index < 2:
                    post(f"/sessions/{session['id']}/extract", {})
                if session_index == 0:
                    post(f"/sessions/{session['id']}/approve", {'reviewed_text': 'Synthetic demonstration session reviewed manually.'})
        print('Persisted synthetic demo:', client.get('/dashboards/operations').json())
        print('Start API from backend with ELO_DB_PATH=' + str(path) + ' ELO_INFERENCE_MODE=mock .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000')


if __name__ == '__main__':
    main()
