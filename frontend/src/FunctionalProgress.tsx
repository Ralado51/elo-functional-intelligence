import React, { useEffect, useState } from 'react';
import './functional-progress.css';
import ActivityIllustration from './ActivityIllustration';
import { documentedMeasurement } from './documentedMeasurements';

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

function metricFor(session: Session, topic: string) {
  const records = session.evidence.filter(record => record.topics.includes(topic));
  return { record: records[0], metric: records.length === 1 ? documentedMeasurement(topic, records[0].reviewed_text) : null };
}
function revealSource(event: React.MouseEvent, id: string) {
  const record = document.getElementById('functional-record-' + id);
  const details = record?.closest('details');
  if (details) details.open = true;
  if (!record) event.preventDefault();
}
function ParticipationOverview({ session }: { session: Session }) {
  return <section className="participation-overview" aria-label="Documented activity overview">
    <header><div><p className="workspace-kicker">SELECTED SESSION / ACTIVITY SNAPSHOT</p><h2>Participation, in focus</h2></div><span className="evidence-badge">Human-reviewed · synthetic</span></header>
    <div className="activity-stage"><ActivityIllustration/>
      <div className="activity-markers">{topics.slice(0, 4).map(([key, title], index) => {
        const { record, metric } = metricFor(session, key);
        return <section className={'activity-marker marker-' + key} key={key}>
          <span className="marker-index">0{index + 1}</span><h3>{title}</h3>
          {metric ? <><small>{metric.qualifier}</small><strong className="measurement-value">{metric.value}{metric.denominator !== undefined && <span> / {metric.denominator}</span>}</strong><span className="measurement-unit">{metric.label}</span></> : <><strong className="measurement-unavailable">—</strong><span className="measurement-unit">Measurement unavailable</span></>}
          {record && <a href={'#functional-record-' + record.observation_id} onClick={event => revealSource(event, record.observation_id)}>Reviewed {record.review_status === 'corrected' ? 'correction' : 'approval'} ↗</a>}
        </section>;
      })}</div>
    </div><p className="activity-footnote">Documented observations, not clinical performance scores. Illustration is conceptual, not patient imagery. Exact wording and assistance in source details below.</p>
  </section>;
}
function AttemptsOverview({ session }: { session: Session }) {
  const { metric, record } = metricFor(session, 'motor');
  const fraction = metric?.denominator ? metric.value / metric.denominator : null;
  return <section className="attempts-overview" aria-label="Documented independent attempts">
    <h2>Independent attempts</h2><div className="attempts-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="49" fill="none" stroke="#e8efed" strokeWidth="11"/>{fraction !== null && <circle cx="60" cy="60" r="49" fill="none" stroke="#087f80" strokeWidth="11" pathLength="100" strokeDasharray={`${fraction * 100} 100`} transform="rotate(-90 60 60)"/>}</svg><div><strong>{fraction === null ? '—' : metric?.value}<small>{fraction === null ? '' : ' / ' + metric?.denominator}</small></strong><span>{fraction === null ? 'Unavailable' : 'documented'}</span></div></div>
    <p>{fraction === null ? 'No supported reviewed trial count.' : 'Independent attempts / recorded attempts. Remaining attempts have no independence classification here.'}</p>
    {record && <a href={'#functional-record-' + record.observation_id} onClick={event => revealSource(event, record.observation_id)}>Source & human decision ↗</a>}
  </section>;
}
function SessionEvidenceChart({ sessions, selectedId, onSelect }: { sessions: Session[]; selectedId: string; onSelect: (id: string) => void }) {
  const max = Math.max(1, ...sessions.flatMap(session => topics.slice(0, 4).map(([key]) => session.evidence.filter(record => record.topics.includes(key)).length)));
  return <section className="session-evidence-chart" aria-label="Session evidence comparison">
    <div className="chart-heading"><div><h2>Recorded evidence by session</h2><p>Reviewed observation counts · no outcome trend</p></div><span className="chart-unit">0–{max} records / domain</span></div>
    <div className="bar-chart"><div className="bar-axis"><span>{max}</span><span>0</span></div><div className="bar-columns">{sessions.map((session, index) => <button key={session.id} className="chart-session" aria-pressed={session.id === selectedId} aria-label={'Explore recorded session ' + (index + 1)} onClick={() => onSelect(session.id)}>
      <div className="session-bars">{topics.slice(0, 4).map(([key, title]) => {
        const count = session.evidence.filter(record => record.topics.includes(key)).length;
        return <span key={key} className={'progress-bar-track bar-' + key} aria-label={title + ': ' + count + ' reviewed observations'}><span className="bar-fill" style={{ height: (count / max * 100) + '%' }}/>{count > 0 && <small style={{ top: 'auto', bottom: (count / max * 100) + '%' }}>{count}</small>}</span>;
      })}</div><strong>{String(index + 1).padStart(2, '0')}</strong><small>{!session.recorded_observations ? 'No observations' : !session.evidence.length ? 'No reviewed evidence' : 'Reviewed evidence'}</small>
    </button>)}</div></div>
    <div className="chart-legend">{topics.slice(0, 4).map(([key, title]) => <span key={key}><i className={'legend-' + key}/>{title}</span>)}</div>
    <p className="activity-footnote">Newest records first. Empty bars = no reviewed account. Counts describe documentation, not ability or improvement.</p>
  </section>;
}

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
    <p className="notice"><strong>One-session evidence, not a progress score.</strong> Synthetic records · no inferred improvement or diagnosis.</p>
    <label htmlFor="progress-case">Synthetic case</label>
    <select id="progress-case" value={caseId} onChange={event => { setCaseId(event.target.value); setSessionId(''); setData(null); }}>
      {!cases.length && <option value="">No cases available</option>}
      {cases.map(item => <option key={item.id} value={item.id}>{item.id}</option>)}
    </select>
    {loading && <p role="status" className="dashboard-loading">Loading functional evidence…</p>}
    {error && <div role="alert" className="error"><p>Could not load functional evidence. {error}</p><button onClick={() => setRevision(value => value + 1)}>Retry functional evidence</button></div>}
    {data && !data.cases.length && <section className="panel"><h2>No synthetic cases recorded</h2><p>This read-only dashboard does not create records.</p></section>}
    {data?.case && <>
      <section className="progress-summary"><div><h2>Case {data.case.id}</h2><span>{data.sessions.length} of {data.total_sessions} session records · latest {data.limit} maximum</span></div><span>{selected ? selected.duration_minutes + '-minute selected session' : 'No session selected'}</span></section>
      {!data.sessions.length && <section className="panel"><h2>No session records for this case</h2><p>No functional activity or measurements can be reported.</p></section>}
      {!!data.sessions.length && <div className="analytics-strip">{selected && <AttemptsOverview session={selected}/>}<SessionEvidenceChart sessions={data.sessions} selectedId={sessionId} onSelect={setSessionId}/></div>}
      {!!selected?.evidence.length && <ParticipationOverview session={selected}/>}
      <details className="evidence-details" open={!selected?.evidence.length}><summary>Source observations & human decisions <span>Exact reviewed text · excerpts · reviewer & audit references</span></summary>
      <p className="muted">Synthetic patient reference: {data.case.patient_id || 'Not linked; case-level records only'} · {data.sessions.filter(session => session.evidence.length).length} shown sessions with reviewed functional evidence</p>
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
      </details>
    </>}
    {data && <div className="snapshot"><span>Read-only synthetic snapshot: {new Date(data.generated_at).toLocaleString('en-US')}</span><button className="secondary" onClick={() => setRevision(value => value + 1)}>Refresh functional evidence</button></div>}
  </div>;
}
