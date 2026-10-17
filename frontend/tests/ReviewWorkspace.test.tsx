import React, { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReviewWorkspace, { type RegistryObservation } from '../src/ReviewWorkspace';

const observation = {
  id: 'observation-1', session_id: 'session-1',
  source_excerpt: 'Completed activity with verbal support.',
  functional_domain: 'Motor Skills', observation_text: 'Completed activity with verbal support.',
  review_status: 'pending' as const,
};
const event = {
  id: 'event-1', decision: 'correct', reviewer_id: 'reviewer-1',
  created_at: '2026-10-16T12:00:00Z', previous_text: observation.observation_text,
  previous_domain: 'Motor Skills', reviewed_domain: 'Participation',
  reviewed_text: observation.observation_text, reason: null,
};

const response = (data: unknown) => new Response(JSON.stringify(data), {
  status: 200, headers: { 'Content-Type': 'application/json' },
});

async function flush() {
  await act(async () => { await Promise.resolve(); });
}

function setup(audit: (options?: RequestInit) => Promise<Response>, items: RegistryObservation[] = [observation]) {
  const onReviewCompleted = vi.fn();
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url.endsWith('/registry/organizations')) return Promise.resolve(response([]));
    if (url.endsWith('/functional-documentation')) return Promise.resolve(response({ case_id: 'SYN-CASE', synthetic_patient_id: null }));
    if (url.endsWith('/review-events')) return audit(options);
    if (url.endsWith('/review')) {
      items = items.map(item => ({ ...item, review_status: 'corrected' }));
      return Promise.resolve(response({}));
    }
    return Promise.resolve(response(items));
  });
  vi.stubGlobal('fetch', fetchMock);
  const view = render(<StrictMode><ReviewWorkspace apiBase="http://api" sessionId="session-1" onReviewCompleted={onReviewCompleted}/></StrictMode>);
  return { ...view, fetchMock, onReviewCompleted };
}

