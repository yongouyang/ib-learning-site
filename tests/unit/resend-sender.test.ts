import { describe, it, expect, vi } from 'vitest';
import { ResendEmailSender } from '@/lib/auth/resend-sender';

// The injected fetch is mocked — assert the Resend API call the sender builds
// (URL, bearer auth, from/to/subject, branded HTML/text bodies with the code).

function mockFetch(status: number, body = '{}'): ReturnType<typeof vi.fn> {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  }));
}

describe('ResendEmailSender', () => {
  it('sends the OTP email with branded HTML and plain-text bodies', async () => {
    const fetchMock = mockFetch(200, '{"id":"em_123"}');
    const sender = new ResendEmailSender(
      're_test_123',
      'noreply@octavlearning.com',
      fetchMock as unknown as typeof fetch
    );

    await sender.sendOtpEmail({ to: 'student@example.com', code: '654321', expiresInMinutes: 10 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer re_test_123');
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body as string);
    expect(body.from).toBe('Octav Learning <noreply@octavlearning.com>');
    expect(body.to).toEqual(['student@example.com']);
    expect(body.subject).toContain('sign-in code');
    expect(body.html).toContain('654321');
    expect(body.html).toContain('OCTAV LEARNING');
    expect(body.html).toContain('expires in 10 minutes');
    expect(body.text).toContain('654321');
  });

  it('throws with the HTTP status on a non-2xx response', async () => {
    const fetchMock = mockFetch(401, '{"error":"unauthorized"}');
    const sender = new ResendEmailSender(
      're_test_123',
      'noreply@octavlearning.com',
      fetchMock as unknown as typeof fetch
    );
    await expect(
      sender.sendOtpEmail({ to: 'a@example.com', code: '123456', expiresInMinutes: 10 })
    ).rejects.toThrow(/HTTP 401/);
  });

  it('never includes the API key in a thrown error', async () => {
    const fetchMock = mockFetch(500, 'boom');
    const sender = new ResendEmailSender(
      're_secret_123',
      'noreply@octavlearning.com',
      fetchMock as unknown as typeof fetch
    );
    let message = '';
    try {
      await sender.sendOtpEmail({ to: 'a@example.com', code: '123456', expiresInMinutes: 10 });
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    expect(message).toContain('HTTP 500');
    expect(message).not.toContain('re_secret_123');
  });
});
