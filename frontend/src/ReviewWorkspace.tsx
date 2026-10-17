import React, { useEffect, useState } from 'react';

export type RegistryObservation = {
  id: string;
  session_id: string;
  source_excerpt: string;
  functional_domain: string;
  observation_text: string;
  review_status: 'pending' | 'approved' | 'corrected' | 'rejected';
  reviewed_text?: string | null;
  reviewed_domain?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
};

type ReviewEvent = {
  id: string;
  decision: string;
  previous_status: string;
  previous_text: string;
  previous_domain?: string | null;
  reviewed_domain?: string | null;
  reviewed_text: string | null;
  reason: string | null;
  reviewer_id: string;
  created_at: string;
};

type Props = { apiBase: string; sessionId: string | null; onReviewCompleted?: () => void };

async function request<T>(apiBase: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiBase + path, body === undefined ? { signal } : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
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
  const [correctedDomain, setCorrectedDomain] = useState(observation.functional_domain);
  const [reason, setReason] = useState('');
  const [events, setEvents] = useState<ReviewEvent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [auditBusy, setAuditBusy] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditRevision, setAuditRevision] = useState(0);

  useEffect(() => {
    if (!auditOpen) return;
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    setAuditBusy(true);
    setAuditError('');
    setEvents(null);
    // Bound both fetching headers and reading the response body. A stalled
    // connection must not leave the audit history in a permanent loading state.
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15_000);
    request<ReviewEvent[]>(apiBase, '/registry/observations/' + encodeURIComponent(observation.id) + '/review-events', undefined, controller.signal)
      .then(result => { if (active) setEvents(result); })
      .catch(e => { if (active) setAuditError(timedOut ? 'Audit history timed out. Please retry.' : 'Unable to load audit history: ' + String(e)); })
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) setAuditBusy(false);
      });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [apiBase, observation.id, observation.review_status, observation.reviewed_at, auditOpen, auditRevision]);

  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');
  const textChanged = normalize(correctedText) !== normalize(observation.observation_text);
  const domainChanged = normalize(correctedDomain) !== normalize(observation.functional_domain);
  const correctionError = !normalize(correctedText) ? 'Enter meaningful corrected text.' :
    normalize(correctedDomain).length < 2 ? 'Enter a functional domain.' :
    !textChanged && !domainChanged ? 'Change the text or functional domain, or approve unchanged.' :
    textChanged && (normalize(correctedText).length < 12 || normalize(correctedText).split(' ').length < 3) ? 'Enter meaningful corrected text.' : '';

  async function submitReview() {
    setError('');
    if (!reviewerId.trim()) { setError('Enter a registered synthetic professional ID.'); return; }
    if (decision === 'correct' && correctionError) { setError(correctionError); return; }
    if (decision === 'reject' && !reason.trim()) { setError('Enter a rejection reason.'); return; }
    setBusy(true);
    try {
      await request(apiBase, '/registry/observations/' + encodeURIComponent(observation.id) + '/review', {
        reviewer_id: reviewerId.trim(),
        decision,
        ...(decision === 'correct' ? { reviewed_text: correctedText.trim(), reviewed_domain: correctedDomain.trim() } : {}),
        ...(decision === 'reject' ? { reason: reason.trim() } : {})
      });
      await onReviewed();
      setAuditOpen(true);
      setAuditRevision(value => value + 1);
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  return <article className="observation-card">
    <div className="observation-heading"><strong>{observation.functional_domain}</strong><span className={'review-chip ' + observation.review_status}>{observation.review_status}</span></div>
    <div className="observation-comparison"><div className="observation-proposal"><span className="field-heading">Original observation</span><p>{observation.observation_text}</p></div><div className="evidence"><strong>Verbatim session evidence</strong><blockquote>{observation.source_excerpt}</blockquote></div></div>
    {observation.review_status !== 'pending' && observation.reviewed_domain && observation.reviewed_domain !== observation.functional_domain && <p className="muted">Reviewed domain: {observation.reviewed_domain}</p>}
    {observation.review_status !== 'pending' && <p className="muted">Reviewed result: {observation.reviewed_text || 'Rejected — do not use as a validated observation.'}</p>}
    {observation.review_status === 'pending' && <div className="review-form">
      <label htmlFor={'decision-' + observation.id}>Professional decision</label>
      <select id={'decision-' + observation.id} value={decision} onChange={e => setDecision(e.target.value as typeof decision)} disabled={busy}>
        <option value="approve">Approve unchanged</option>
        <option value="correct">Correct observation</option>
        <option value="reject">Reject observation</option>
      </select>
      {decision === 'correct' && <><label htmlFor={'domain-' + observation.id}>Corrected functional domain</label><input id={'domain-' + observation.id} maxLength={80} value={correctedDomain} onChange={e => setCorrectedDomain(e.target.value)} disabled={busy}/><label htmlFor={'correction-' + observation.id}>Corrected text</label><textarea id={'correction-' + observation.id} rows={4} value={correctedText} onChange={e => setCorrectedText(e.target.value)} disabled={busy}/></>}
      {decision === 'reject' && <><label htmlFor={'reason-' + observation.id}>Required reason</label><textarea id={'reason-' + observation.id} rows={3} value={reason} onChange={e => setReason(e.target.value)} disabled={busy}/></>}
      {decision === 'correct' && correctionError && <p className="muted">{correctionError}</p>}
      <button onClick={() => void submitReview()} disabled={busy || !reviewerId.trim() || (decision === 'correct' && !!correctionError) || (decision === 'reject' && !reason.trim())}>Confirm decision</button>
    </div>}
    <button className="secondary" aria-expanded={auditOpen} onClick={() => setAuditOpen(value => !value)}>{auditOpen ? 'Hide audit history' : 'View audit history'}</button>
    {auditOpen && auditBusy && <p role="status">Loading audit history...</p>}
    {auditOpen && auditError && <div><p role="alert" className="error">{auditError}</p><button className="secondary" onClick={() => setAuditRevision(value => value + 1)}>Retry audit history</button></div>}
    {auditOpen && !auditBusy && events && <div className="audit-log"><h4>Decision history</h4>{events.length ? events.map(event => <div key={event.id} className="audit-event"><strong>{event.decision}</strong> · {new Date(event.created_at).toLocaleString('en-US')}<p className="muted">Synthetic reviewer: {event.reviewer_id}</p>{event.previous_domain && <p>Original domain: {event.previous_domain}</p>}{event.reviewed_domain && <p>Reviewed domain: {event.reviewed_domain}</p>}{event.reason && <p>Reason: {event.reason}</p>}{event.reviewed_text && <p>Final text: {event.reviewed_text}</p>}</div>) : <p className="muted">No audit events recorded.</p>}</div>}
    {error && <p role="alert" className="error">{error}</p>}
  </article>;
}

export default function ReviewWorkspace({ apiBase, sessionId, onReviewCompleted }: Props) {
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
    <p className="muted">Auditable review of individual observations. Professional IDs are synthetic references, not authentication. Never enter real patient data.</p>
    {!sessionId ? <p className="muted">Select a session from case history to review its observations.</p> : <>
      <label htmlFor="reviewer-id">Registered synthetic professional ID</label>
      <input id="reviewer-id" value={reviewerId} onChange={e => setReviewerId(e.target.value)} placeholder="Professional UUID from /registry/professionals"/>
      <div className="review-summary" aria-label="Review summary"><span><strong>{observations.length}</strong> observations</span><span className="pending-count"><strong>{pending}</strong> pending</span><span><strong>{accepted}</strong> approved or corrected</span><span><strong>{rejected}</strong> rejected</span></div>
      <button className="secondary" disabled={loading} onClick={() => void refresh().catch(e => setError(String(e)))}>Refresh observations</button>
      {loading && <p className="muted">Loading observations...</p>}
      {loaded && !observations.length && <p className="muted">This session has no registered observations. Mock mode does not generate observations automatically.</p>}
      {sortedObservations.map(o => <ObservationCard key={o.id} observation={o} apiBase={apiBase} reviewerId={reviewerId} onReviewed={async () => { await refresh(); onReviewCompleted?.(); }}/>)}
      {error && <p role="alert" className="error">{error}</p>}
    </>}
  </section>;
}
