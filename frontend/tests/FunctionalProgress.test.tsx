import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import FunctionalProgress from '../src/FunctionalProgress';

const account = 'The child maintained attention for approximately eight minutes during the drawing activity.';
const evidence = { observation_id: 'obs-attention', review_status: 'approved', original_domain: 'Attention', domain: 'Attention',
  original_text: account, reviewed_text: account, source_excerpt: account, reviewer_id: 'synthetic-reviewer',
  reviewed_at: '2026-10-17T10:00:00Z', audit_event_ids: ['audit-attention'], topics: ['attention'] };
const measured = { id: 'session-evidence', created_at: '2026-10-17T09:00:00Z', duration_minutes: 40,
  recorded_observations: 1, unverified_accepted_observations: 0, evidence: [evidence] };
const empty = { ...measured, id: 'session-empty', recorded_observations: 0, evidence: [] };
const qualitative = { ...measured, id: 'session-qualitative', evidence: [{ ...evidence, observation_id: 'obs-qualitative',
  original_text: 'Attention was supported with visual cues.', reviewed_text: 'Attention was supported with visual cues.', source_excerpt: 'Attention was supported with visual cues.' }] };
const data = { generated_at: '2026-10-17T12:00:00Z', cases: [{ id: 'SYN-A' }, { id: 'SYN-B' }],
  case: { id: 'SYN-A', patient_id: 'synthetic-patient-A' }, sessions: [measured, empty, qualitative], total_sessions: 3, limit: 50 };
const json = (value: unknown) => Promise.resolve(new Response(JSON.stringify(value), { status: 200 }));
async function flush() { await act(async () => { await Promise.resolve(); }); }
function setup(value = data) {
  const trace = vi.fn();
  const fetchMock = vi.fn(() => json(value));
  vi.stubGlobal('fetch', fetchMock);
  const view = render(<FunctionalProgress apiBase="http://api" onEvidence={trace}/>);
  return { ...view, trace, fetchMock };
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('shows literal approximate participation wording, recorded duration and audit references without a score', async () => {
  const { trace, fetchMock } = setup();
  expect(screen.getByRole('status')).toBeTruthy();
  await flush();
  expect(screen.getAllByText(account).length).toBeGreaterThan(0);
  expect(screen.getByRole('heading', { name: '40-minute session' })).toBeTruthy();
  expect(screen.getByText(/Audit event references: audit-attention/)).toBeTruthy();
  expect(screen.getByText(/One-session evidence, not a progress score/)).toBeTruthy();
  expect(screen.queryByText('70%')).toBeNull();
  expect(screen.queryByText('Review completion')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Trace observation & human decision' }));
  expect(trace).toHaveBeenCalledWith('session-evidence', 'obs-attention');
  expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('/extract'))).toBe(true);
});

it('distinguishes a zero-observation session and does not carry prior measurements into it', async () => {
  setup(); await flush();
  fireEvent.click(screen.getByRole('button', { name: /session-empty/ }));
  expect(screen.getByRole('heading', { name: 'No observations recorded for this session' })).toBeTruthy();
  expect(screen.queryByText(account)).toBeNull();
  expect(screen.getByText(/Activity measurements are unavailable/)).toBeTruthy();
});

it('keeps qualitative records qualitative without inventing absent quantities', async () => {
  setup(); await flush();
  fireEvent.click(screen.getByRole('button', { name: /session-qualitative/ }));
  expect(screen.getAllByText('Attention was supported with visual cues.').length).toBeGreaterThan(0);
  expect(screen.queryByText(account)).toBeNull();
  expect(screen.getAllByText(/Measurement unavailable/).length).toBeGreaterThan(0);
  expect(screen.getByText(/Missing quantities are unavailable/)).toBeTruthy();
});

it('handles no cases and a case without sessions', async () => {
  const view = setup({ ...data, cases: [], case: null, sessions: [], total_sessions: 0 } as unknown as typeof data);
  await flush();
  expect(screen.getByText('No synthetic cases recorded')).toBeTruthy();
  view.fetchMock.mockImplementation(() => json({ ...data, sessions: [], total_sessions: 0 }));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh functional evidence' }));
  await flush();
  expect(screen.getByText('No session records for this case')).toBeTruthy();
});