function openAudit() {
  fireEvent.click(screen.getByRole('button', { name: 'View audit history' }));
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('audit history request lifecycle', () => {
  it.each(['headers', 'body'])('recovers from a stalled response %s and permits retry', async stage => {
    vi.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    const audit = vi.fn((options?: RequestInit) => {
      signal = options?.signal;
      const stalled = new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
      return stage === 'headers' ? stalled : Promise.resolve({
        ok: true, json: () => stalled,
      } as unknown as Response);
    });
    setup(audit);
    await flush();
    openAudit();
    await flush();
    await act(async () => { vi.advanceTimersByTime(15_000); });
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByText('Loading audit history...')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('timed out');
    audit.mockImplementation(() => Promise.resolve(response([event])));
    fireEvent.click(screen.getByRole('button', { name: 'Retry audit history' }));
    await flush();
    expect(screen.getByText('Reviewed domain: Participation')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each(['network', 'HTTP', 'JSON'])('clears loading and allows retry after a %s error', async failure => {
    const audit = vi.fn(() => failure === 'network' ? Promise.reject(new Error('Network unavailable')) :
      Promise.resolve(new Response(failure === 'JSON' ? 'invalid JSON' : 'Service unavailable', { status: failure === 'HTTP' ? 503 : 200 })));
    setup(audit);
    await flush();
    openAudit();
    await flush();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Loading audit history...')).toBeNull();
    audit.mockImplementation(() => Promise.resolve(response([])));
    fireEvent.click(screen.getByRole('button', { name: 'Retry audit history' }));
    await flush();
    expect(screen.getByText('No audit events recorded.')).toBeTruthy();
  });

  it('cancels on close, ignores a late result and reloads on reopen', async () => {
    let signal: AbortSignal | null | undefined;
    let resolve!: (value: Response) => void;
    const audit = vi.fn((options?: RequestInit) => {
      signal = options?.signal;
      return new Promise<Response>(done => { resolve = done; });
    });
    setup(audit);
    await flush();
    openAudit();
    fireEvent.click(screen.getByRole('button', { name: 'Hide audit history' }));
    expect(signal?.aborted).toBe(true);
    await act(async () => { resolve(response([event])); });
    expect(screen.queryByText('Decision history')).toBeNull();
    audit.mockImplementation(() => Promise.resolve(response([])));
    openAudit();
    await flush();
    expect(screen.getByText('No audit events recorded.')).toBeTruthy();
  });

  it('cancels the old audit request when the session is deselected', async () => {
    let signal: AbortSignal | null | undefined;
    const view = setup(options => {
      signal = options?.signal;
      return new Promise<Response>(() => {});
    });
    await flush();
    openAudit();
    view.rerender(<ReviewWorkspace apiBase="http://api" sessionId={null}/>);
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByText('Loading audit history...')).toBeNull();
  });

  it('refreshes previously empty audit history after a review and notifies the documentation preview', async () => {
    const audit = vi.fn().mockResolvedValueOnce(response([])).mockImplementation(() => Promise.resolve(response([event])));
    const { onReviewCompleted } = setup(audit);
    await flush();
    openAudit();
    await flush();
    expect(screen.getByText('No audit events recorded.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Registered synthetic professional ID'), { target: { value: 'reviewer-1' } });
    fireEvent.change(screen.getByLabelText('Professional decision'), { target: { value: 'correct' } });
    fireEvent.change(screen.getByLabelText('Corrected functional domain'), { target: { value: 'Participation' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm decision' }));
    await flush();
    expect(onReviewCompleted).toHaveBeenCalledOnce();
    expect(screen.getByText('Reviewed domain: Participation')).toBeTruthy();
  });
});

describe('correction integrity', () => {
  it('explains an unknown professional without bypassing validation or reporting a successful review', async () => {
    const { fetchMock, onReviewCompleted } = setup(() => Promise.resolve(response([])));
    await flush();
    const normal = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url, options) => url.endsWith('/review') ? Promise.resolve(new Response(JSON.stringify({ detail: 'Professional not found' }), { status: 404 })) : normal(url, options));
    fireEvent.change(screen.getByLabelText('Registered synthetic professional ID'), { target: { value: 'invented-id' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm decision' }));
    await flush();
    expect(screen.getByRole('alert').textContent).toContain('Register or select a persisted synthetic professional');
    expect(onReviewCompleted).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Professional decision')).toBeTruthy();
  });
  it('disables identical and whitespace-only corrections, preserving text-only and domain-only edits', async () => {
    setup(() => Promise.resolve(response([])));
    await flush();
    fireEvent.change(screen.getByLabelText('Registered synthetic professional ID'), { target: { value: 'reviewer-1' } });
    fireEvent.change(screen.getByLabelText('Professional decision'), { target: { value: 'correct' } });
    const confirm = screen.getByRole('button', { name: 'Confirm decision' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(screen.getByText(/Change the text or functional domain/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Corrected text'), { target: { value: '  Completed\n activity   with verbal support. ' } });
    fireEvent.change(screen.getByLabelText('Corrected functional domain'), { target: { value: '  Motor   Skills ' } });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Corrected functional domain'), { target: { value: 'Participation' } });
    expect(confirm.disabled).toBe(false);
    fireEvent.change(screen.getByLabelText('Corrected functional domain'), { target: { value: 'Motor Skills' } });
    fireEvent.change(screen.getByLabelText('Corrected text'), { target: { value: 'Completed activity with minimal verbal support.' } });
    expect(confirm.disabled).toBe(false);
  });

  it('allows a domain-only correction when the unchanged original text is short', async () => {
    setup(() => Promise.resolve(response([])), [{ ...observation, observation_text: 'Task done.' }]);
    await flush();
    fireEvent.change(screen.getByLabelText('Registered synthetic professional ID'), { target: { value: 'reviewer-1' } });
    fireEvent.change(screen.getByLabelText('Professional decision'), { target: { value: 'correct' } });
    fireEvent.change(screen.getByLabelText('Corrected functional domain'), { target: { value: 'Participation' } });
    expect((screen.getByRole('button', { name: 'Confirm decision' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
