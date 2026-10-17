"""CORS is a browser boundary, not API authentication or write authorization."""
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.delenv('ELO_DATABASE_URL', raising=False)
    monkeypatch.setenv('ELO_DB_PATH', str(tmp_path / 'exposure.db'))
    return TestClient(app)


@pytest.mark.parametrize('origin', ['http://localhost:5173', 'http://127.0.0.1:5173'])
def test_existing_local_cors_origins_remain_explicit(client, origin):
    response = client.options('/sessions', headers={
        'Origin': origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Content-Type'})
    assert response.status_code == 200
    assert response.headers['access-control-allow-origin'] == origin
    assert '*' not in response.headers['access-control-allow-origin']


def test_untrusted_origin_is_not_cors_authorized(client):
    response = client.options('/sessions', headers={
        'Origin': 'https://untrusted.invalid', 'Access-Control-Request-Method': 'POST'})
    assert response.status_code == 400
    assert 'access-control-allow-origin' not in response.headers


def test_cors_must_not_be_mistaken_for_write_authentication(client):
    # Demonstrates the exposure boundary: a direct HTTP client can still write.
    # Public protection must be enforced by private binding + an authenticated,
    # read-only gateway, not by changing the CORS allowlist.
    response = client.post('/cases', json={'id': 'SYN-LOCAL-EXPOSURE-TEST'})
    assert response.status_code == 201
