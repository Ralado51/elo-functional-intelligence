import React, { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Dashboards, { DashboardNavigation } from '../src/Dashboards';

const meta = { generated_at: '2026-10-17T12:00:00Z', scope: 'all persisted synthetic application records' };
const operations = { ...meta, total_cases: 2, total_sessions: 6, total_observations: 24, reviewed_observations: 12, review_completion_percent: 50,
  session_statuses: { draft: 2, pending: 2, approved: 2 }, observation_statuses: { pending: 12, approved: 4, corrected: 4, rejected: 4 } };
const observation = { id: 'obs-1', session_id: 'session-1', case_id: 'SYN-A', functional_domain: 'Motor Skills', reviewed_domain: 'Transitions', observation_text: 'Original synthetic task observation.', reviewed_text: 'Joined the task after three prompts.', source_excerpt: 'joined the task', review_status: 'corrected', reviewed_by: 'reviewer-1', reviewed_at: meta.generated_at, verbatim_match: true };
const event = { id: 'event-1', observation_id: 'obs-1', session_id: 'session-1', case_id: 'SYN-A', decision: 'correct', reviewer_id: 'reviewer-1', created_at: meta.generated_at, previous_text: observation.observation_text, reviewed_text: observation.reviewed_text, previous_domain: 'Motor Skills', reviewed_domain: 'Transitions', reason: null };
const functional = { ...meta, cases: ['SYN-A'], domains: [{ domain: 'Transitions', count: 1 }], total_sessions: 1, session_limit: 100, interpretation: 'Descriptive counts only. Differences do not establish clinical progress, diagnoses or treatment effectiveness.', sessions: [{ id: 'session-1', case_id: 'SYN-A', created_at: meta.generated_at, status: 'pending', total_observations: 1, pending: 0, approved: 0, corrected: 1, rejected: 0 }] };
const governance = { ...meta, decisions: { approve: 1, correct: 1, reject: 1 }, total_decisions: 3, decision_percentages: { approve: 33.3, correct: 33.3, reject: 33.3 }, rate_denominator: 'persisted human observation-review audit events; pending observations excluded', provenance: { total_observations: 1, verbatim_matches: 1, unmatched: 0 }, events: [event], event_limit: 30, health: { api: 'responding', database: 'query succeeded', persistence: 'sqlite', configured_inference_mode: 'amd', effective_inference_mode: 'amd', provider_connectivity: 'unverified', historical_inference_provenance: 'unavailable' }, telemetry: { latency_ms: null, tokens: null, cost: null, reason: 'Unavailable: inference latency, token usage and cost are not persisted.' } };
const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });
async function flush() { await act(async () => { await Promise.resolve(); }); }
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('provides clear navigation for all three dashboards and the existing workspace', () => {
  const change = vi.fn();
  render(<DashboardNavigation page="operations" onChange={change}/>);
  const nav = screen.getByRole('navigation', { name: 'Application navigation' });
  expect(within(nav).getAllByRole('button')).toHaveLength(5);
  fireEvent.click(screen.getByRole('button', { name: 'Functional progress' }));
  expect(change).toHaveBeenCalledWith('progress');
  expect(screen.getByRole('button', { name: 'Operations' }).getAttribute('aria-current')).toBe('page');
  fireEvent.click(screen.getByRole('button', { name: 'Functional intelligence' }));
  expect(change).toHaveBeenCalledWith('functional');
  fireEvent.click(screen.getByRole('button', { name: 'AI governance' }));
  expect(change).toHaveBeenCalledWith('governance');
  fireEvent.click(screen.getByRole('button', { name: 'Session workspace' }));
  expect(change).toHaveBeenCalledWith('workspace');
});

it('renders persisted counts, completion and labeled SVG without chart dependencies', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(json(operations))));
  render(<StrictMode><Dashboards page="operations" apiBase="http://api" onOpenSession={vi.fn()}/></StrictMode>);
  expect(screen.getByRole('status').textContent).toContain('Loading');
  await flush();
  expect(screen.getByText('24')).toBeTruthy();
  expect(screen.getByText('12 of 24 observations reviewed')).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Review completion: 50%' })).toBeTruthy();
  expect(screen.getByText(/Session approval is separate/)).toBeTruthy();
});

it('shows an empty state and unavailable rate rather than fabricating zero-percent performance', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(json({ ...operations, total_sessions: 0, review_completion_percent: null }))));
  render(<Dashboards page="operations" apiBase="http://api" onOpenSession={vi.fn()}/>);
  await flush();
  expect(screen.getByText(/No sessions yet/)).toBeTruthy();
  expect(screen.getByText('Unavailable')).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Review completion: Unavailable' })).toBeTruthy();
});

