import React from 'react';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import FunctionalDocumentationPreview from '../src/FunctionalDocumentationPreview';
import FunctionalConsolidatedDraft from '../src/FunctionalConsolidatedDraft';

const accepted = {
  document_type: 'synthetic_functional_documentation_preview', is_final_record: false,
  session_id: 'session-approved', case_id: 'SYN-CASE', synthetic_patient_id: 'synthetic-patient',
  session_status: 'approved', duration_minutes: 40,
  counts: { total: 2, accepted: 1, rejected: 1, pending: 0 },
  eligible_for_consolidation: true, blockers: [],
  reviewed_observations: [{ observation_id: 'obs-1', original_domain: 'Motor Skills', final_domain: 'Transitions',
    original_text: 'Original synthetic observation.', final_text: 'Reviewed synthetic observation with prompts.',
    source_excerpt: 'three verbal prompts', review_status: 'corrected', reviewed_by: 'synthetic-reviewer',
    reviewed_at: '2026-10-17T10:00:00Z', audit_event_ids: ['audit-1'] }],
  disclaimer: 'Synthetic data only. Not a clinical report or signed record.',
};
const json = (data: unknown) => Promise.resolve(new Response(JSON.stringify(data), { status: 200 }));
async function flush() { await act(async () => { await Promise.resolve(); }); }
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('shows the same reviewed source/domain/audit trace in preview and consolidated draft for an approved session', async () => {
  vi.stubGlobal('fetch', vi.fn(() => json(accepted)));
  render(<><FunctionalDocumentationPreview apiBase="http://api" sessionId="session-approved" revision={0}/><FunctionalConsolidatedDraft apiBase="http://api" sessionId="session-approved" revision={0}/></>);
  await flush();
  expect(screen.getByText('SYNTHETIC DRAFT — NOT A CLINICAL RECORD')).toBeTruthy();
  expect(screen.getAllByText('Reviewed synthetic observation with prompts.')).toHaveLength(2);
  expect(screen.getAllByText('three verbal prompts')).toHaveLength(2);
  const draft = screen.getByRole('region', { name: 'Synthetic consolidated functional draft' });
  expect(within(draft).getByText('audit-1')).toBeTruthy();
  expect(within(draft).getByText('Transitions', { exact: false })).toBeTruthy();
  expect(screen.queryByText(/Original AI observation/)).toBeNull();
});

it.each(['pending', 'unlinked'])('keeps consolidation blocked for %s records', async reason => {
  vi.stubGlobal('fetch', vi.fn(() => json({ ...accepted, eligible_for_consolidation: false,
    synthetic_patient_id: reason === 'unlinked' ? null : accepted.synthetic_patient_id,
    counts: { ...accepted.counts, pending: reason === 'pending' ? 1 : 0 },
    blockers: [reason === 'pending' ? '1 observations still require human review' : 'Case is not linked to a synthetic patient'] })));
  render(<FunctionalConsolidatedDraft apiBase="http://api" sessionId="session-approved" revision={0}/>);
  await flush();
  expect(screen.getByText('Consolidation blocked')).toBeTruthy();
  expect(screen.queryByText('SYNTHETIC DRAFT — NOT A CLINICAL RECORD')).toBeNull();
});

it('refetches eligibility when human-review completion changes the revision', async () => {
  const fetchMock = vi.fn().mockImplementationOnce(() => json({ ...accepted, eligible_for_consolidation: false,
    counts: { ...accepted.counts, pending: 1 }, blockers: ['Pending observation'] }))
    .mockImplementation(() => json(accepted));
  vi.stubGlobal('fetch', fetchMock);
  const view = render(<FunctionalConsolidatedDraft apiBase="http://api" sessionId="session-approved" revision={0}/>);
  await flush();
  expect(screen.getByText('Consolidation blocked')).toBeTruthy();
  view.rerender(<FunctionalConsolidatedDraft apiBase="http://api" sessionId="session-approved" revision={1}/>);
  await flush();
  expect(screen.getByText('SYNTHETIC DRAFT — NOT A CLINICAL RECORD')).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('cancels preview loading when the selected session is cleared', async () => {
  let signal: AbortSignal | null | undefined;
  vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => { signal = init.signal; return new Promise(() => {}); }));
  const view = render(<FunctionalDocumentationPreview apiBase="http://api" sessionId="session-approved" revision={0}/>);
  expect(screen.getByRole('status')).toBeTruthy();
  view.rerender(<FunctionalDocumentationPreview apiBase="http://api" sessionId={null} revision={0}/>);
  expect(signal?.aborted).toBe(true);
  expect(screen.queryByRole('status')).toBeNull();
});
