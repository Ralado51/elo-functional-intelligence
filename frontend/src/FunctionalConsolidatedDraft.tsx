import React, { useEffect, useState } from 'react';

type Observation = {
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

type Preview = {
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
  reviewed_observations: Observation[];
  disclaimer: string;
};

type Props = { apiBase: string; sessionId: string | null; revision: number };

export default function FunctionalConsolidatedDraft({ apiBase, sessionId, revision }: Props) {
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    if (!sessionId) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    fetch(apiBase + '/registry/sessions/' + encodeURIComponent(sessionId) + '/functional-documentation', { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + await response.text());
        return response.json() as Promise<Preview>;
      })
      .then(result => {
        if (controller.signal.aborted) return;
        if (result.session_id !== sessionId || result.document_type !== 'synthetic_functional_documentation_preview' || result.is_final_record !== false) {
          throw new Error('Unexpected documentation response');
        }
        setData(result);
      })
      .catch(err => { if (!controller.signal.aborted) setError(String(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [apiBase, sessionId, revision]);

  const eligible = data?.eligible_for_consolidation === true && data.synthetic_patient_id !== null &&
    data.counts.pending === 0 && data.counts.accepted > 0 &&
    data.reviewed_observations.length === data.counts.accepted && data.blockers.length === 0;

  return <section className="panel functional-consolidated-draft" aria-label="Synthetic consolidated functional draft">
    <h2>06 / Consolidated functional draft</h2>
    <p className="muted">Deterministic assembly of human-reviewed evidence. No new AI inference or clinical interpretation.</p>
    {!sessionId && <p className="muted">Select a synthetic session to inspect consolidation eligibility.</p>}
    {loading && <p role="status">Loading consolidation eligibility...</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {data && !eligible && <div className="notice" role="status">
      <strong>Consolidation blocked</strong>
      <p>Draft generation is unavailable until all eligibility requirements are met.</p>
      <ul>{data.blockers.length ? data.blockers.map(item => <li key={item}>{item}</li>) : <li>Documentation integrity checks did not pass.</li>}</ul>
    </div>}
    {data && eligible && <article className="consolidated-document">
      <div className="notice"><strong>SYNTHETIC DRAFT — NOT A CLINICAL RECORD</strong></div>
      <h3>Functional session documentation</h3>
      <p><strong>Case:</strong> {data.case_id} · <strong>Session:</strong> {data.session_id}</p>
      <p><strong>Synthetic patient reference:</strong> {data.synthetic_patient_id}</p>
      <p><strong>Duration:</strong> {data.duration_minutes} minutes · <strong>Session status:</strong> {data.session_status}</p>
      <p><strong>Review summary:</strong> {data.counts.accepted} accepted, {data.counts.rejected} rejected, {data.counts.pending} pending, {data.counts.total} total.</p>
      <h3>Human-reviewed functional observations</h3>
      {data.reviewed_observations.map((item, index) => <section className="observation-card" key={item.observation_id}>
        <h4>{index + 1}. {item.final_domain}</h4>
        <p>{item.final_text}</p>
        <details>
          <summary>Evidence and review traceability</summary>
          <p><strong>Original domain:</strong> {item.original_domain}</p>
          <p><strong>Original observation:</strong> {item.original_text}</p>
          <p><strong>Verbatim source evidence:</strong> {item.source_excerpt}</p>
          <p><strong>Decision:</strong> {item.review_status} · <strong>Synthetic reviewer:</strong> {item.reviewed_by ?? 'Not recorded'}</p>
          <p><strong>Reviewed at:</strong> {item.reviewed_at ?? 'Not recorded'}</p>
          <p><strong>Observation ID:</strong> <code>{item.observation_id}</code></p>
          <p><strong>Audit event IDs:</strong></p>
          {item.audit_event_ids.length ? <ul>{item.audit_event_ids.map(id => <li key={id}><code>{id}</code></li>)}</ul> : <p>None recorded.</p>}
        </details>
      </section>)}
      <h3>Scope and limitations</h3>
      <p>{data.disclaimer}</p>
      <p>This synthetic evidence draft is not a diagnosis, treatment plan, progress assessment, signed report or finalized clinical record. No clinical conclusions have been generated.</p>
    </article>}
  </section>;
}
