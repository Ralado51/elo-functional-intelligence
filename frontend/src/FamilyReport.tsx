import React, { useEffect, useRef, useState } from 'react';
import './family-report.css';
type Claim = { text: string; observation_refs: string[] };
type Evidence = { alias: string; text: string; observation_id: string; source_excerpt: string; reviewer_id: string; audit_event_id: string };
type Result = { session_id: string; case_id?: string; duration_minutes?: number; status: string; stale?: boolean; reviewed_by?: string; reviewed_at?: string; review_reason?: string; evidence?: Evidence[]; report?: {
  summary: string; participation: Claim[]; strengths: Claim[]; support: Claim[];
  home_suggestions: { activity: string; text: string; observation_refs: string[] }[]; longitudinal_limitations: string;
} };
export default function FamilyReport({ apiBase, sessionId }: { apiBase: string; sessionId: string | null }) {
  const [token,setToken]=useState(''); const [reviewer,setReviewer]=useState('');
  const [confirmed,setConfirmed]=useState(false); const [checked,setChecked]=useState(false);
  const [reason,setReason]=useState(''); const [data,setData]=useState<Result|null>(null);
  const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const lock=useRef(false); const version=useRef(0);
  useEffect(()=>{version.current++;setData(null);setError('');setChecked(false);setReason('');setConfirmed(false);setBusy(false);lock.current=false;},[sessionId]);
  useEffect(()=>()=>{version.current++;},[]);
  async function request(action:'load'|'generate'|'approve'|'reject') {
    if(!sessionId||lock.current)return;
    lock.current=true;setBusy(true);setError('');const active=version.current;const controller=new AbortController();const timer=window.setTimeout(()=>controller.abort(),110_000);
    try {
      const base=apiBase+'/registry/sessions/'+encodeURIComponent(sessionId)+'/family-report';
      const url=action==='load'?base+'?reviewer_id='+encodeURIComponent(reviewer):base+(action==='generate'?'':'/review');
      const response=await fetch(url,{signal:controller.signal,redirect:'error',method:action==='load'?'GET':'POST',headers:{'Content-Type':'application/json','X-Family-Report-Token':token},...(action==='load'?{}:{body:JSON.stringify({reviewer_id:reviewer,synthetic_confirmed:confirmed,...(action==='generate'?{}:{decision:action,all_content_reviewed:checked,reason})})})});
      if(!response.ok)throw new Error('HTTP '+response.status+': '+await response.text());
      const result=await response.json() as Result;
      if(result.session_id!==sessionId||!['not_generated','generating','failed','draft','approved','rejected'].includes(result.status)||(['draft','approved','rejected'].includes(result.status)&&(!result.report||typeof result.report.summary!=='string'||!['participation','strengths','support','home_suggestions'].every(key=>Array.isArray((result.report as unknown as Record<string,unknown>)[key])))))throw new Error('Unexpected family-report response; no approval permitted.');
      if(active===version.current){setData(result);setChecked(false);}
    }catch(err){if(active===version.current)setError(String(err));}
    finally{window.clearTimeout(timer);if(active===version.current){lock.current=false;setBusy(false);}}
  }
  const authorized=!!token&&!!reviewer&&!!sessionId&&!busy;
  function refs(ids:string[]){return ids.map(id=><a key={id} href={'#family-'+id} onClick={()=>{const details=document.getElementById('family-'+id)?.closest('details');if(details)details.open=true;}}>Evidence {id} </a>);}
  return <section className="panel family-report" aria-label="Family participation report">
    <h2>07 / Family participation report</h2><p>Synthetic research demonstration · optional AI-assisted draft · not a signed clinical report.</p>
    <div className="family-controls">
      <label>Family-report operator credential<input type="password" disabled={busy} autoComplete="off" value={token} onChange={e=>{setToken(e.target.value);setData(null);}}/></label>
      <label>Registered synthetic report reviewer<input disabled={busy} value={reviewer} onChange={e=>{setReviewer(e.target.value);setData(null);}}/></label>
      <label className="family-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I confirm this session and its observation text are synthetic only.</label>
      <button disabled={!authorized} onClick={()=>void request('load')}>Load saved family report</button>
      <button disabled={!authorized||!confirmed||!!data&&data.status!=='not_generated'} onClick={()=>void request('generate')}>Generate Family Report</button>
      <p className="muted">Generation may incur one provider request. Never retry after an uncertain result; load the saved status. No automatic generation on refresh. Credentials stay in component memory only.</p>
    </div>
    {busy&&<p role="status">Working on family report…</p>}{error&&<p role="alert" className="error">{error}</p>}
    {data&&<><p className="family-status">Status: <strong>{data.status==='draft'?'Draft':data.status==='approved'?'Approved':data.status}</strong>{data.stale&&' · Evidence changed: do not use this report'}</p>
      {['failed','generating'].includes(data.status)&&<p role="alert">The attempt is consumed or unresolved. No automatic retry or regeneration is available. Ask the operator to inspect it.</p>}
      {data.report&&<article className="family-paper">
        <header><div><p className="workspace-kicker">ELO / SYNTHETIC FAMILY DEMONSTRATION</p><h2>Participation, together</h2><p>Case {data.case_id} · {data.duration_minutes}-minute session</p></div><strong>{data.status==='approved'&&!data.stale?'Approved synthetic draft':'Draft / not approved for use'}</strong></header>
        <p>Session reference: {data.session_id}</p><p className="family-lead">{data.report.summary}</p>
        <section><h3>Documented participation</h3>{data.report.participation.map((claim,index)=><p key={index}>{claim.text} {refs(claim.observation_refs)}</p>)}</section>
        <figure className="family-evidence-chart"><figcaption>Evidence map · descriptive references, not scores or progress</figcaption>{data.report.participation.map((claim,index)=><div key={index}><span aria-hidden="true">●</span><p>{claim.text}<small>{refs(claim.observation_refs)}</small></p></div>)}</figure>
        <div className="family-columns">{(['strengths','support'] as const).map(key=><section key={key}><h3>{key==='strengths'?'Documented strengths':'Where support was recorded'}</h3>{data.report![key].length?data.report![key].map((claim,index)=><p key={index}>{claim.text} {refs(claim.observation_refs)}</p>):<p>No additional account in this draft. Absence is not an assessment.</p>}</section>)}</div>
        <section className="family-suggestions"><h3>Optional home activity ideas</h3><p>AI-selected proposals · {data.status==='approved'&&!data.stale?'reviewed in this synthetic draft; still optional and non-prescriptive':'pending therapist review; do not treat as recommendations'}</p>{data.report.home_suggestions.length?data.report.home_suggestions.map(item=><p key={item.activity}>{item.text} {refs(item.observation_refs)}</p>):<p>No activity suggestions selected.</p>}</section>
        <p className="notice">{data.report.longitudinal_limitations} No comparable longitudinal assessment is available.</p>
        <details><summary>Exact evidence, reviewer and source references</summary>{data.evidence?.map(item=><section key={item.alias} id={'family-'+item.alias}><h3>Evidence {item.alias}</h3><p>{item.text}</p><blockquote>{item.source_excerpt}</blockquote><p>Observation {item.observation_id}<br/>Observation reviewer {item.reviewer_id}<br/>Audit {item.audit_event_id}</p><a href={apiBase+'/registry/observations/'+encodeURIComponent(item.observation_id)+'/review-events'} target="_blank" rel="noreferrer">Original observation decisions</a></section>)}</details>
        {data.reviewed_by&&<p>Report reviewer: {data.reviewed_by} · {data.reviewed_at}<br/>Decision note: {data.review_reason}</p>}
        <footer>Research demonstration only · synthetic evidence · no diagnosis, clinical recommendation or signed record.</footer>
      </article>}
      {data.status==='draft'&&!data.stale&&<div className="family-controls"><h3>Explicit therapist review</h3><label className="family-check"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>I reviewed every statement, evidence reference and optional suggestion.</label><label>Report decision note<textarea value={reason} onChange={e=>setReason(e.target.value)}/></label><button disabled={!authorized||!confirmed||!checked||reason.trim().length<3} onClick={()=>void request('approve')}>Approve synthetic family draft</button><button className="secondary" disabled={!authorized||!confirmed||!checked||reason.trim().length<3} onClick={()=>void request('reject')}>Reject synthetic family draft</button></div>}
      {data.report&&<button className="secondary family-controls" onClick={()=>{document.body.classList.add('family-print-active');try{window.print();}finally{document.body.classList.remove('family-print-active');}}}>Print marked report</button>}
    </>}
  </section>;
}