it.each(['HTTP', 'network', 'JSON'])('shows a %s error with a working retry', async failure => {
  const fetchMock = vi.fn().mockImplementation(() => failure === 'network' ? Promise.reject(new Error('Offline')) : Promise.resolve(new Response(failure === 'JSON' ? 'bad json' : 'Database unavailable', { status: failure === 'HTTP' ? 503 : 200 })));
  vi.stubGlobal('fetch', fetchMock);
  render(<Dashboards page="operations" apiBase="http://api" onOpenSession={vi.fn()}/>);
  await flush();
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.queryByRole('status')).toBeNull();
  fetchMock.mockImplementation(() => Promise.resolve(json(operations)));
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await flush();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByText('12 of 24 observations reviewed')).toBeTruthy();
});

it('aborts a stalled request, exits loading and allows retry', async () => {
  vi.useFakeTimers();
  let signal: AbortSignal | null | undefined;
  vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => {
    signal = options.signal;
    return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
  }));
  render(<Dashboards page="operations" apiBase="http://api" onOpenSession={vi.fn()}/>);
  await act(async () => { vi.advanceTimersByTime(12_000); });
  expect(signal?.aborted).toBe(true);
  expect(screen.getByRole('alert').textContent).toContain('timed out');
  expect(screen.queryByRole('status')).toBeNull();
});

it('cancels requests on unmount and ignores late responses', async () => {
  let signal: AbortSignal | null | undefined;
  let resolve!: (data: Response) => void;
  vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => { signal = options.signal; return new Promise(done => { resolve = done; }); }));
  const view = render(<Dashboards page="operations" apiBase="http://api" onOpenSession={vi.fn()}/>);
  view.unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => { resolve(json(operations)); });
  expect(screen.queryByText('24')).toBeNull();
});

it('filters reviewed domains and drills down to persisted evidence, audit IDs and the session workspace', async () => {
  const fetchMock = vi.fn((url: string) => {
    if (url.includes('/reviewed-observations')) return Promise.resolve(json({ observations: [observation], total: 1, limit: 100 }));
    if (url.includes('/evidence')) return Promise.resolve(json({ session: { id: 'session-1', case_id: 'SYN-A' }, observations: [{ ...observation, events: [event] }] }));
    return Promise.resolve(json(functional));
  });
  vi.stubGlobal('fetch', fetchMock);
  const open = vi.fn();
  render(<Dashboards page="functional" apiBase="http://api" onOpenSession={open}/>);
  await flush();
  expect(screen.getByText(/do not establish clinical progress/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Transitions' }));
  await flush();
  expect(fetchMock.mock.calls.some(([url]) => url.includes('domain=Transitions'))).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /View evidence/ }));
  await flush();
  const evidence = screen.getByRole('region', { name: 'Evidence drill-down' });
  expect(within(evidence).getByText('joined the task')).toBeTruthy();
  expect(within(evidence).getByText(/Exact match in persisted session notes/)).toBeTruthy();
  expect(within(evidence).getByText(/Audit event: event-1/)).toBeTruthy();
  expect(within(evidence).getByText(/Previous text: Original synthetic/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Open session workspace' }));
  expect(open).toHaveBeenCalledWith('session-1');
  fireEvent.click(screen.getByRole('button', { name: 'Close evidence' }));
  expect(screen.queryByRole('region', { name: 'Evidence drill-down' })).toBeNull();
});

it('shows functional empty states for a case with no reviewed observations', async () => {
  vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(json(url.includes('/reviewed-observations') ? { observations: [], total: 0, limit: 100 } : { ...functional, domains: [], sessions: [], total_sessions: 0 }))));
  render(<Dashboards page="functional" apiBase="http://api" onOpenSession={vi.fn()}/>);
  await flush();
  expect(screen.getByText('No reviewed observations yet.')).toBeTruthy();
  expect(screen.getByText('No sessions in this selection.')).toBeTruthy();
  expect(screen.getByText('No approved or corrected observations in this selection.')).toBeTruthy();
});

it('reports audit-based rates and unavailable telemetry without claiming AMD connectivity', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(json(governance))));
  render(<Dashboards page="governance" apiBase="http://api" onOpenSession={vi.fn()}/>);
  await flush();
  expect(screen.getAllByText('33.3%')).toHaveLength(3);
  expect(screen.getAllByText('Unavailable')).toHaveLength(3);
  expect(screen.getByText('unverified')).toBeTruthy();
  expect(screen.getByText('AMD Token Factory configured')).toBeTruthy();
  expect(screen.getByText(/pending observations excluded/)).toBeTruthy();
  expect(screen.getByText(/not model accuracy/)).toBeTruthy();
  expect(screen.getByRole('button', { name: /Trace decision & evidence/ })).toBeTruthy();
});
