import React, { useEffect, useState } from 'react';
import './dashboards.css';
import FunctionalProgress from './FunctionalProgress';

export type Page = 'operations' | 'progress' | 'functional' | 'governance' | 'workspace';
const pages: [Page, string][] = [['operations', 'Operations'], ['progress', 'Functional progress'], ['functional', 'Functional intelligence'], ['governance', 'AI governance'], ['workspace', 'Session workspace']];
type Counts = Record<string, number>;
type Meta = { generated_at: string; scope: string };
type Operations = Meta & { total_cases: number; total_sessions: number; total_observations: number; reviewed_observations: number; session_statuses: Counts; observation_statuses: Counts; review_completion_percent: number | null };
type SessionSummary = { id: string; case_id: string; created_at: string; status: string; total_observations: number; pending: number; approved: number; corrected: number; rejected: number };
type Functional = Meta & { cases: string[]; domains: { domain: string; count: number }[]; sessions: SessionSummary[]; total_sessions: number; session_limit: number; interpretation: string };
type AuditEvent = { id: string; observation_id: string; session_id: string; case_id: string; decision: string; reviewer_id: string; created_at: string; reason: string | null; previous_text: string; reviewed_text: string | null; previous_domain: string | null; reviewed_domain: string | null };
type Observation = { id: string; session_id: string; case_id?: string; functional_domain: string; reviewed_domain: string | null; observation_text: string; reviewed_text: string | null; source_excerpt: string; review_status: string; reviewed_by: string | null; reviewed_at: string | null; verbatim_match?: boolean; events?: AuditEvent[] };
type Governance = Meta & { decisions: Counts; total_decisions: number; decision_percentages: Record<string, number | null>; rate_denominator: string; provenance: { total_observations: number; verbatim_matches: number; unmatched: number }; events: AuditEvent[]; event_limit: number; health: { api: string; database: string; persistence: string; configured_inference_mode: string; effective_inference_mode: string; provider_connectivity: string; historical_inference_provenance: string }; telemetry: { reason: string } };

function useData<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    setData(null); setError(''); setLoading(true);
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 12_000);
    fetch(url, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        return response.json() as Promise<T>;
      })
      .then(result => { if (active) setData(result); })
      .catch(err => { if (active) setError(timedOut ? 'The request timed out. Please retry.' : String(err)); })
      .finally(() => { window.clearTimeout(timer); if (active) setLoading(false); });
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [url, revision]);
  return { data, error, loading, refresh: () => setRevision(value => value + 1) };
}

const date = (value: string) => new Date(value).toLocaleString('en-US');
const pct = (value: number | null) => value === null ? 'Unavailable' : `${value}%`;
const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function DashboardNavigation({ page, onChange }: { page: Page; onChange: (page: Page) => void }) {
  return <nav className="dashboard-nav" aria-label="Application navigation">{pages.map(([key, text]) => <button key={key} aria-current={page === key ? 'page' : undefined} onClick={() => onChange(key)}>{text}</button>)}</nav>;
}

function DataState({ loading, error, refresh }: { loading: boolean; error: string; refresh: () => void }) {
  return <>{loading && <p className="dashboard-loading" role="status">Loading persisted records…</p>}{error && <div className="error" role="alert"><p>Could not load dashboard data. {error}</p><button onClick={refresh}>Retry</button></div>}</>;
}

function Metric({ title, value, note }: { title: string; value: React.ReactNode; note: string }) {
  return <article className="metric"><p>{title}</p><strong>{value}</strong><small>{note}</small></article>;
}

function Bars({ counts, title, onSelect }: { counts: Counts; title: string; onSelect?: (key: string) => void }) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return <div className="dashboard-bars" aria-label={title}>{Object.entries(counts).map(([key, count]) => <div className={'bar-row status-' + key} key={key}>
    <div>{onSelect ? <button className="text-button" onClick={() => onSelect(key)}>{label(key)}</button> : <span>{label(key)}</span>}<strong>{count}</strong></div>
    <div className="bar-track" aria-hidden="true"><span style={{ width: `${total ? count / total * 100 : 0}%` }}/></div>
  </div>)}</div>;
}

