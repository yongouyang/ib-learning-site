import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET, POST } from '@/app/api/feedback/route';

// Route tests run against the REAL provider wiring using env-based config
// (dummy provider + test-mode injection) — no module mocks needed.

const VALID_BODY = {
  stem: 'Work out $347 + 586$.',
  markscheme: ['M1: correct column-addition method', 'A1: 933'],
  modelAnswer: 'Column addition gives 933.',
  studentAnswer: 'I added them in columns and got 933.',
  maxMarks: 2,
};

function post(body: unknown, ip = 'test-ip'): Promise<Response> {
  return POST(
    new Request('http://localhost/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  );
}

let counter = 0;
function uniqueIp(): string {
  counter += 1;
  return `10.0.0.${counter}`;
}

describe('GET /api/feedback', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports unconfigured when no provider env is set', async () => {
    vi.stubEnv('FEEDBACK_PROVIDER', '');
    const res = await GET();
    expect(await res.json()).toEqual({ configured: false });
  });

  it('reports configured with the dummy provider', async () => {
    vi.stubEnv('FEEDBACK_PROVIDER', 'dummy');
    const res = await GET();
    expect(await res.json()).toEqual({ configured: true });
  });
});

describe('POST /api/feedback', () => {
  beforeEach(() => {
    vi.stubEnv('FEEDBACK_PROVIDER', 'dummy');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects an invalid JSON body with 400', async () => {
    const res = await post('not json{', uniqueIp());
    expect(res.status).toBe(400);
  });

  it('rejects schema violations with 400', async () => {
    const noStem = await post({ ...VALID_BODY, stem: '' }, uniqueIp());
    expect(noStem.status).toBe(400);

    const tooLong = await post(
      { ...VALID_BODY, studentAnswer: 'x'.repeat(2001) },
      uniqueIp()
    );
    expect(tooLong.status).toBe(400);
  });

  it('returns 501 when no provider is configured', async () => {
    vi.stubEnv('FEEDBACK_PROVIDER', '');
    const res = await post(VALID_BODY, uniqueIp());
    expect(res.status).toBe(501);
  });

  it('marks with the dummy provider by default (all points awarded)', async () => {
    const res = await post(VALID_BODY, uniqueIp());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.perPoint).toHaveLength(2);
    expect(json.perPoint.every((p: { awarded: boolean }) => p.awarded)).toBe(true);
    expect(json.marks).toBe(2);
    expect(json.feedback).toContain('Dummy marker');
  });

  it('honors _testResponse injection in test mode and recomputes marks', async () => {
    vi.stubEnv('FEEDBACK_TEST_MODE', '1');
    const injected = {
      marks: 99, // must be ignored — marks are recomputed from perPoint
      perPoint: [
        { point: 'M1: correct column-addition method', awarded: true, comment: 'method shown' },
        { point: 'A1: 933', awarded: false, comment: 'arithmetic slip' },
      ],
      feedback: 'Good method, check the final sum.',
    };
    const res = await post({ ...VALID_BODY, _testResponse: injected }, uniqueIp());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.marks).toBe(1); // not 99
    expect(json.perPoint[1].awarded).toBe(false);
    expect(json.perPoint[1].comment).toBe('arithmetic slip');
  });

  it('ignores _testResponse when test mode is off', async () => {
    const res = await post(
      { ...VALID_BODY, _testResponse: { marks: 0, perPoint: [], feedback: 'hack' } },
      uniqueIp()
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.feedback).toContain('Dummy marker'); // fell back to the default
  });

  it('rejects a malformed injection with 400 in test mode', async () => {
    vi.stubEnv('FEEDBACK_TEST_MODE', '1');
    const res = await post(
      { ...VALID_BODY, _testResponse: { marks: 0, perPoint: [], feedback: 'wrong length' } },
      uniqueIp()
    );
    expect(res.status).toBe(400);
  });

  it('rate limits by IP', async () => {
    vi.stubEnv('FEEDBACK_RATE_LIMIT_PER_MIN', '2');
    const ip = uniqueIp();
    expect((await post(VALID_BODY, ip)).status).toBe(200);
    expect((await post(VALID_BODY, ip)).status).toBe(200);
    expect((await post(VALID_BODY, ip)).status).toBe(429);
    // A different IP is unaffected.
    expect((await post(VALID_BODY, uniqueIp())).status).toBe(200);
  });
});
