import React, { useEffect, useState } from 'react';

type ReviewedObservation = {
  observation_id: string;
  original_domain: string;
  final_domain: string;
  original_text: string;
  final_text: string;
  source_excerpt: string;
  review_status: 'approved' | 'corrected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  audit_event_ids: string[];
};

type DocumentationPreview = {
  document_type: 'synthetic_functional_documentation_preview';
  is_final_record: false;
  session_id: string;
  case_id: string;
  synthetic_patient_id: string | null;
  session_status: string;
  duration_minutes: number;
  counts: { total: number; accepted: number; pending: number; rejected: number };
  eligible_for_consolidation: boolean;
  blockers: string[];
  reviewed_observations: ReviewedObservation[];
  disclaimer: string;
};

type Props = { apiBase: string; sessionId: string | null; revision: number };

export default function FunctionalDocumentationPreview({ apiBase, sessionId, revision }: Props) {
  const [preview, setPreview] = useState<DocumentationPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPreview(null);
    setError('');
    if (!sessionId) return;
    const controller = new AbortController();
    setLoading(true);
    fetch(apiBase + '/registry/sessions/' + encodeURIComponent(sessionId) + '/functional-documentation', { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + await response.text());
        return response.json() as Promise<DocumentationPreview>;
      })
      .then(result => { if (!controller.signal.aborted) setPreview(result); })
      .catch(err => { if (!controller.signal.aborted) setError(String(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [apiBase, sessionId, revision]);

  return <section className="panel functional-documentation">
    <h2>05 / Functional documentation preview</h2>
    <p className="muted">Read-only synthetic evidence summary. This is not a signed clinical report or a final record.</p>
    {!sessionId && <p className="muted">Select a session to view its functional documentation.</p>}
    {loading && <p role="status">Loading documentation preview...</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {preview && <>
      <div className="status">Case: <strong>{preview.case_id}</strong> · Session: <strong>{preview.session_status}</strong> · {preview.duration_minutes} minutes</div>
      <p className="muted">Session ID: {preview.session_id}</p>
      <div className="review-summary" aria-label="Documentation summary">
        <span><strong>{preview.counts.total}</strong> total</span>
        <span><strong>{preview.counts.accepted}</strong> accepted</span>
        <span className="pending-count"><strong>{preview.counts.pending}</strong> pending</span>
        <span><strong>{preview.counts.rejected}</strong> rejected</span>
      </div>
      <div className="notice" role="status">
        <strong>{preview.eligible_for_consolidation ? 'Eligible for consolidation — preview only' : 'Consolidation blocked'}</strong>
        {preview.blockers.length > 0 && <ul>{preview.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul>}
      </div>
      <h3>Human-reviewed observations</h3>
      {preview.reviewed_observations.length === 0 && <p className="muted">No approved or corrected observations yet.</p>}
      {preview.reviewed_observations.map(item => <article className="observation-card" key={item.observation_id}>
        <div className="observation-heading"><strong>{item.final_domain}</strong><span className={'review-chip ' + item.review_status}>{item.review_status}</span></div>
        <p><strong>Final reviewed observation</strong></p>
        <p>{item.final_text}</p>
        <div className="observation-comparison">
          <div className="observation-proposal"><span className="field-heading">Original AI observation · {item.original_domain}</span><p>{item.original_text}</p></div>
          <div className="evidence"><strong>Verbatim session evidence</strong><blockquote>{item.source_excerpt}</blockquote></div>
        </div>
        <p className="muted">Synthetic reviewer: {item.reviewed_by ?? 'Not recorded'} · Reviewed: {item.reviewed_at ? new Date(item.reviewed_at).toLocaleString('en-US') : 'Not recorded'}</p>
        <details><summary>Audit event references ({item.audit_event_ids.length})</summary>
          {item.audit_event_ids.length ? <ul>{item.audit_event_ids.map(id => <li key={id}><code>{id}</code></li>)}</ul> : <p className="muted">No audit event references.</p>}
        </details>
      </article>)}
      <p className="muted">{preview.disclaimer}</p>
    </>}
  </section>;
}
