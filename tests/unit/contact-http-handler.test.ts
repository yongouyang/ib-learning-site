import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleRequestOtp, handleVerifyOtp } from '@/lib/auth/http-handler';
import { DummyEmailSender } from '@/lib/auth/dummy';
import type { AuthDeps } from '@/lib/auth/types';
import type { ReportEmailSender } from '@/lib/analytics-report/types';
import { handleContactHealth, handleContactPost } from '@/lib/contact/http-handler';
import { InMemoryContactStorage } from '@/lib/contact/dummy';
import type { ContactDeps } from '@/lib/contact/deps';
import type { ContactMessage } from '@/lib/contact/types';
import { CONTACT_TTL_DAYS } from '@/lib/contact/types';

// Handler-level contact tests (Feature 3): one fresh in-memory universe per
// test; the logged-in tests seed a real session through the auth handlers
// (the same dummy-OTP login flow as analytics-http-handler.test.ts).

const DUMMY_CODE = '123456';
const T0 = Date.parse('2026-08-25T12:00:00.000Z');

let counter = 0;
function uniqueEmail(): string {
  counter += 1;
  return `contact-${counter}@example.com`;
}

class RecordingSender implements ReportEmailSender {
  sent: Array<{ to: string[]; subject: string; html: string; text: string }> = [];
  async send(args: { to: string[]; subject: string; html: string; text: string }): Promise<void> {
    this.sent.push(args);
  }
}

class FailingSender implements ReportEmailSender {
  async send(): Promise<void> {
    throw new Error('resend down');
  }
}

interface TestDeps {
  storage: InMemoryContactStorage;
  authDeps: AuthDeps;
  contactDeps: ContactDeps;
  sender: RecordingSender;
}

function makeDeps(opts: { recipients?: string[]; sender?: ReportEmailSender; clock?: () => number } = {}): TestDeps {
  const clock = opts.clock ?? (() => T0);
  const storage = new InMemoryContactStorage(clock);
  const sender = opts.sender instanceof RecordingSender ? opts.sender : new RecordingSender();
  return {
    storage,
    authDeps: { storage, emailSender: new DummyEmailSender(), testMode: true, dummyMode: true },
    contactDeps: {
      storage,
      sender: opts.sender ?? sender,
      recipients: opts.recipients ?? ['admin@example.com'],
      clock,
    },
    sender,
  };
}

function jsonRequest(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function cookieFrom(res: Response): string {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('No Set-Cookie header');
  return setCookie.split(';')[0].split('=')[1] ?? '';
}

async function login(t: TestDeps, email = uniqueEmail()) {
  await handleRequestOtp(jsonRequest('POST', 'https://x.test/api/auth/request-otp', { email }), t.authDeps);
  const res = await handleVerifyOtp(
    jsonRequest('POST', 'https://octavlearning.com/api/auth/verify-otp', { email, otp: DUMMY_CODE }),
    t.authDeps
  );
  expect(res.status).toBe(200);
  return { cookie: `octav_session=${cookieFrom(res)}`, user: (await res.json()).user };
}

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    subject: 'bug_report',
    message: 'The quiz page crashes on my phone.',
    ...overrides,
  };
}

function post(t: TestDeps, body: unknown, headers: Record<string, string> = {}) {
  return handleContactPost(jsonRequest('POST', 'https://x.test/api/contact', body, headers), t.contactDeps);
}

function storedMessages(storage: InMemoryContactStorage): ContactMessage[] {
  return [...(storage as unknown as { messages: Map<string, ContactMessage> }).messages.values()];
}

