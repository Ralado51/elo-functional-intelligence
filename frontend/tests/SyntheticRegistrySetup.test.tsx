import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import SyntheticRegistrySetup from '../src/SyntheticRegistrySetup';

const organization = { id: 'org-1', name: 'Synthetic Org' };
const professional = { id: 'professional-1', organization_id: 'org-1', display_name: 'Synthetic Reviewer' };
const patient = { id: 'patient-1', organization_id: 'org-1', synthetic_code: 'SYN-OT-001' };
const json = (data: unknown) => Promise.resolve(new Response(JSON.stringify(data), { status: 200 }));
async function flush() { await act(async () => { await Promise.resolve(); }); }
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

function setup(existing = false, linked = false) {
  const selected = vi.fn();
  const onLinked = vi.fn();
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (options?.method === 'POST') {
      if (url.endsWith('/organizations')) return json(organization);
      if (url.endsWith('/professionals')) return json(professional);
      if (url.endsWith('/patients')) return json(patient);
      if (url.endsWith('/patient')) return json({ case_id: 'OT-001', patient_id: patient.id });
    }
    if (url.endsWith('/functional-documentation')) return json({ case_id: 'OT-001', synthetic_patient_id: linked ? patient.id : null });
    if (url.endsWith('/organizations')) return json(existing ? [organization] : []);
    if (url.endsWith('/professionals')) return json(existing ? [professional] : []);
    if (url.endsWith('/patients')) return json(existing ? [patient] : []);
    throw new Error('Unexpected endpoint: ' + url);
  });
  vi.stubGlobal('fetch', fetchMock);
  const view = render(<SyntheticRegistrySetup apiBase="http://api" sessionId="session-1" onReviewerSelected={selected} onLinked={onLinked}/>);
  return { ...view, selected, onLinked, fetchMock };
}

it('loads an empty registry without automatically creating data', async () => {
  const { fetchMock } = setup();
  expect(screen.getByRole('status').textContent).toContain('Loading');
  await flush();
  expect(screen.getByText(/No organizations registered/)).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Register synthetic organization' }) as HTMLButtonElement).disabled).toBe(true);
  expect(fetchMock.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true);
});

it('requires explicit synthetic confirmation and separate organization/professional/patient/link actions', async () => {
  const { selected, onLinked, fetchMock } = setup();
  await flush();
  fireEvent.change(screen.getByLabelText('New synthetic organization label'), { target: { value: 'Synthetic Org' } });
  const createOrg = screen.getByRole('button', { name: 'Register synthetic organization' }) as HTMLButtonElement;
  expect(createOrg.disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(createOrg);
  await flush();
  fireEvent.change(screen.getByLabelText('New synthetic professional label'), { target: { value: 'Synthetic Reviewer' } });
  fireEvent.click(screen.getByRole('button', { name: 'Register synthetic professional' }));
  await flush();
  // Merely registering a professional must not claim the case is ready.
  expect(selected).not.toHaveBeenCalledWith(professional.id);
  fireEvent.change(screen.getByLabelText('New synthetic patient code'), { target: { value: 'SYN-OT-001' } });
  fireEvent.click(screen.getByRole('button', { name: 'Register synthetic patient' }));
  await flush();
  expect(selected).not.toHaveBeenCalledWith(professional.id);
  fireEvent.click(screen.getByRole('button', { name: 'Link selected synthetic patient to this case' }));
  await flush();
  expect(selected).toHaveBeenLastCalledWith(professional.id);
  expect(onLinked).toHaveBeenCalledOnce();
  expect(screen.getByText(/Patient linkage confirmed/)).toBeTruthy();
  const posts = fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST');
  expect(posts.map(([url]) => url.replace('http://api', ''))).toEqual(['/registry/organizations', '/registry/professionals', '/registry/patients', '/registry/cases/OT-001/patient']);
  expect(JSON.parse(posts[1][1]!.body as string)).toEqual({ organization_id: organization.id, display_name: 'Synthetic Reviewer' });
  expect(JSON.parse(posts[3][1]!.body as string)).toEqual({ patient_id: patient.id });
});

it('selects persisted professional/patient records and links without duplicate registrations', async () => {
  const { selected, fetchMock } = setup(true);
  await flush();
  fireEvent.change(screen.getByLabelText('Synthetic organization'), { target: { value: organization.id } });
  await flush();
  fireEvent.change(screen.getByLabelText('Registered synthetic professional'), { target: { value: professional.id } });
  fireEvent.change(screen.getByLabelText('Registered synthetic patient'), { target: { value: patient.id } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Link selected synthetic patient to this case' }));
  await flush();
  expect(selected).toHaveBeenLastCalledWith(professional.id);
  expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
});

it('does not replace an existing case link and can select its registered reviewer without writes', async () => {
  const { selected, fetchMock } = setup(true, true);
  await flush();
  fireEvent.change(screen.getByLabelText('Synthetic organization'), { target: { value: organization.id } });
  await flush();
  fireEvent.change(screen.getByLabelText('Registered synthetic professional'), { target: { value: professional.id } });
  expect(selected).toHaveBeenLastCalledWith(professional.id);
  expect((screen.getByRole('button', { name: 'Link selected synthetic patient to this case' }) as HTMLButtonElement).disabled).toBe(true);
  expect(fetchMock.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true);
});

it('shows request failure and can refresh the registry', async () => {
  const { fetchMock } = setup();
  await flush();
  const normal = fetchMock.getMockImplementation()!;
  fetchMock.mockRejectedValue(new Error('Offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh synthetic registry' }));
  await flush();
  expect(screen.getByRole('alert').textContent).toContain('Offline');
  fetchMock.mockImplementation(normal);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh synthetic registry' }));
  await flush();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('retains server linkage conflicts instead of marking setup complete or bypassing checks', async () => {
  const { selected, fetchMock, onLinked } = setup(true);
  await flush();
  const normal = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation((url, options) => options?.method === 'POST' ? Promise.resolve(new Response(JSON.stringify({ detail: 'Case already linked to another patient' }), { status: 409 })) : normal(url, options));
  fireEvent.change(screen.getByLabelText('Synthetic organization'), { target: { value: organization.id } });
  await flush();
  fireEvent.change(screen.getByLabelText('Registered synthetic professional'), { target: { value: professional.id } });
  fireEvent.change(screen.getByLabelText('Registered synthetic patient'), { target: { value: patient.id } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Link selected synthetic patient to this case' }));
  await flush();
  expect(screen.getByRole('alert').textContent).toContain('Case already linked');
  expect(onLinked).not.toHaveBeenCalled();
  expect(selected).not.toHaveBeenCalledWith(professional.id);
});

it('times out stalled reads and cancels on unmount', async () => {
  vi.useFakeTimers();
  let signal: AbortSignal | null | undefined;
  vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => {
    signal = options.signal;
    return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
  }));
  const view = render(<SyntheticRegistrySetup apiBase="http://api" sessionId="session-1" onReviewerSelected={vi.fn()}/>);
  await act(async () => { vi.advanceTimersByTime(15_000); });
  expect(screen.getByRole('alert').textContent).toContain('timed out');
  expect(signal?.aborted).toBe(true);
  expect(screen.queryByRole('status')).toBeNull();
  view.unmount();
});
