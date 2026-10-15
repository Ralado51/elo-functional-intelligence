import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

type Observation = { category: string; description: string; evidence: string; requires_review: boolean };
type Session = { id: string; case_id: string; notes: string; duration_minutes: number; status: 'draft'|'pending'|'approved'; extraction: { observations: Observation[]; missing_information: string[] } | null; reviewed_text: string | null };
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  const [caseId, setCaseId] = useState('OT-001');
  const [notes, setNotes] = useState('A criança participou de atividade de encaixe e brincadeira com blocos. Precisou de três lembretes verbais para iniciar a transição. Finalizou a atividade com ajuda mínima.');
  const [session, setSession] = useState<Session | null>(null);
  const [review, setReview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function request(path: string, body?: unknown): Promise<Session> {
    const res = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
    if (!res.ok) throw new Error('API error ' + res.status + ': ' + await res.text());
    return res.json();
  }
  async function run(action: () => Promise<Session>) {
    setBusy(true); setError('');
    try { setSession(await action()); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  const create = () => run(() => request('/sessions', { case_id: caseId, notes, duration_minutes: 40 }));
  const extract = () => session && run(() => request('/sessions/' + session.id + '/extract'));
  const approve = () => session && run(() => request('/sessions/' + session.id + '/approve', { reviewed_text: review }));

  return <main>
    <header><div className="brand">ELO <span>FUNCTIONAL INTELLIGENCE</span></div><span className="tag">RESEARCH MVP · SYNTHETIC DATA ONLY</span></header>
    <section className="intro"><p className="eyebrow">ELO IA LABS / HEALTH & WELLBEING</p><h1>Clinical observations.<br/><em>Functional clarity.</em></h1><p>Document 40-minute pediatric occupational therapy sessions with human-reviewed, traceable records.</p></section>
    <div className="layout">
      <section className="panel"><h2>01 / Session notes</h2><label>Case identifier</label><input value={caseId} onChange={e => setCaseId(e.target.value)} disabled={!!session}/><label>Session duration</label><div className="fixed">40 minutes · fixed for this MVP</div><label>Therapist observations</label><textarea rows={9} value={notes} onChange={e => setNotes(e.target.value)} disabled={!!session}/><button onClick={create} disabled={busy || !!session || !caseId.trim() || notes.trim().length < 10}>Create session</button><button className="secondary" onClick={() => {setSession(null);setReview('');setError('');}} disabled={busy}>Start new session</button></section>
      <section className="panel"><h2>02 / Human review</h2><div className="status">Status: <strong>{session?.status ?? 'Not started'}</strong></div>{!session ? <p className="muted">Create a session to begin.</p> : <>
        <p className="muted">Session ID: {session.id}</p><button onClick={extract} disabled={busy || session.status !== 'draft'}>Process session (mock)</button>
        {session.extraction && <><div className="notice">MOCK MODE — No AMD inference has occurred. No observations have been generated.</div><h3>Extracted observations</h3>{session.extraction.observations.length ? session.extraction.observations.map((o,i)=><div key={i}><strong>{o.category}</strong><p>{o.description}</p><small>Evidence: {o.evidence}</small></div>) : <p className="muted">None. Awaiting real AMD integration.</p>}<h3>Missing information</h3><ul>{session.extraction.missing_information.map((m,i)=><li key={i}>{m}</li>)}</ul><label>Professional review (manual)</label><textarea rows={5} value={session.reviewed_text ?? review} onChange={e => setReview(e.target.value)} disabled={session.status === 'approved'} placeholder="Enter your own reviewed documentation; no clinical text is generated in mock mode."/><button onClick={approve} disabled={busy || session.status !== 'pending' || !review.trim()}>Approve reviewed record</button></>}
      </>}</section>
    </div>{error && <p role="alert" className="error">{error}</p>}<footer>Prototype only. Not for diagnosis or clinical decision-making. Do not enter real patient data.</footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
