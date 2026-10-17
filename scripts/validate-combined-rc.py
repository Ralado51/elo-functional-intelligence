"""Opt-in disposable PostgreSQL RC validation; NEVER production or live AMD.
Run from backend with PYTHONPATH=. and ELO_RC_TEST_DATABASE_URL explicitly set.
Phases: prepare (empty 0004 DB), verify (after 0005), legacy (baseline code).
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
from sqlalchemy.engine import make_url

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('phase',choices=['prepare','verify','legacy'])
p.add_argument('--state',required=True)
a=p.parse_args()
url=make_url(os.environ['ELO_RC_TEST_DATABASE_URL'])
if url.host not in ('127.0.0.1','localhost') or not (url.database or '').startswith('elo_rc'):
    raise SystemExit('Only explicitly named loopback elo_rc disposable databases allowed')
os.environ.update(ELO_DATABASE_URL=str(url.render_as_string(hide_password=False)),ELO_INFERENCE_MODE='amd',RADEON_API_KEY='synthetic-rc-mock-no-live-key',ELO_SYNTHETIC_ONLY_ACK='true',ELO_FAMILY_REPORTS_ENABLED='true',ELO_FAMILY_REPORT_OPERATOR_TOKEN='synthetic-rc-operator-token-at-least-32-characters')
from fastapi.testclient import TestClient
from app.main import app
from app.database import db,all_rows,one,engine_for
# Existing extraction must never be invoked by this harness.
import app.main as main
main.extract_candidates=lambda _: (_ for _ in ()).throw(AssertionError('No extraction permitted'))
TEXTS=[('Task initiation','Required three verbal prompts to begin the block-fitting activity'),('Attention','Maintained attention for approximately 8 minutes during the block-fitting task'),('Motor coordination','Used both hands to manipulate blocks and completed 7 of 10 fitting attempts independently, with minimal physical assistance for the remaining attempts.'),('Transitions','Hesitated during transition to a second activity but responded to verbal guidance and completed the transition within 2 minutes.')]
TABLES=['cases','sessions','observations','observation_review_events','organizations','professionals','patients','guardians','patient_guardians']
def snapshot():
    with db() as c:
        data={t:all_rows(c,'SELECT * FROM '+t+' ORDER BY 1') for t in TABLES}
    return hashlib.sha256(json.dumps(data,sort_keys=True).encode()).hexdigest()
with TestClient(app) as client:
    def post(path,body,headers=None):
        r=client.post(path,json=body,headers=headers);assert r.is_success,r.text;return r.json()
    if a.phase=='prepare':
        with db() as c:assert one(c,'SELECT COUNT(*) AS n FROM cases')['n']==0,'Refusing a nonempty test DB'
        org=post('/registry/organizations',{'name':'Synthetic Combined RC Lab'})
        reviewer=post('/registry/professionals',{'organization_id':org['id'],'display_name':'Synthetic RC Reviewer'})['id']
        patient=post('/registry/patients',{'organization_id':org['id'],'synthetic_code':'SYN-COMBINED-RC'})['id']
        sessions=[]
        for case in ['OT-001','RC-SECOND']:
            s=post('/sessions',{'case_id':case,'notes':' '.join(t for _,t in TEXTS),'duration_minutes':40})['id'];sessions.append(s)
            post('/registry/cases/'+case+'/patient',{'patient_id':patient})
            for domain,text in TEXTS:
                obs=post('/registry/sessions/'+s+'/observations',{'functional_domain':domain,'observation_text':text,'source_excerpt':text})
                post('/registry/observations/'+obs['id']+'/review',{'decision':'approve','reviewer_id':reviewer})
        empty=post('/sessions',{'case_id':'OT-001','notes':'Synthetic empty session, no observation recorded.','duration_minutes':40})['id']
        state={'sessions':sessions,'empty':empty,'reviewer':reviewer,'original_hash':snapshot()}
        fd=os.open(a.state,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'w') as out:json.dump(state,out)
        print('PASS prepared synthetic 0004 records; protected-table fingerprint saved privately')
    else:
        state=json.loads(Path(a.state).read_text());assert snapshot()==state['original_hash'],'Existing data changed'
        if a.phase=='verify':
            import app.family_reports as family
            calls=[]
            def fake(messages,**kwargs):
                calls.append(messages)
                rows=json.loads(messages[1]['content'])['observations']
                claims=lambda cat:[{'text':r['allowed_family_text'],'observation_refs':[r['ref']]} for r in rows if cat=='participation' or cat in r['category'].split('/')]
                return json.dumps({'summary':family.SUMMARY,'participation':claims('participation'),'strengths':claims('strengths'),'support':claims('support'),'home_suggestions':[{'activity':'pause','observation_refs':[rows[0]['ref']]}],'longitudinal_limitations':family.LIMITATION})
            family.request_structured_content=fake
            headers={'X-Family-Report-Token':os.environ['ELO_FAMILY_REPORT_OPERATOR_TOKEN']}
            payload={'reviewer_id':state['reviewer'],'synthetic_confirmed':True}
            for sid,decision in zip(state['sessions'],['approve','reject']):
                path='/registry/sessions/'+sid+'/family-report'
                assert client.post(path,json=payload).status_code==401
                draft=post(path,payload,headers);assert draft['status']=='draft' and len(draft['evidence'])==4
                with db() as c:
                    raw=one(c,'SELECT report_json FROM family_reports WHERE session_id=:id',{'id':sid})['report_json']
                family.validate_draft(raw,draft['evidence'])
                engine_for.cache_clear();assert post(path,payload,headers)['status']=='draft'
                reviewed=post(path+'/review',{**payload,'decision':decision,'all_content_reviewed':True,'reason':'Reviewed synthetic RC facts, sources and optional proposals.'},headers)
                assert reviewed['status']==('approved' if decision=='approve' else 'rejected')
                assert client.post(path+'/review',json={**payload,'decision':decision,'all_content_reviewed':True,'reason':'Second decision blocked'},headers=headers).status_code==409
            assert len(calls)==2,'Duplicate mock provider call'
            print('PASS 0004→0005 preserves all protected rows; PostgreSQL draft/approve/reject, schema/evidence, auth, restart/duplicate checks; two MOCK calls only')
        for sid in state['sessions']:
            assert client.get('/sessions/'+sid).status_code==200
            obs=client.get('/registry/sessions/'+sid+'/observations').json();assert len(obs)==4
            for o in obs:assert len(client.get('/registry/observations/'+o['id']+'/review-events').json())==1
            assert client.get('/registry/sessions/'+sid+'/functional-documentation').json()['eligible_for_consolidation']
        assert client.get('/dashboards/operations').status_code==200
        assert client.get('/dashboards/governance').status_code==200
        assert len(client.get('/dashboards/functional-progress?case_id=OT-001').json()['sessions'])==2
        assert snapshot()==state['original_hash']
        print('PASS '+a.phase+' API/source/audit/documentation/dashboard compatibility; protected data unchanged')
