#!/usr/bin/env python3
"""Default is read-only. Requires separate user authorization before --execute-authorized.
Run with backend's Python environment. Never prints credentials/report contents.
"""
import argparse
import os
from urllib.parse import urlsplit
import httpx

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base-url', default='http://127.0.0.1:8000')
parser.add_argument('--session-id', required=True)
parser.add_argument('--reviewer-id', required=True)
parser.add_argument('--execute-authorized', action='store_true', help='ONE generation POST; only after separate explicit user authorization')
args = parser.parse_args()
url = urlsplit(args.base_url)
if url.username or url.password or url.query or url.fragment or (url.scheme != 'https' and not (url.scheme == 'http' and url.hostname in ('127.0.0.1','localhost','::1'))):
    parser.error('Use HTTPS or loopback HTTP, without URL credentials/query/fragment')
token = os.getenv('ELO_FAMILY_REPORT_OPERATOR_TOKEN', '')
if len(token) < 32:
    parser.error('Supply operator credential securely through ELO_FAMILY_REPORT_OPERATOR_TOKEN')
# Session/reviewer values are local API parameters, NEVER provider payload IDs.
from urllib.parse import quote
path = args.base_url.rstrip('/')+'/registry/sessions/'+quote(args.session_id,safe='')+'/family-report'
try:
    with httpx.Client(timeout=110, transport=httpx.HTTPTransport(retries=0), follow_redirects=False) as client:
        headers={'X-Family-Report-Token':token}
        saved=client.get(path,headers=headers,params={'reviewer_id':args.reviewer_id})
        saved.raise_for_status()
        status=saved.json()['status']
        print('Saved status:',status)
        if status!='not_generated':
            print('No generation sent: reservation/result already exists. Inspect through GET; do not retry or delete it.')
            raise SystemExit(1 if args.execute_authorized else 0)
        if not args.execute_authorized:
            print('Read-only preflight complete. No inference call. Separate authorization required before execution.')
            raise SystemExit(0)
        result=client.post(path,headers=headers,json={'reviewer_id':args.reviewer_id,'synthetic_confirmed':True})
        result.raise_for_status()
        print('Saved result status:',result.json()['status'])
        print('One generation POST completed. Draft remains unapproved; inspect and review separately. No retry.')
except (httpx.HTTPError, ValueError, KeyError):
    raise SystemExit('API unavailable or generation failed. No retry was sent. Use read-only GET to inspect the durable attempt; never delete the reservation.') from None
