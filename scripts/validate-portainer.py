#!/usr/bin/env python3
"""Validate deployment wiring with nondeployable inputs, without printing secrets."""
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
COMMAND = ['docker', 'compose', '--project-name', 'elo-static-validation', '-f', str(ROOT / 'deploy/portainer/compose.demo.yml')]
ENV = {**os.environ, 'GHCR_NAMESPACE': 'synthetic-validation', 'API_IMAGE_DIGEST': '0' * 64,
       'FRONTEND_IMAGE_DIGEST': '1' * 64, 'POSTGRES16_IMAGE_DIGEST': '2' * 64,
       'POSTGRES_PASSWORD': 'synthetic:@/$# password', 'DEMO_BASIC_AUTH_USERS': 'synthetic:$2y$test-only',
       'TRAEFIK_ROUTE_PREFIX': 'elo-static-validation', 'ELO_INFERENCE_MODE': 'mock',
       'ELO_SYNTHETIC_ONLY_ACK': 'false', 'RADEON_API_KEY': ''}

def render(env):
    return subprocess.run(COMMAND + ['config', '--format', 'json'], env=env, capture_output=True, text=True)

result = render(ENV)
if result.returncode:
    raise SystemExit('FAIL: Compose configuration could not be normalized (output withheld).')
model = json.loads(result.stdout)
services = model['services']
assert set(services) == {'postgres', 'migrate', 'api', 'frontend'}
for service in services.values():
    assert re.fullmatch(r'ghcr.io/synthetic-validation/elo-functional-intelligence-(?:api|frontend|postgres:16)@sha256:[0-9a-f]{64}', service['image'])
    assert not service.get('ports') and not service.get('build') and not service.get('container_name')
    assert service['read_only'] is True
    assert all(v['type'] != 'bind' for v in service.get('volumes', []))
assert services['api']['image'] == services['migrate']['image']
assert services['frontend']['user'] == '101:101'
assert services['api']['user'] == services['migrate']['user'] == '10001:10001'
for name in ('api', 'migrate', 'postgres'):
    assert 'traefik' not in services[name]['networks']
    assert services[name]['labels']['traefik.enable'] == 'false'
assert set(services['postgres']['networks']) == set(services['migrate']['networks']) == {'database'}
assert model['networks']['database']['internal'] and model['networks']['application']['internal']
assert model['networks']['traefik']['external']
assert not model['volumes']['postgres_data'].get('external')
assert services['migrate']['depends_on']['postgres']['condition'] == 'service_healthy'
assert services['api']['depends_on']['migrate']['condition'] == 'service_completed_successfully'
assert services['frontend']['depends_on']['api']['condition'] == 'service_healthy'
assert services['api']['environment']['ELO_INFERENCE_MODE'] == 'mock'
assert services['api']['environment']['ELO_SYNTHETIC_ONLY_ACK'] == 'false'
labels = services['frontend']['labels']
prefix = 'traefik.http.routers.elo-static-validation'
assert labels[prefix + '.rule'] == 'Host(`app.eloterapia.com.br`)'
assert labels[prefix + '.tls'] == 'true'
assert labels[prefix + '.entrypoints'] == 'websecure'
assert labels[prefix + '.middlewares'] == 'elo-static-validation-auth@docker'
# Compose re-escapes dollar signs in config output for safe re-parsing.
assert labels['traefik.http.middlewares.elo-static-validation-auth.basicauth.users'].replace('$$', '$') == ENV['DEMO_BASIC_AUTH_USERS']
assert labels['traefik.http.middlewares.elo-static-validation-auth.basicauth.removeheader'] == 'true'
assert labels['traefik.http.services.elo-static-validation-frontend.loadbalancer.server.port'] == '8080'
for key in ('API_IMAGE_DIGEST', 'FRONTEND_IMAGE_DIGEST', 'POSTGRES16_IMAGE_DIGEST', 'POSTGRES_PASSWORD', 'DEMO_BASIC_AUTH_USERS'):
    assert render({**ENV, key: ''}).returncode != 0, f'Missing required {key} accepted'
print('PASS: synthetic Compose normalization, image/auth/isolation/migration contracts and missing-input rejection')
