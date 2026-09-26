import { describe, it, expect, vi } from 'vitest';
import { ResendAlertDelivery } from '@/lib/support-bot/delivery/resend-sender';
import type { Alert } from '@/lib/support-bot/types';

// The injected fetch is mocked — assert the Resend API call the delivery
// builds (URL, bearer auth, from/to, the §6.1 subject format, html+text
// bodies). The resend-sender.test.ts (auth OTP) pattern.

function mockFetch(status: number, body = '{}'): ReturnType<typeof vi.fn> {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  }));
}

function alert(overrides: Partial<Alert> = {}): Alert {
  return {
    alertId: 'contact:m1',
    source: 'contact',
    sourceRef: 'm1',
    severity: 'high',
    title: 'Bug report from Ada',
    body: 'User reported bug: the quiz crashed.',
    status: 'open',
    createdAt: '2026-09-26T12:00:00.000Z',
    updatedAt: '2026-09-26T12:00:00.000Z',
    resolvedAt: null,
    dedupKey: 'contact:m1',
    expiresAt: 0,
    ...overrides,
  };
}

describe('ResendAlertDelivery', () => {
  it('sends the alert email with the §6.1 subject format to every recipient', async () => {
    const fetchMock = mockFetch(200, '{"id":"em_123"}');
    const delivery = new ResendAlertDelivery(
      ['admin@example.com', 'boss@example.com'],
      're_test_123',
      'noreply@octavlearning.com',
      fetchMock as unknown as typeof fetch
    );

    await delivery.deliver(alert());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer re_test_123');
    const body = JSON.parse(init.body as string);
    expect(body.from).toBe('Octav Learning <noreply@octavlearning.com>');
    expect(body.to).toEqual(['admin@example.com', 'boss@example.com']);
    expect(body.subject).toBe('[Octav Alert] [HIGH] Bug report from Ada');
    expect(body.html).toContain('Bug report from Ada');
    expect(body.html).toContain('contact:m1');
    expect(body.text).toContain('User reported bug: the quiz crashed.');
  });

  it('uppercases the severity in the subject for every level', async () => {
    const fetchMock = mockFetch(200);
    const delivery = new ResendAlertDelivery(['a@example.com'], 're_key', 'noreply@octavlearning.com', fetchMock as unknown as typeof fetch);
    await delivery.deliver(alert({ severity: 'critical' }));
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.subject).toBe('[Octav Alert] [CRITICAL] Bug report from Ada');
  });

  it('throws with the HTTP status on a non-2xx response (the handler logs + continues)', async () => {
    const fetchMock = mockFetch(500, '{"error":"provider down"}');
    const delivery = new ResendAlertDelivery(['a@example.com'], 're_key', 'noreply@octavlearning.com', fetchMock as unknown as typeof fetch);
    await expect(delivery.deliver(alert())).rejects.toThrow(/HTTP 500/);
  });

  it('never includes the API key in a thrown error', async () => {
    const fetchMock = mockFetch(401, 'unauthorized');
    const delivery = new ResendAlertDelivery(['a@example.com'], 're_secret_123', 'noreply@octavlearning.com', fetchMock as unknown as typeof fetch);
    let message = '';
    try {
      await delivery.deliver(alert());
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    expect(message).toContain('HTTP 401');
    expect(message).not.toContain('re_secret_123');
  });
});