it('uses the selected case and ignores an old case response arriving after navigation', async () => {
  const { fetchMock } = setup(); await flush();
  let resolveOther!: (value: Response) => void;
  fetchMock.mockImplementation((url: string) => url.includes('case_id=SYN-B') ? new Promise<Response>(resolve => { resolveOther = resolve; }) : json(data));
  fireEvent.change(screen.getByLabelText('Synthetic case'), { target: { value: 'SYN-B' } });
  expect(screen.queryByText(account)).toBeNull();
  fireEvent.change(screen.getByLabelText('Synthetic case'), { target: { value: 'SYN-A' } });
  await flush();
  await act(async () => { resolveOther(new Response(JSON.stringify({ ...data, case: { id: 'SYN-B' }, sessions: [{ ...measured, id: 'other-session' }] }))); });
  expect(screen.getByRole('heading', { name: 'Case SYN-A' })).toBeTruthy();
  expect(screen.queryByText('other-session')).toBeNull();
});

it('shows a source/audit gap instead of treating accepted status as participation evidence', async () => {
  setup({ ...data, sessions: [{ ...measured, evidence: [], unverified_accepted_observations: 1 }] });
  await flush();
  expect(screen.getByRole('heading', { name: 'No verified reviewed functional evidence' })).toBeTruthy();
  expect(screen.getByText(/Some accepted-status records lack matching review/)).toBeTruthy();
  expect(screen.queryByText(account)).toBeNull();
});

it('handles a failed request with a working retry', async () => {
  const fetchMock = vi.fn().mockRejectedValue(new Error('Offline'));
  vi.stubGlobal('fetch', fetchMock);
  render(<FunctionalProgress apiBase="http://api" onEvidence={vi.fn()}/>);
  await flush();
  expect(screen.getByRole('alert').textContent).toContain('Offline');
  fetchMock.mockImplementation(() => json(data));
  fireEvent.click(screen.getByRole('button', { name: 'Retry functional evidence' }));
  await flush();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getAllByText(account).length).toBeGreaterThan(0);
});

it('bounds stalled requests and cancels them on unmount', async () => {
  vi.useFakeTimers();
  let signal: AbortSignal | null | undefined;
  vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => {
    signal = options.signal;
    return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new DOMException('Abort', 'AbortError'))));
  }));
  const view = render(<FunctionalProgress apiBase="http://api" onEvidence={vi.fn()}/>);
  await act(async () => { vi.advanceTimersByTime(12_000); });
  expect(screen.getByRole('alert').textContent).toContain('timed out');
  expect(screen.queryByRole('status')).toBeNull();
  expect(signal?.aborted).toBe(true);
  view.unmount();
});

it('links visual markers to exact reviewed evidence and labels the original illustration', async () => {
  setup(); await flush();
  const overview = screen.getByRole('region', { name: 'Documented activity overview' });
  expect(overview.textContent).toContain(account);
  expect(overview.textContent).toContain('not clinical performance scores');
  expect(overview.querySelector('a')?.getAttribute('href')).toBe('#functional-record-obs-attention');
  expect(screen.getByRole('img', { name: /fictional child/ })).toBeTruthy();
  expect(overview.textContent).toContain('not observed event order');
  expect(overview.textContent).not.toContain('70%');
});

it('selects empty sessions from the evidence matrix without illustrative measurement carryover', async () => {
  setup(); await flush();
  expect(screen.getByRole('region', { name: 'Session evidence comparison' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Explore recorded session 1' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Explore recorded session 2' }));
  expect(screen.queryByRole('region', { name: 'Documented activity overview' })).toBeNull();
  expect(screen.queryByText(account)).toBeNull();
  expect(screen.getByRole('button', { name: 'Explore recorded session 2' }).textContent).toContain('No observations');
});

it('retains corrected negative wording in the visual marker without extracting positive numbers', async () => {
  const negative = 'Did not maintain attention for eight minutes; duration was not measured.';
  setup({ ...data, sessions: [{ ...measured, evidence: [{ ...evidence, review_status: 'corrected', reviewed_text: negative }] }] });
  await flush();
  const overview = screen.getByRole('region', { name: 'Documented activity overview' });
  expect(overview.textContent).toContain(negative);
  expect(overview.textContent).toContain('Reviewed correction');
  expect(overview.textContent).not.toContain('8 minutes');
});