function OperationsView({ apiBase }: { apiBase: string }) {
  const state = useData<Operations>(apiBase + '/dashboards/operations');
  const { data } = state;
  const completion = data?.review_completion_percent;
  return <><DataState {...state}/>{data && <>
    <div className="metrics-grid"><Metric title="Cases" value={data.total_cases} note="Persisted synthetic cases"/><Metric title="Sessions" value={data.total_sessions} note="All session statuses"/><Metric title="Observations" value={data.total_observations} note="Pending and human-reviewed"/><Metric title="Review completion" value={pct(data.review_completion_percent)} note={`${data.reviewed_observations} of ${data.total_observations} observations reviewed`}/></div>
    {data.total_sessions === 0 && <p className="notice">No sessions yet. Create a synthetic session in the Session workspace to begin.</p>}
    <div className="dashboard-columns"><section className="panel"><h2>Session distribution</h2><Bars counts={data.session_statuses} title="Session status counts"/><p className="muted">Session approval is separate from individual observation review.</p></section>
      <section className="panel"><h2>Observation review queue</h2><Bars counts={data.observation_statuses} title="Observation status counts"/></section></div>
    <section className="panel completion-panel"><svg viewBox="0 0 120 120" role="img" aria-label={`Review completion: ${pct(completion ?? null)}`}><circle cx="60" cy="60" r="48" className="ring-track"/><circle cx="60" cy="60" r="48" className="ring-value" pathLength="100" strokeDasharray={`${completion ?? 0} 100`} transform="rotate(-90 60 60)"/><text x="60" y="65" textAnchor="middle">{completion == null ? '—' : `${completion}%`}</text></svg><div><h2>Human review, made visible</h2><p>Completion includes approved, corrected and rejected observations. Pending records remain outside the reviewed total.</p><p className="muted">No observations means no rate—not a measured 0%.</p></div></section>
    <Snapshot meta={data} refresh={state.refresh}/>
  </>}</>;
}

function Snapshot({ meta, refresh }: { meta: Meta; refresh: () => void }) {
  return <div className="snapshot"><span>Snapshot: {date(meta.generated_at)} · {meta.scope}</span><button className="secondary" onClick={refresh}>Refresh dashboard</button></div>;
}

