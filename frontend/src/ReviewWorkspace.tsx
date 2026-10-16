import React, { useEffect, useState } from 'react';

export type RegistryObservation = {
  id: string;
  session_id: string;
  source_excerpt: string;
  functional_domain: string;
  observation_text: string;
  review_status: 'pending' | 'approved' | 'corrected' | 'rejected';
  reviewed_text?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
};

type ReviewEvent = {
  id: string;
  decision: string;
  previous_status: string;
  previous_text: string;
  reviewed_text: string | null;
  reason: string | null;
  reviewer_id: string;
  created_at: string;
};

type Props = { apiBase: string; sessionId: string | null };

async function request<T>(apiBase: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(apiBase + path, body === undefined ? undefined : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + await response.text());
  return response.json() as Promise<T>;
}

function ObservationCard({ observation, apiBase, reviewerId, onReviewed }: {
  observation: RegistryObservation;
  apiBase: string;
  reviewerId: string;
  onReviewed: () => Promise<void>;
}) {
  const [decision, setDecision] = useState<'approve' | 'correct' | 'reject'>('approve');
  const [correctedText, setCorrectedText] = useState(observation.observation_text);
  const [reason, setReason] = useState('');
  const [events, setEvents] = useState<ReviewEvent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [auditBusy, setAuditBusy] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  async function loadEvents() {
    setAuditBusy(true);
    setError('');
    try { setEvents(await request<ReviewEvent[]>(apiBase, '/registry/observations/' + encodeURIComponent(observation.id) + '/review-events')); }
    catch (e) { setError(String(e)); }
    finally { setAuditBusy(false); }
  }

  async function submitReview() {
    setError('');
    if (!reviewerId.trim()) { setError('Enter the ID of a registered synthetic professional.'); return; }
    if (decision === 'correct' && !correctedText.trim()) { setError('Correction text is required.'); return; }
    if (decision === 'reject' && !reason.trim()) { setError('A rejection reason is required.'); return; }
    setBusy(true);
    try {
      await request(apiBase, '/registry/observations/' + encodeURIComponent(observation.id) + '/review', {
        reviewer_id: reviewerId.trim(),
        decision,
        ...(decision === 'correct' ? { reviewed_text: correctedText.trim() } : {}),
        ...(decision === 'reject' ? { reason: reason.trim() } : {})
      });
      await onReviewed();
      await loadEvents();
      setAuditOpen(true);
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  return <article className="observation-card">
    <div className="observation-heading"><strong>{observation.functional_domain}</strong><span className={'review-chip ' + observation.review_status}>{observation.review_status}</span></div>
    <div className="observation-comparison"><div className="observation-proposal"><span className="field-heading">Recorded observation</span><p>{observation.observation_text}</p></div><div className="evidence"><strong>Verbatim session evidence</strong><blockquote>{observation.source_excerpt}</blockquote></div></div>
    {observation.review_status !== 'pending' && <p className="muted">Reviewed outcome: {observation.reviewed_text || 'Rejected — do not use as a validated observation.'}</p>}
    {observation.review_status === 'pending' && <div className="review-form">
      <label htmlFor={'decision-' + observation.id}>Professional decision</label>
      <select id={'decision-' + observation.id} value={decision} onChange={e => setDecision(e.target.value as typeof decision)} disabled={busy}>
        <option value="approve">Approve without changes</option>
        <option value="correct">Correct observation</option>
        <option value="reject">Reject observation</option>
      </select>
      {decision === 'correct' && <><label htmlFor={'correction-' + observation.id}>Corrected text</label><textarea id={'correction-' + observation.id} rows={4} value={correctedText} onChange={e => setCorrectedText(e.target.value)} disabled={busy}/></>}
      {decision === 'reject' && <><label htmlFor={'reason-' + observation.id}>Required rejection reason</label><textarea id={'reason-' + observation.id} rows={3} value={reason} onChange={e => setReason(e.target.value)} disabled={busy}/></>}
      <button onClick={() => void submitReview()} disabled={busy || !reviewerId.trim() || (decision === 'correct' && !correctedText.trim()) || (decision === 'reject' && !reason.trim())}>Confirm decision</button>
    </div>}
    <button className="secondary" aria-expanded={auditOpen} disabled={auditBusy} onClick={() => { if (auditOpen) setAuditOpen(false); else { setAuditOpen(true); if (!events) void loadEvents(); } }}>{auditBusy ? 'Loading...' : auditOpen ? 'Hide audit history' : 'View audit history'}</button>
    {auditOpen && events && <div className="audit-log"><h4>Decision history</h4>{events.length ? events.map(event => <div key={event.id} className="audit-event"><strong>{event.decision}</strong> · {new Date(event.created_at).toLocaleString('en-US')}<p className="muted">Synthetic reviewer: {event.reviewer_id}</p>{event.reason && <p>Reason: {event.reason}</p>}{event.reviewed_text && <p>Final text: {event.reviewed_text}</p>}</div>) : <p className="muted">No events recorded.</p>}</div>}
    {error && <p role="alert" className="error">{error}</p>}
  </article>;
}

export default function ReviewWorkspace({ apiBase, sessionId }: Props) {
  const [observations, setObservations] = useState<RegistryObservation[]>([]);
  const [reviewerId, setReviewerId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function refresh() {
    if (!sessionId) return;
    const result = await request<RegistryObservation[]>(apiBase, '/registry/sessions/' + encodeURIComponent(sessionId) + '/observations');
    setObservations(result);
    setLoaded(true);
  }

  useEffect(() => {
    setObservations([]); setLoaded(false); setError('');
    if (!sessionId) return;
    let active = true;
    setLoading(true);
    request<RegistryObservation[]>(apiBase, '/registry/sessions/' + encodeURIComponent(sessionId) + '/observations')
      .then(result => { if (active) { setObservations(result); setLoaded(true); } })
      .catch(e => { if (active) setError(String(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiBase, sessionId]);

  const pending = observations.filter(o => o.review_status === 'pending').length;
  const accepted = observations.filter(o => o.review_status === 'approved' || o.review_status === 'corrected').length;
  const rejected = observations.filter(o => o.review_status === 'rejected').length;
  const sortedObservations = [...observations].sort((a, b) => Number(b.review_status === 'pending') - Number(a.review_status === 'pending'));
  return <section className="panel registry-review">
    <div className="workspace-title"><div><p className="workspace-kicker">REVIEW WORKSPACE · ELO IA LABS</p><h2>Functional observation review</h2></div><span className="workspace-mode">Synthetic data · human review</span></div>
    <p className="muted">Individual, auditable review. The synthetic professional ID is not authentication. Never enter real patient data.</p>
    {!sessionId ? <p className="muted">Select a session from case history to review its observations.</p> : <>
      <label htmlFor="reviewer-id">Registered synthetic professional ID</label>
      <input id="reviewer-id" value={reviewerId} onChange={e => setReviewerId(e.target.value)} placeholder="Professional UUID from /registry/professionals"/>
      <div className="review-summary" aria-label="Resumo da revisão"><span><strong>{observations.length}</strong> observations</span><span className="pending-count"><strong>{pending}</strong> pending</span><span><strong>{accepted}</strong> approved or corrected</span><span><strong>{rejected}</strong> rejected</span></div>
      <button className="secondary" disabled={loading} onClick={() => void refresh().catch(e => setError(String(e)))}>Atualizar observations</button>
      {loading && <p className="muted">Carregando observations...</p>}
      {loaded && !observations.length && <p className="muted">Esta sessão ainda não possui observations cadastradas. O modo mock não gera observations automaticamente.</p>}
      {sortedObservations.map(o => <ObservationCard key={o.id} observation={o} apiBase={apiBase} reviewerId={reviewerId} onReviewed={refresh}/>)}
      {error && <p role="alert" className="error">{error}</p>}
    </>}
  </section>;
}
