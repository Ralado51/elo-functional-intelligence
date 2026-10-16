import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import ReviewWorkspace from './ReviewWorkspace';
import FunctionalDocumentationPreview from './FunctionalDocumentationPreview';

type Observation = { category: string; description: string; evidence: string; requires_review: boolean };
type Session = { id: string; case_id: string; notes: string; duration_minutes: number; created_at: string; status: 'draft'|'pending'|'approved'; extraction: { observations: Observation[]; missing_information: string[] } | null; reviewed_text: string | null; approved_at: string | null };
type Case = { id: string; created_at: string };
type Health = { status: string; mode: 'mock' | 'amd'; amd_inference: boolean; persistence: string };
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(API + path, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error('API error ' + response.status + ': ' + await response.text());
  return response.json() as Promise<T>;
}

function App() {
  const [caseId, setCaseId] = useState('OT-001');
  const [cases, setCases] = useState<Case[]>([]);
  const [history, setHistory] = useState<Session[]>([]);
  const [notes, setNotes] = useState('Synthetic session: The child participated in a block-fitting activity. The child needed three verbal prompts to begin the transition. The child completed the activity with minimal assistance.');
  const [session, setSession] = useState<Session | null>(null);
  const [review, setReview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [documentationRevision, setDocumentationRevision] = useState(0);

  async function refreshCases() { setCases(await api<Case[]>('/cases')); }
  async function refreshHistory(id: string) {
    if (!id.trim()) { setHistory([]); return; }
    try { setHistory(await api<Session[]>('/cases/' + encodeURIComponent(id) + '/sessions')); }
    catch (e) { if (e instanceof Error && e.message.includes('404')) setHistory([]); else throw e; }
  }
  useEffect(() => { void refreshCases().catch(e => setError(String(e))); void api<Health>('/health').then(setHealth).catch(() => setHealth(null)); }, []);

  async function run(action: () => Promise<Session>) {
    setBusy(true); setError('');
    try {
      const next = await action();
      setSession(next);
      setReview(next.reviewed_text ?? '');
      await refreshCases();
      await refreshHistory(next.case_id);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  const create = () => run(() => api<Session>('/sessions', { case_id: caseId, notes, duration_minutes: 40 }));
  const extract = () => session && health && run(() => api<Session>('/sessions/' + session.id + '/extract', {}));
  const approve = () => session && run(() => api<Session>('/sessions/' + session.id + '/approve', { reviewed_text: review }));
  function selectSession(item: Session) {
    setDocumentationRevision(value => value + 1);
    setSession(item); setCaseId(item.case_id); setNotes(item.notes); setReview(item.reviewed_text ?? ''); setError('');
  }
  async function selectCase(id: string) {
    setDocumentationRevision(value => value + 1);
    setCaseId(id); setSession(null); setReview(''); setError('');
    try { await refreshHistory(id); } catch (e) { setError(String(e)); }
  }

  return <main>
    <header><div className="brand">ELO <span>FUNCTIONAL INTELLIGENCE</span></div><span className="tag">RESEARCH MVP · SYNTHETIC DATA ONLY</span></header>
    <section className="intro"><p className="eyebrow">ELO IA LABS / HEALTH & WELLBEING</p><h1>Clinical observations.<br/><em>Functional clarity.</em></h1><p>Document 40-minute pediatric occupational therapy sessions with human-reviewed, traceable records.</p></section>
    <section className="panel history-panel"><h2>01 / Case history</h2><div className="history-controls"><label htmlFor="case-picker">Synthetic case</label><select id="case-picker" value={cases.some(c => c.id === caseId) ? caseId : ''} onChange={e => void selectCase(e.target.value)}><option value="">Choose a registered case</option>{cases.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}</select><button className="secondary" disabled={busy || !caseId.trim()} onClick={() => void refreshHistory(caseId).catch(e => setError(String(e)))}>Refresh history</button></div>
      <p className="muted">You may also enter a new synthetic case ID in the session form below. No identifiable patient information.</p>
      <div className="history-list">{history.length ? history.map(s => <button key={s.id} className={'history-item ' + (session?.id === s.id ? 'selected' : '')} onClick={() => selectSession(s)}><span>{new Date(s.created_at).toLocaleString()}</span><strong>{s.status}</strong><small>{s.id.slice(0, 8)} · 40 min</small></button>) : <p className="muted">No sessions loaded for this case.</p>}</div>
    </section>
    <div className="layout">
      <section className="panel"><h2>02 / Session notes</h2><label>Case identifier</label><input value={caseId} onChange={e => {setCaseId(e.target.value);setHistory([]);}} disabled={!!session}/><label>Session duration</label><div className="fixed">40 minutes · fixed for this MVP</div><label>Therapist observations</label><textarea rows={9} value={notes} onChange={e => setNotes(e.target.value)} disabled={!!session}/><button onClick={create} disabled={busy || !!session || !caseId.trim() || notes.trim().length < 10}>Create session</button><button className="secondary" onClick={() => {setSession(null);setReview('');setError('');}} disabled={busy}>Start new session</button></section>
      <section className="panel"><h2>03 / Human review</h2><div className="status">Status: <strong>{session?.status ?? 'Not started'}</strong></div>{!session ? <p className="muted">Create or select a session to begin.</p> : <>
        <p className="muted">Session ID: {session.id}</p><div className="status" role="status">Current inference mode: <strong>{health ? (health.amd_inference ? 'AMD Token Factory' : 'Mock') : 'Unavailable'}</strong></div><button onClick={extract} disabled={busy || session.status !== 'draft' || !health}>{health?.amd_inference ? 'Extract with AMD AI' : 'Process session (mock)'}</button>
        {session.extraction && <><div className="notice">{session.extraction.observations.length ? "This session contains extracted observations. Verify every evidence excerpt and complete human review before using any observation." : "No extracted observations are recorded for this session. Review the missing information below."} Current API mode: {health?.amd_inference ? "AMD Token Factory" : "Mock or unavailable"}.</div><h3>Extracted observations</h3>{session.extraction.observations.length ? session.extraction.observations.map((o,i)=><div key={i}><strong>{o.category}</strong><p>{o.description}</p><small>Evidence: {o.evidence}</small></div>) : <p className="muted">None recorded for this session.</p>}<h3>Missing information</h3><ul>{session.extraction.missing_information.map((m,i)=><li key={i}>{m}</li>)}</ul><label>Professional review (manual)</label><textarea rows={5} value={session.status === 'approved' ? session.reviewed_text ?? '' : review} onChange={e => setReview(e.target.value)} disabled={session.status === 'approved'} placeholder="Enter your own reviewed documentation. AI-generated text is never automatically approved."/><button onClick={approve} disabled={busy || session.status !== 'pending' || !review.trim()}>Approve reviewed record</button>{session.approved_at && <p className="muted">Approved: {new Date(session.approved_at).toLocaleString()}</p>}</>}
      </>}</section>
    </div><ReviewWorkspace apiBase={API} sessionId={session?.id ?? null} onReviewCompleted={() => setDocumentationRevision(value => value + 1)}/><FunctionalDocumentationPreview apiBase={API} sessionId={session?.id ?? null} revision={documentationRevision}/>{error && <p role="alert" className="error">{error}</p>}<footer>Prototype only. Not for diagnosis or clinical decision-making. Do not enter real patient data.</footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