function EvidencePanel({ apiBase, sessionId, observationId, onClose, onOpenSession }: { apiBase: string; sessionId: string; observationId?: string; onClose: () => void; onOpenSession: (id: string) => void }) {
  const state = useData<{ session: { id: string; case_id: string }; observations: Observation[] }>(apiBase + '/dashboards/sessions/' + encodeURIComponent(sessionId) + '/evidence');
  useEffect(() => {
    if (state.data) document.getElementById(observationId ? 'evidence-' + observationId : 'dashboard-evidence')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [state.data, observationId]);
  return <section id="dashboard-evidence" className="panel evidence-panel" aria-label="Evidence drill-down"><div className="dashboard-section-heading"><div><p className="workspace-kicker">FROM COUNT TO SOURCE</p><h2>Evidence & human decisions</h2></div><button className="secondary" onClick={onClose}>Close evidence</button></div>
    <DataState {...state}/>{state.data && <><p>Case <strong>{state.data.session.case_id}</strong> · Session <code>{sessionId}</code></p><button className="secondary" onClick={() => onOpenSession(sessionId)}>Open session workspace</button>
      {!state.data.observations.length && <p>No observations recorded for this session.</p>}
      {state.data.observations.map(observation => <article className={'observation-card ' + (observation.id === observationId ? 'highlighted-evidence' : '')} key={observation.id} id={'evidence-' + observation.id}>
        <div className="observation-heading"><strong>{observation.reviewed_domain || observation.functional_domain}</strong><span className={'review-chip ' + observation.review_status}>{observation.review_status}</span></div>
        <p className="muted">Observation ID: {observation.id}</p><p><strong>{['approved', 'corrected'].includes(observation.review_status) ? 'Human-reviewed text' : 'Unaccepted observation'}</strong></p><p>{observation.reviewed_text || observation.observation_text}</p>
        <div className="observation-comparison"><div className="observation-proposal"><span className="field-heading">Original · {observation.functional_domain}</span><p>{observation.observation_text}</p></div><div className="evidence"><strong>Verbatim source excerpt</strong><blockquote>{observation.source_excerpt}</blockquote><p className="muted">{observation.verbatim_match ? 'Exact match in persisted session notes' : 'Evidence mismatch — investigate before use'}</p></div></div>
        <h3>Human decision trail</h3>{!observation.events?.length && <p className="muted">No persisted review event. Pending or legacy records are not proof of human approval.</p>}
        {observation.events?.map(event => <div className="audit-event" key={event.id}><strong>{label(event.decision)}</strong> · {date(event.created_at)}<p>Synthetic reviewer: {event.reviewer_id}</p><p>Original domain: {event.previous_domain || 'Unavailable'} → Reviewed domain: {event.reviewed_domain || 'None'}</p><p>Previous text: {event.previous_text}</p>{event.reviewed_text && <p>Reviewed text: {event.reviewed_text}</p>}{event.reason && <p>Reason: {event.reason}</p>}<small>Audit event: {event.id}</small></div>)}
      </article>)}
    </>}</section>;
}

function ReviewedList({ apiBase, caseId, domain, onEvidence }: { apiBase: string; caseId: string; domain: string; onEvidence: (sessionId: string, observationId?: string) => void }) {
  const params = new URLSearchParams();
  if (caseId) params.set('case_id', caseId);
  if (domain) params.set('domain', domain);
  const state = useData<{ observations: Observation[]; total: number; limit: number }>(apiBase + '/dashboards/reviewed-observations?' + params);
  return <section className="panel"><h2>Reviewed observations{domain ? ` · ${domain}` : ''}</h2><DataState {...state}/>{state.data && <>
    <p className="muted">Showing {state.data.observations.length} of {state.data.total} accepted observations (latest {state.data.limit} maximum). Select a record to inspect its source and decisions.</p>
    {!state.data.observations.length && <p>No approved or corrected observations in this selection.</p>}
    {state.data.observations.map(item => <button className="observation-link" key={item.id} onClick={() => onEvidence(item.session_id, item.id)}><span className="review-chip">{item.review_status}</span><strong>{item.reviewed_domain || item.functional_domain}</strong><span>{item.reviewed_text || item.observation_text}</span><small>Case {item.case_id} · Observation {item.id} → View evidence</small></button>)}
  </>}</section>;
}

function FunctionalView({ apiBase, onEvidence }: { apiBase: string; onEvidence: (sessionId: string, observationId?: string) => void }) {
  const [caseId, setCaseId] = useState('');
  const [domain, setDomain] = useState('');
  const state = useData<Functional>(apiBase + '/dashboards/functional' + (caseId ? '?case_id=' + encodeURIComponent(caseId) : ''));
  const { data } = state;
  return <><label htmlFor="dashboard-case">Compare synthetic case</label><input className="dashboard-case-input" id="dashboard-case" list="dashboard-cases" value={caseId} onChange={event => { setCaseId(event.target.value); setDomain(''); }} placeholder="All cases"/><datalist id="dashboard-cases">{data?.cases.map(id => <option key={id} value={id}/>)}</datalist><DataState {...state}/>{data && <>
    <p className="notice">{data.interpretation}</p><div className="dashboard-columns"><section className="panel"><h2>Reviewed functional domains</h2><p className="muted">Approved + corrected observations only. Corrected domain takes precedence. Select a domain to drill down.</p>{data.domains.length ? <Bars counts={Object.fromEntries(data.domains.map(item => [item.domain, item.count]))} title="Reviewed observations by domain" onSelect={setDomain}/> : <p>No reviewed observations yet.</p>}{domain && <button className="secondary" onClick={() => setDomain('')}>Show all domains</button>}</section>
    <section className="panel"><h2>A descriptive lens</h2><p className="dashboard-quote">Evidence first.<br/>Human decisions always.</p><p>Compare recorded sessions within a case. Counts describe documentation and review activity, not ability, improvement or diagnosis.</p><p className="muted">Cross-case totals are administrative summaries. No standardized assessment scores or clinical outcomes are computed.</p></section></div>
    <section className="panel"><h2>Session-by-session comparison</h2><p className="muted">Showing {data.sessions.length} of {data.total_sessions} sessions (latest {data.session_limit} maximum). Newest first; dates can include multiple sessions on the same day.</p><div className="table-scroll"><table><caption>Persisted session observation counts</caption><thead><tr><th>Case / session</th><th>Recorded</th><th>Session status</th><th>Pending</th><th>Approved</th><th>Corrected</th><th>Rejected</th><th>Trace</th></tr></thead><tbody>{data.sessions.map(session => <tr key={session.id}><td>{session.case_id}<small>{session.id}</small></td><td>{date(session.created_at)}</td><td>{session.status}</td><td>{session.pending}</td><td>{session.approved}</td><td>{session.corrected}</td><td>{session.rejected}</td><td><button className="text-button" onClick={() => onEvidence(session.id)}>Inspect evidence</button></td></tr>)}</tbody></table></div>{!data.sessions.length && <p>No sessions in this selection.</p>}</section>
    <ReviewedList apiBase={apiBase} caseId={caseId} domain={domain} onEvidence={onEvidence}/><Snapshot meta={data} refresh={state.refresh}/>
  </>}</>;
}

function GovernanceView({ apiBase, onEvidence }: { apiBase: string; onEvidence: (sessionId: string, observationId?: string) => void }) {
  const state = useData<Governance>(apiBase + '/dashboards/governance');
  const { data } = state;
  return <><DataState {...state}/>{data && <>
    <div className="metrics-grid"><Metric title="Human approval" value={pct(data.decision_percentages.approve)} note={`${data.decisions.approve} unchanged approvals`}/><Metric title="Human correction" value={pct(data.decision_percentages.correct)} note={`${data.decisions.correct} corrections`}/><Metric title="Human rejection" value={pct(data.decision_percentages.reject)} note={`${data.decisions.reject} rejections`}/><Metric title="Evidence matches" value={`${data.provenance.verbatim_matches} / ${data.provenance.total_observations}`} note={`${data.provenance.unmatched} unmatched excerpts`}/></div>
    <p className="muted">Rate denominator: {data.total_decisions} {data.rate_denominator}. These rates are review activity, not model accuracy.</p>
    <div className="dashboard-columns"><section className="panel"><h2>Operational health</h2><dl className="health-grid"><dt>API</dt><dd>{data.health.api}</dd><dt>Database</dt><dd>{data.health.database} · {data.health.persistence}</dd><dt>Configured inference</dt><dd>{data.health.configured_inference_mode}</dd><dt>Effective mode</dt><dd>{data.health.effective_inference_mode === 'amd' ? 'AMD Token Factory configured' : 'Mock'}</dd><dt>AMD provider connectivity</dt><dd>{data.health.provider_connectivity}</dd><dt>Historical model attribution</dt><dd>{data.health.historical_inference_provenance}</dd></dl><p className="muted">Current configuration does not prove a past AMD call occurred. This dashboard makes no provider calls.</p></section>
    <section className="panel"><h2>Inference telemetry</h2><div className="telemetry"><div><span>Latency</span><strong>Unavailable</strong></div><div><span>Tokens</span><strong>Unavailable</strong></div><div><span>Cost</span><strong>Unavailable</strong></div></div><p className="muted">{data.telemetry.reason}</p></section></div>
    <section className="panel"><h2>Human decision trail</h2><p className="muted">Showing {data.events.length} of {data.total_decisions} audit events (latest {data.event_limit} maximum). Synthetic reviewer IDs are references, not authenticated identities.</p>{!data.events.length && <p>No human decisions recorded yet.</p>}{data.events.map(event => <div className="governance-event" key={event.id}><div><span className={'review-chip ' + event.decision}>{label(event.decision)}</span><strong>{event.case_id}</strong><small>{date(event.created_at)} · Reviewer {event.reviewer_id}</small></div><button className="text-button" onClick={() => onEvidence(event.session_id, event.observation_id)}>Trace decision & evidence →</button></div>)}</section>
    <Snapshot meta={data} refresh={state.refresh}/>
  </>}</>;
}

export default function Dashboards({ page, apiBase, onOpenSession }: { page: Exclude<Page, 'workspace'>; apiBase: string; onOpenSession: (id: string) => void }) {
  const [evidence, setEvidence] = useState<{ sessionId: string; observationId?: string } | null>(null);
  const onEvidence = (sessionId: string, observationId?: string) => setEvidence({ sessionId, observationId });
  const titles = { operations: ['Operations dashboard', 'A clear view of the review queue.'], progress: ['Functional progress', 'What the person did, in the words recorded.'], functional: ['Functional intelligence', 'Follow each observation back to its evidence.'], governance: ['AI governance', 'Accountability at every human decision.'] };
  return <div className="dashboard"><section className="dashboard-hero"><p className="eyebrow">ELO INTELLIGENCE / SYNTHETIC RESEARCH DATA</p><h1>{titles[page][0]}</h1><p>{titles[page][1]}</p><span className="workspace-mode">Read-only analytics · persisted application records</span></section>
    {page === 'operations' && <OperationsView apiBase={apiBase}/>} {page === 'functional' && <FunctionalView apiBase={apiBase} onEvidence={onEvidence}/>} {page === 'governance' && <GovernanceView apiBase={apiBase} onEvidence={onEvidence}/>}
    {page === 'progress' && <FunctionalProgress apiBase={apiBase} onEvidence={onEvidence}/>}
    {evidence && <EvidencePanel key={evidence.sessionId + evidence.observationId} apiBase={apiBase} {...evidence} onClose={() => setEvidence(null)} onOpenSession={onOpenSession}/>}
    <p className="dashboard-disclaimer">Synthetic data only. Descriptive research prototype. No diagnosis, clinical progress inference, automatic approval or signed clinical report.</p>
  </div>;
}
