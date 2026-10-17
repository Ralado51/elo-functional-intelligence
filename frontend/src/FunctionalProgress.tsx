import React, { useEffect, useState } from 'react';
import './functional-progress.css';

type Evidence = {
  observation_id: string; review_status: string; original_domain: string; domain: string;
  original_text: string; reviewed_text: string; source_excerpt: string; reviewer_id: string;
  reviewed_at: string; audit_event_ids: string[]; topics: string[];
};
type Session = {
  id: string; created_at: string; duration_minutes: number; recorded_observations: number;
  unverified_accepted_observations: number; evidence: Evidence[];
};
type Progress = {
  generated_at: string; cases: { id: string }[]; case: { id: string; patient_id: string | null } | null;
  sessions: Session[]; total_sessions: number; limit: number;
};
const topics = [
  ['initiation', 'Task initiation'], ['attention', 'Attention & engagement'],
  ['motor', 'Motor coordination'], ['transitions', 'Transitions'],
  ['assistance', 'Assistance & independence'],
];

export default function FunctionalProgress({ apiBase, onEvidence }: {
  apiBase: string; onEvidence: (sessionId: string, observationId?: string) => void;
}) {
  const [cases, setCases] = useState<{ id: string }[]>([]);
  const [caseId, setCaseId] = useState('');
  const [data, setData] = useState<Progress | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    setData(null); setError(''); setLoading(true);
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 12_000);
    const query = caseId ? '?case_id=' + encodeURIComponent(caseId) : '';
    fetch(apiBase + '/dashboards/functional-progress' + query, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        return response.json() as Promise<Progress>;
      }).then(result => {
        if (!active) return;
        setCases(result.cases);
        if (!caseId && result.cases.length) { setCaseId(result.cases[0].id); return; }
        setData(result);
        setSessionId((result.sessions.find(session => session.evidence.length) || result.sessions[0])?.id || '');
      }).catch(err => { if (active) setError(timedOut ? 'Evidence request timed out. Retry when the API is available.' : String(err)); })
      .finally(() => { window.clearTimeout(timer); if (active) setLoading(false); });
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [apiBase, caseId, revision]);
  const selected = data?.sessions.find(session => session.id === sessionId);

  return <div className="functional-progress">
    <p className="notice"><strong>One-session evidence, not a progress score.</strong> This view describes recorded participation. It does not measure improvement, compare developmental norms, or infer diagnoses. Staff review throughput remains in Operations.</p>
    <label htmlFor="progress-case">Synthetic case</label>
    <select id="progress-case" value={caseId} onChange={event => { setCaseId(event.target.value); setSessionId(''); setData(null); }}>
      {!cases.length && <option value="">No cases available</option>}
      {cases.map(item => <option key={item.id} value={item.id}>{item.id}</option>)}
    </select>
    {loading && <p role="status" className="dashboard-loading">Loading functional evidence…</p>}
    {error && <div role="alert" className="error"><p>Could not load functional evidence. {error}</p><button onClick={() => setRevision(value => value + 1)}>Retry functional evidence</button></div>}
    {data && !data.cases.length && <section className="panel"><h2>No synthetic cases recorded</h2><p>This read-only dashboard does not create records.</p></section>}
    {data?.case && <>
      <section className="panel progress-summary"><div><p className="workspace-kicker">SYNTHETIC PARTICIPATION EVIDENCE</p><h2>Case {data.case.id}</h2><p className="muted">Synthetic patient reference: {data.case.patient_id || 'Not linked; case-level records only'}</p></div>
        <div><strong>{data.sessions.filter(session => session.evidence.length).length}</strong><span>shown sessions with reviewed functional evidence</span><small>Showing {data.sessions.length} of {data.total_sessions} session records (latest {data.limit} maximum).</small></div>
      </section>
      {!data.sessions.length && <section className="panel"><h2>No session records for this case</h2><p>No functional activity or measurements can be reported.</p></section>}
      {!!data.sessions.length && <div className="progress-layout">
        <aside className="panel progress-timeline" aria-label="Session records"><h2>Session records</h2><p className="muted">Record timestamps, not a verified longitudinal activity timeline.</p>{data.sessions.map(session => <button key={session.id} aria-pressed={session.id === sessionId} onClick={() => setSessionId(session.id)}>
          <strong>Recorded {new Date(session.created_at).toLocaleString('en-US')}</strong><span>{session.duration_minutes} minutes · session duration</span><small>{session.evidence.length ? 'Reviewed functional evidence available' : session.recorded_observations ? 'No verified reviewed evidence available' : 'No observations recorded'}</small><small>{session.id}</small>
        </button>)}</aside>
        {selected && <div className="progress-session" key={selected.id}>
          <section className="panel"><p className="workspace-kicker">SELECTED SESSION / NARRATIVE RECORD</p><h2>{selected.duration_minutes}-minute session</h2><p className="muted">Session ID: {selected.id}</p><p>Activities, assistance and quantities are shown only in the wording recorded below. Missing quantities are unavailable; no separate standardized measurements are stored.</p><p className="muted">Approximation, time bounds and independence wording are preserved. Observations from different sessions are never combined into a score.</p></section>
          {!selected.evidence.length && <section className="panel"><h2>{selected.recorded_observations ? 'No verified reviewed functional evidence' : 'No observations recorded for this session'}</h2><p>Activity measurements are unavailable. Pending, rejected or unverified records cannot establish functional participation.</p></section>}
          {!!selected.unverified_accepted_observations && <p className="notice">Some accepted-status records lack matching review/source evidence and are excluded from this view. Inspect their audit and source through the existing workspace.</p>}
          {!!selected.evidence.length && <>
            <div className="progress-topics">{topics.map(([key, title]) => {
              const records = selected.evidence.filter(record => record.topics.includes(key));
              return <section className="panel" key={key}><h2>{title}</h2>{records.length ? records.map(record => <div key={record.observation_id}><blockquote>{record.reviewed_text}</blockquote><a href={'#functional-record-' + record.observation_id}>Source & review reference</a></div>) : <p className="muted">No reviewed account recorded for this topic. Measurement unavailable.</p>}</section>;
            })}</div>
            <section className="panel"><h2>Activities, domains & source references</h2><p className="muted">Activity context remains narrative. Topic grouping is a reading aid, not a clinical classification. Original source wording may differ from a correction; human-reviewed text is shown separately.</p>
              {selected.evidence.map(record => <article className="observation-card" id={'functional-record-' + record.observation_id} key={record.observation_id}>
                <h3>{record.domain}</h3><p><strong>Human-reviewed account:</strong> {record.reviewed_text}</p><div className="evidence"><strong>Verbatim source excerpt</strong><blockquote>{record.source_excerpt}</blockquote></div>
                <p className="muted">Observation {record.observation_id} · {record.review_status}<br/>Reviewer reference: {record.reviewer_id} · {new Date(record.reviewed_at).toLocaleString('en-US')}<br/>Audit event references: {record.audit_event_ids.join(', ')}</p>
                <button className="secondary" onClick={() => onEvidence(selected.id, record.observation_id)}>Trace observation & human decision</button>
              </article>)}
            </section>
          </>}
        </div>}
      </div>}
    </>}
    {data && <div className="snapshot"><span>Read-only synthetic snapshot: {new Date(data.generated_at).toLocaleString('en-US')}</span><button className="secondary" onClick={() => setRevision(value => value + 1)}>Refresh functional evidence</button></div>}
  </div>;
}
