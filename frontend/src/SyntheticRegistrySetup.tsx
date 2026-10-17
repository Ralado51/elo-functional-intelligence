import React, { useEffect, useRef, useState } from 'react';

type Organization = { id: string; name: string };
type Professional = { id: string; organization_id: string; display_name: string };
type Patient = { id: string; organization_id: string; synthetic_code: string };
type Context = { case_id: string; synthetic_patient_id: string | null };

async function request<T>(apiBase: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel);
  if (signal?.aborted) cancel();
  let timedOut = false;
  const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 15_000);
  try {
    const response = await fetch(apiBase + path, {
      signal: controller.signal,
      ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    return await response.json() as T;
  } catch (error) {
    if (timedOut) throw new Error('Registry request timed out. Refresh before retrying; a registration may already have been saved.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}

export default function SyntheticRegistrySetup({ apiBase, sessionId, onReviewerSelected, onLinked }: {
  apiBase: string;
  sessionId: string;
  onReviewerSelected: (id: string) => void;
  onLinked?: () => void;
}) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [context, setContext] = useState<Context | null>(null);
  const [organizationId, setOrganizationId] = useState('');
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionalId, setProfessionalId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [professionalName, setProfessionalName] = useState('');
  const [patientCode, setPatientCode] = useState('');
  const [syntheticConfirmed, setSyntheticConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    Promise.all([
      request<Organization[]>(apiBase, '/registry/organizations', undefined, controller.signal),
      request<Context>(apiBase, '/registry/sessions/' + encodeURIComponent(sessionId) + '/functional-documentation', undefined, controller.signal),
    ]).then(([orgs, info]) => {
      if (!controller.signal.aborted) { setOrganizations(orgs); setContext(info); }
    }).catch(err => { if (!controller.signal.aborted) setError(String(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [apiBase, sessionId, revision]);

  useEffect(() => {
    if (!organizationId) return;
    const controller = new AbortController();
    setLoadingMembers(true);
    Promise.all([
      request<Professional[]>(apiBase, '/registry/organizations/' + encodeURIComponent(organizationId) + '/professionals', undefined, controller.signal),
      request<Patient[]>(apiBase, '/registry/organizations/' + encodeURIComponent(organizationId) + '/patients', undefined, controller.signal),
    ]).then(([profs, pts]) => {
      if (!controller.signal.aborted) { setProfessionals(profs); setPatients(pts); }
    }).catch(err => { if (!controller.signal.aborted) setError(String(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoadingMembers(false); });
    return () => controller.abort();
  }, [apiBase, organizationId, revision]);

  function chooseOrganization(id: string) {
    setOrganizationId(id); setProfessionalId(''); setPatientId('');
    setProfessionals([]); setPatients([]); setError('');
    onReviewerSelected('');
  }
  const linkedHere = !!context?.synthetic_patient_id && patients.some(patient => patient.id === context.synthetic_patient_id);
  function chooseProfessional(id: string) {
    setProfessionalId(id);
    onReviewerSelected(linkedHere ? id : '');
  }
  async function create<T>(path: string, body: unknown, done: (result: T) => void) {
    setBusy(true); setError('');
    try {
      const result = await request<T>(apiBase, path, body);
      if (active.current) done(result);
    } catch (err) { if (active.current) setError(String(err)); }
    finally { if (active.current) setBusy(false); }
  }
  const disabled = loading || loadingMembers || busy;
  const canCreate = syntheticConfirmed && !disabled && !!context && !error;

  return <section className="synthetic-registry-setup" aria-label="Synthetic review setup">
    <h3>Set up or select a synthetic reviewer</h3>
    <p className="muted">Register an organization, a synthetic professional and a synthetic patient, then explicitly link the patient to this case. Setup never creates observations, runs extraction or approves a decision.</p>
    {loading && <p role="status">Loading synthetic registry…</p>}
    {loadingMembers && <p role="status">Loading registered professionals and patients…</p>}
    {error && <p role="alert" className="error">{error}</p>}
    <button type="button" className="secondary" disabled={busy || loading || loadingMembers} onClick={() => setRevision(value => value + 1)}>Refresh synthetic registry</button>
    {context && <>
      <p>Case: <strong>{context.case_id}</strong> · Linked synthetic patient: <strong>{context.synthetic_patient_id || 'Not linked'}</strong></p>
      {!loading && !organizations.length && <p className="notice">No organizations registered. Register a synthetic organization to begin.</p>}
      <label className="synthetic-confirmation"><input type="checkbox" checked={syntheticConfirmed} onChange={event => setSyntheticConfirmed(event.target.checked)} disabled={busy}/> I confirm that all labels and records entered here are synthetic, with no real patient or professional information.</label>
      <div className="registry-setup-grid">
        <div>
          <label htmlFor="setup-organization">Synthetic organization</label>
          <select id="setup-organization" value={organizationId} disabled={disabled} onChange={event => chooseOrganization(event.target.value)}><option value="">Choose registered organization</option>{organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select>
          <label htmlFor="setup-organization-name">New synthetic organization label</label>
          <input id="setup-organization-name" maxLength={160} value={organizationName} onChange={event => setOrganizationName(event.target.value)} disabled={disabled} placeholder="e.g. Synthetic Demo Organization"/>
          <button type="button" disabled={!canCreate || organizationName.trim().length < 2} onClick={() => void create<Organization>('/registry/organizations', { name: organizationName.trim() }, org => { setOrganizations(items => [org, ...items]); chooseOrganization(org.id); setOrganizationName(''); })}>Register synthetic organization</button>
        </div>
        <div>
          <label htmlFor="setup-professional">Registered synthetic professional</label>
          <select id="setup-professional" value={professionalId} disabled={disabled || !organizationId} onChange={event => chooseProfessional(event.target.value)}><option value="">Choose registered professional</option>{professionals.map(prof => <option key={prof.id} value={prof.id}>{prof.display_name} · {prof.id}</option>)}</select>
          {organizationId && !loadingMembers && !professionals.length && <p className="muted">No professionals registered in this organization.</p>}
          <label htmlFor="setup-professional-name">New synthetic professional label</label>
          <input id="setup-professional-name" maxLength={160} value={professionalName} onChange={event => setProfessionalName(event.target.value)} disabled={disabled || !organizationId} placeholder="e.g. Synthetic Reviewer A"/>
          <button type="button" disabled={!canCreate || !organizationId || professionalName.trim().length < 2} onClick={() => void create<Professional>('/registry/professionals', { organization_id: organizationId, display_name: professionalName.trim() }, prof => { setProfessionals(items => [prof, ...items]); chooseProfessional(prof.id); setProfessionalName(''); })}>Register synthetic professional</button>
        </div>
        <div>
          <label htmlFor="setup-patient">Registered synthetic patient</label>
          <select id="setup-patient" value={patientId} disabled={disabled || !organizationId || !!context.synthetic_patient_id} onChange={event => setPatientId(event.target.value)}><option value="">Choose synthetic patient to link</option>{patients.map(patient => <option key={patient.id} value={patient.id}>{patient.synthetic_code} · {patient.id}</option>)}</select>
          {organizationId && !loadingMembers && !patients.length && <p className="muted">No patients registered in this organization.</p>}
          <label htmlFor="setup-patient-code">New synthetic patient code</label>
          <input id="setup-patient-code" maxLength={80} value={patientCode} onChange={event => setPatientCode(event.target.value)} disabled={disabled || !organizationId || !!context.synthetic_patient_id} placeholder="e.g. SYN-OT-001"/>
          <button type="button" disabled={!canCreate || !organizationId || !!context.synthetic_patient_id || !/^[A-Za-z0-9_-]{2,80}$/.test(patientCode.trim())} onClick={() => void create<Patient>('/registry/patients', { organization_id: organizationId, synthetic_code: patientCode.trim() }, patient => { setPatients(items => [patient, ...items]); setPatientId(patient.id); setPatientCode(''); })}>Register synthetic patient</button>
          <button type="button" className="secondary" disabled={!canCreate || !patientId || !!context.synthetic_patient_id} onClick={() => void create<{ patient_id: string }>('/registry/cases/' + encodeURIComponent(context.case_id) + '/patient', { patient_id: patientId }, linked => { setContext({ ...context, synthetic_patient_id: linked.patient_id }); onReviewerSelected(professionalId); onLinked?.(); })}>Link selected synthetic patient to this case</button>
        </div>
      </div>
      {context.synthetic_patient_id && organizationId && !loadingMembers && !linkedHere && <p className="notice">This case is already linked to a patient in another organization. Select the organization containing the linked patient; this setup will not replace the link.</p>}
      {linkedHere && <p className="status">Patient linkage confirmed in this organization. Select a registered professional above, then confirm each observation decision separately below.</p>}
    </>}
  </section>;
}