describe('POST /api/contact', () => {
  it('accepts a valid message, persists it with server-clock fields, and emails the admins', async () => {
    const t = makeDeps({ recipients: ['admin@example.com', 'second@example.com'] });
    const res = await post(t, envelope(), { 'x-forwarded-for': '1.2.3.4' });

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ success: true });
    // Anonymous submitter: no session cookie is issued.
    expect(res.headers.get('set-cookie')).toBeNull();

    const stored = storedMessages(t.storage);
    expect(stored).toHaveLength(1);
    const msg = stored[0];
    expect(msg.messageId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(msg).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      subject: 'bug_report',
      message: 'The quiz page crashes on my phone.',
      userId: null, // logged out
      status: 'new', // default
      createdAt: '2026-08-25T12:00:00.000Z', // the injected server clock
    });
    // TTL = createdAt + 365 days (epoch seconds).
    expect(msg.expiresAt).toBe(Math.floor(T0 / 1000) + CONTACT_TTL_DAYS * 86_400);

    // The notification went to every admin recipient.
    expect(t.sender.sent).toHaveLength(1);
    expect(t.sender.sent[0].to).toEqual(['admin@example.com', 'second@example.com']);
    expect(t.sender.sent[0].subject).toBe('Octav contact: Bug report from Ada Lovelace');
    expect(t.sender.sent[0].html).toContain('ada@example.com');
    expect(t.sender.sent[0].text).toContain('The quiz page crashes on my phone.');
  });

  it('attributes the message (userId) when a session cookie resolves, and re-issues the refresh cookie', async () => {
    const t = makeDeps();
    const { cookie, user } = await login(t);
    const res = await post(t, envelope(), { cookie, 'x-forwarded-for': '1.2.3.4' });

    expect(res.status).toBe(200);
    expect(storedMessages(t.storage)[0].userId).toBe(user.userId);
    // Sliding session refresh re-issues the cookie.
    expect(res.headers.get('set-cookie')).toContain('Max-Age=');
  });

  it('stores the trimmed, lowercased email and trims name/message', async () => {
    const t = makeDeps();
    const res = await post(t, envelope({ name: '  Ada  ', email: 'ADA@EXAMPLE.COM', message: '  hi  ' }), {
      'x-forwarded-for': '1.2.3.4',
    });
    expect(res.status).toBe(200);
    const msg = storedMessages(t.storage)[0];
    expect(msg.name).toBe('Ada');
    expect(msg.email).toBe('ada@example.com');
    expect(msg.message).toBe('hi');
  });

  it('rejects invalid payloads with 400 + per-field issues, persisting nothing', async () => {
    const cases: Array<{ body: unknown; field: string }> = [
      { body: envelope({ name: '' }), field: 'name' },
      { body: envelope({ name: '   ' }), field: 'name' },
      { body: envelope({ name: 'x'.repeat(101) }), field: 'name' },
      { body: envelope({ email: 'not-an-email' }), field: 'email' },
      { body: envelope({ email: '' }), field: 'email' },
      { body: envelope({ subject: 'praise' }), field: 'subject' },
      { body: envelope({ subject: undefined }), field: 'subject' },
      { body: envelope({ message: '' }), field: 'message' },
      { body: envelope({ message: '   ' }), field: 'message' },
      { body: envelope({ message: 'x'.repeat(2001) }), field: 'message' },
    ];
    for (const { body, field } of cases) {
      const t = makeDeps(); // fresh universe per case (rate-limit isolation)
      const res = await post(t, body);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid request');
      expect(JSON.stringify(json.issues)).toContain(field);
      expect(storedMessages(t.storage)).toHaveLength(0);
      expect(t.sender.sent).toHaveLength(0);
    }
  });

  it('accepts the boundary lengths (name 100, message 2000)', async () => {
    const t = makeDeps();
    const res = await post(t, envelope({ name: 'x'.repeat(100), message: 'y'.repeat(2000) }));
    expect(res.status).toBe(200);
  });

  it('rejects malformed JSON and bodies over the 8KB budget with 400', async () => {
    const t = makeDeps();
    const badJson = await handleContactPost(
      new Request('https://x.test/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }),
      t.contactDeps
    );
    expect(badJson.status).toBe(400);
    expect(await badJson.json()).toEqual({ error: 'Invalid JSON body' });

    const oversized = await handleContactPost(
      new Request('https://x.test/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: `{"pad":"${'x'.repeat(9000)}"}`,
      }),
      t.contactDeps
    );
    expect(oversized.status).toBe(400);
    expect(await oversized.json()).toEqual({ error: 'Invalid request' });
    expect(storedMessages(t.storage)).toHaveLength(0);
  });

  it('enforces the per-IP budget (3/hour): 4th → 429, spoofed XFF uses the LAST entry', async () => {
    const t = makeDeps();
    const headers = { 'x-forwarded-for': '1.2.3.4' };
    for (let i = 0; i < 3; i++) {
      expect((await post(t, envelope(), headers)).status).toBe(200);
    }
    const limited = await post(t, envelope(), headers);
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: 'Too many messages — try again later' });

    // The spoofed prefix is ignored — the LAST XFF entry is the bucket key.
    expect((await post(t, envelope(), { 'x-forwarded-for': 'evil, 1.2.3.4' })).status).toBe(429);
    // A different IP (and the missing-XFF "local" fallback) have own buckets.
    expect((await post(t, envelope(), { 'x-forwarded-for': '5.6.7.8' })).status).toBe(200);
    expect((await post(t, envelope())).status).toBe(200);

    // The 429s persisted nothing.
    expect(storedMessages(t.storage)).toHaveLength(5);
  });

  it('resets the budget when the window rolls', async () => {
    let now = T0;
    const t = makeDeps({ clock: () => now });
    const headers = { 'x-forwarded-for': '1.2.3.4' };
    for (let i = 0; i < 3; i++) {
      expect((await post(t, envelope(), headers)).status).toBe(200);
    }
    expect((await post(t, envelope(), headers)).status).toBe(429);
    now += 3600_000; // next fixed window
    expect((await post(t, envelope(), headers)).status).toBe(200);
  });

  it('HTML-escapes every user-controlled value in the email', async () => {
    const t = makeDeps();
    const res = await post(
      // Deliberate XSS fixture: t is the in-memory test deps (never rendered),
      // and the assertions below verify the email HTML escapes these values.
      t, // nosemgrep: unknown-value-with-script-tag
      envelope({
        name: 'Evil <script>alert(1)</script>',
        message: 'Look: <img src=x onerror=alert(1)> & "quotes" \'apostrophes\'',
      })
    );
    expect(res.status).toBe(200);
    const html = t.sender.sent[0].html;
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&amp; &quot;quotes&quot; &#39;apostrophes&#39;');
    // The stored row keeps the RAW text (escaping is a rendering concern).
    expect(storedMessages(t.storage)[0].name).toBe('Evil <script>alert(1)</script>');
  });

  it('strips CR/LF from the name in the email subject line', async () => {
    const t = makeDeps();
    const res = await post(t, envelope({ name: 'Ada\r\nBcc: victim@example.com' }));
    expect(res.status).toBe(200);
    expect(t.sender.sent[0].subject).toBe('Octav contact: Bug report from Ada Bcc: victim@example.com');
  });

  it('email send failure still returns success (the message is durably stored) and logs the error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const t = makeDeps({ sender: new FailingSender() });
    const res = await post(t, envelope());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(storedMessages(t.storage)).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(String(errorSpy.mock.calls[0][1])).toContain('resend down');
  });

  it('no recipients configured → message stored, email skipped (with a warning)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = makeDeps({ recipients: [] });
    const res = await post(t, envelope());
    expect(res.status).toBe(200);
    expect(storedMessages(t.storage)).toHaveLength(1);
    expect(t.sender.sent).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('a storage failure propagates (the caller/Lambda adapter turns it into a 500)', async () => {
    const t = makeDeps();
    const failing = new Proxy(t.storage, {
      get(target, prop) {
        if (prop === 'saveContactMessage') {
          return async () => {
            throw new Error('AccessDeniedException');
          };
        }
        return Reflect.get(target, prop, target);
      },
    });
    await expect(post({ ...t, contactDeps: { ...t.contactDeps, storage: failing } }, envelope())).rejects.toThrow(
      'AccessDeniedException'
    );
  });
});

describe('GET /api/contact/_health', () => {
  it('returns 200 when the table probe works', async () => {
    const t = makeDeps();
    const res = await handleContactHealth(new Request('https://x.test/api/contact/_health'), t.contactDeps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('returns 500 when the probe fails (missing table/IAM class)', async () => {
    const t = makeDeps();
    const failing = new Proxy(t.storage, {
      get(target, prop) {
        if (prop === 'probeContactTable') {
          return async () => {
            const err = new Error('AccessDeniedException');
            err.name = 'AccessDeniedException';
            throw err;
          };
        }
        return Reflect.get(target, prop, target);
      },
    });
    const res = await handleContactHealth(new Request('https://x.test/api/contact/_health'), {
      ...t.contactDeps,
      storage: failing,
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
