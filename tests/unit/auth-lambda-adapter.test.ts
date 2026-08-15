import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  handler,
  toLambdaResult,
  setCloudFrontIpChecker,
  parseCidr,
  inCidr,
  ensureCloudFrontIpCheckerLoaded,
  resolveForwardedFor,
  __resetCloudFrontRangeLoader,
  __getCloudFrontIpChecker,
} from '../../lambda/auth/index';

// Adapter tests (review M4 + rounds 2/3): the Lambda's Function URL event
// shape → shared handler. These cover the paths the handler tests can't —
// routing, method guards, body forwarding, cookie passthrough, controlled
// 500s, the topology-aware XFF discrimination, the cookies-array Set-Cookie
// conversion, and the CloudFront-range CIDR matcher.

function event(partial: {
  rawPath?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  sourceIp?: string;
} = {}) {
  return {
    rawPath: partial.rawPath ?? '/api/auth/me',
    headers: { host: 'lambda.test', ...(partial.headers ?? {}) },
    requestContext: { http: { method: partial.method ?? 'GET', sourceIp: partial.sourceIp ?? '1.2.3.4' } },
    body: partial.body,
  };
}

function requestOtpEvent(email: string, opts: { sourceIp: string; xff: string; headers?: Record<string, string> }) {
  return event({
    rawPath: '/api/auth/request-otp',
    method: 'POST',
    sourceIp: opts.sourceIp,
    headers: { 'x-forwarded-for': opts.xff, ...(opts.headers ?? {}) },
    body: JSON.stringify({ email }),
  });
}

describe('lambda/auth adapter', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    setCloudFrontIpChecker(null); // restore the "ranges not loaded" default
    __resetCloudFrontRangeLoader();
  });

  it('returns 404 for unknown paths', async () => {
    const res = await handler(event({ rawPath: '/api/nope' }));
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: 'Not found' });
  });

  it('returns 405 for a known path with the wrong method', async () => {
    const res = await handler(event({ rawPath: '/api/auth/request-otp', method: 'GET' }));
    expect(res.statusCode).toBe(405);
  });

  it('ignores a body on GET (no Request constructor crash — M4)', async () => {
    const res = await handler(event({ rawPath: '/api/auth/me', method: 'GET', body: '{"x":1}' }));
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ error: 'Not authenticated.' });
  });

  it('passes the Cookie header through to the handler', async () => {
    const res = await handler(
      event({ rawPath: '/api/auth/me', headers: { cookie: 'octav_session=bogus-token' } })
    );
    expect(res.statusCode).toBe(401);
  });

  it('converts storage failures into a controlled JSON 500 (M4)', async () => {
    vi.stubEnv('AUTH_STORAGE', 'dynamodb');
    vi.stubEnv('AUTH_EMAIL', 'dummy');
    const res = await handler(event({ rawPath: '/api/auth/me' }));
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({ error: 'Internal error' });
  });

  it('emits Set-Cookie values in the HTTP API v2 cookies array, not headers (round 2)', async () => {
    const res = await handler(event({ rawPath: '/api/auth/logout', method: 'POST' }));
    expect(res.statusCode).toBe(200);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.cookies).toHaveLength(1);
    expect(res.cookies![0]).toContain('Max-Age=0');
  });

  it('direct hit: spoofed XFF cannot rotate the limiter key (sourceIp appended)', async () => {
    // Direct caller: sourceIp is NOT a CloudFront edge → the adapter appends
    // it, so the last entry (what clientIp trusts) is always the real peer.
    setCloudFrontIpChecker((ip) => (ip === '10.42.0.77' ? false : null));
    const realIp = '10.42.0.77';
    for (let i = 0; i < 30; i++) {
      const res = await handler(
        requestOtpEvent(`spoof-${i}@example.com`, { sourceIp: realIp, xff: `spoofed-${i}.example.invalid` })
      );
      expect(res.statusCode).toBe(200);
    }
    const limited = await handler(
      requestOtpEvent('spoof-final@example.com', { sourceIp: realIp, xff: 'spoofed-final.example.invalid' })
    );
    expect(limited.statusCode).toBe(429);
  });

  it('CloudFront path: keys on the VIEWER IP, not the edge egress (round 3 regression guard)', async () => {
    // CloudFront-shaped events: the origin request policy appended the viewer
    // IP as the last XFF entry, and requestContext.sourceIp is a CLOUDFRONT
    // EDGE egress IP. The adapter must TRUST the last entry — the round-2
    // always-append rule keyed every request on the (varying) edge IP, which
    // this test catches: with 30 DIFFERENT edge sourceIps and ONE viewer IP,
    // the 31st request must 429 (viewer-keyed), not 200 (edge-keyed).
    setCloudFrontIpChecker((ip) => ip.startsWith('13.249.'));
    const viewerIp = '203.0.113.7';
    for (let i = 0; i < 30; i++) {
      const res = await handler(
        requestOtpEvent(`cf-${i}@example.com`, {
          sourceIp: `13.249.0.${i + 1}`,
          xff: viewerIp,
          headers: { 'x-amz-cf-id': `cf-id-${i}` },
        })
      );
      expect(res.statusCode).toBe(200);
    }
    const limited = await handler(
      requestOtpEvent('cf-final@example.com', {
        sourceIp: '13.249.0.99',
        xff: viewerIp,
        headers: { 'x-amz-cf-id': 'cf-id-final' },
      })
    );
    expect(limited.statusCode).toBe(429);
  });

  it('adversarial: a FORGED x-amz-cf-id on a direct hit must not re-open the spoofing hole', async () => {
    // The rule never consults x-amz-cf-id (it is forgeable by a direct
    // caller) — a forged header must change nothing: the direct caller's
    // rotating spoofed XFF still gets terminated by the appended sourceIp.
    setCloudFrontIpChecker((ip) => (ip === '10.77.0.1' ? false : null));
    const realIp = '10.77.0.1';
    for (let i = 0; i < 30; i++) {
      const res = await handler(
        requestOtpEvent(`forged-${i}@example.com`, {
          sourceIp: realIp,
          xff: `spoofed-${i}.example.invalid`,
          headers: { 'x-amz-cf-id': 'forged-cf-id', via: 'forged via header' },
        })
      );
      expect(res.statusCode).toBe(200);
    }
    const limited = await handler(
      requestOtpEvent('forged-final@example.com', {
        sourceIp: realIp,
        xff: 'spoofed-final.example.invalid',
        headers: { 'x-amz-cf-id': 'forged-cf-id' },
      })
    );
    expect(limited.statusCode).toBe(429);
  });

  it('injects the source IP when X-Forwarded-For is absent', async () => {
    const res = await handler(
      event({
        rawPath: '/api/auth/request-otp',
        method: 'POST',
        sourceIp: '9.9.9.99',
        body: JSON.stringify({ email: 'x@example.com' }),
      })
    );
    expect(res.statusCode).toBe(200);
  });
});

describe('CloudFront CIDR matcher (parseCidr/inCidr)', () => {
  it('matches IPv4 inside the prefix and rejects outside', () => {
    const range = parseCidr('13.249.0.0/16');
    expect(range).not.toBeNull();
    expect(inCidr('13.249.5.1', range!)).toBe(true);
    expect(inCidr('13.249.255.255', range!)).toBe(true);
    expect(inCidr('13.250.0.0', range!)).toBe(false);
    expect(inCidr('10.0.0.1', range!)).toBe(false);
  });

  it('matches IPv6 inside the prefix and rejects outside', () => {
    // /28 fixes the first 12 bits of group 2 (0x900) → covered group2 range
    // 0x9000–0x900f.
    const range = parseCidr('2600:9000::/28');
    expect(range).not.toBeNull();
    expect(inCidr('2600:9000:1234::1', range!)).toBe(true);
    expect(inCidr('2600:900f:ffff::1', range!)).toBe(true); // top edge of the /28
    expect(inCidr('2600:9010::1', range!)).toBe(false);
    expect(inCidr('2600:90ff:ffff::1', range!)).toBe(false);
  });

  it('handles compressed IPv6 forms and rejects cross-family matches', () => {
    const range = parseCidr('2600:9000::/32');
    expect(inCidr('2600:9000:0:0:0:0:0:1', range!)).toBe(true);
    expect(inCidr('13.249.0.1', range!)).toBe(false); // v4 vs v6 never matches
    expect(inCidr('not-an-ip', range!)).toBe(false);
  });

  it('covers the boundary prefixes: /0, /32, /128 (round 4)', () => {
    const v4Any = parseCidr('0.0.0.0/0')!;
    expect(inCidr('1.2.3.4', v4Any)).toBe(true);
    expect(inCidr('255.255.255.255', v4Any)).toBe(true);
    expect(inCidr('::1', v4Any)).toBe(false); // family mismatch even at /0

    const v4Exact = parseCidr('1.2.3.4/32')!;
    expect(inCidr('1.2.3.4', v4Exact)).toBe(true);
    expect(inCidr('1.2.3.5', v4Exact)).toBe(false);

    const v6Exact = parseCidr('::/128')!;
    expect(inCidr('::', v6Exact)).toBe(true);
    expect(inCidr('::1', v6Exact)).toBe(false);
  });

  it('accepts leading/trailing :: and uppercase hex, rejects empty groups and v4-in-v6 (round 4)', () => {
    const range = parseCidr('2600:abcd::/96')!;
    expect(inCidr('2600:abcd:0:0:0:0:0:1', range)).toBe(true); // trailing zeroes
    expect(inCidr('2600:ABCD::1', range)).toBe(true); // uppercase hex
    expect(inCidr('2600:abcd::1', range)).toBe(true); // leading '::'-side compression
    expect(inCidr('2600:abcd:1:2:3:4:5:6', range)).toBe(false); // beyond /96

    // v4-mapped-in-v6 is rejected (final group fails the hex check).
    expect(inCidr('::ffff:1.2.3.4', parseCidr('::/0')!)).toBe(false);
    // Empty group inside the address is malformed.
    expect(inCidr('2600:abcd::1::2', parseCidr('2600:abcd::/96')!)).toBe(false);
  });

  it('rejects malformed CIDRs, IPs, and trailing junk (round 4)', () => {
    expect(parseCidr('13.249.0.0/33')).toBeNull();
    expect(parseCidr('nonsense')).toBeNull();
    expect(parseCidr('13.249.0.1')).toBeNull();
    expect(parseCidr('1.2.3.4/8/extra')).toBeNull(); // trailing '/extra'
    expect(parseCidr('1.2.3.4/-1')).toBeNull();
    expect(parseCidr('1.2.3.4/8.5')).toBeNull();
    expect(parseCidr('a::b::c/64')).toBeNull(); // multiple '::'
    expect(parseCidr('abcd/64')).toBeNull(); // no '::' and not 8 groups
    expect(inCidr('999.1.1.1', parseCidr('10.0.0.0/8')!)).toBe(false);
    expect(inCidr('0x1.2.3.4', parseCidr('10.0.0.0/8')!)).toBe(false); // hex junk
    expect(inCidr('1..2.3', parseCidr('10.0.0.0/8')!)).toBe(false); // empty part
    expect(inCidr('1.2.3.4.5', parseCidr('10.0.0.0/8')!)).toBe(false); // 5 parts
    expect(inCidr('1e2.2.3.4', parseCidr('10.0.0.0/8')!)).toBe(false); // exponent junk
  });
});

describe('resolveForwardedFor branches (round 4 pins)', () => {
  it('null checker (ranges not installed) + existing chain → chain trusted unchanged', () => {
    setCloudFrontIpChecker(null);
    const headers = new Headers({ 'x-forwarded-for': '198.51.100.7' });
    resolveForwardedFor(headers, '5.6.7.8');
    expect(headers.get('x-forwarded-for')).toBe('198.51.100.7');
  });

  it('last XFF entry === sourceIp → left as-is (no double-append)', () => {
    setCloudFrontIpChecker(() => false);
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4' });
    resolveForwardedFor(headers, '1.2.3.4');
    expect(headers.get('x-forwarded-for')).toBe('1.2.3.4');
  });

  it('CloudFront peer (checker true) + chain → trusted unchanged', () => {
    setCloudFrontIpChecker((ip) => (ip === '13.249.1.1' ? true : null));
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.7' });
    resolveForwardedFor(headers, '13.249.1.1');
    expect(headers.get('x-forwarded-for')).toBe('203.0.113.7');
  });

  it('direct peer (checker false) + spoofed chain → sourceIp appended', () => {
    setCloudFrontIpChecker(() => false);
    const headers = new Headers({ 'x-forwarded-for': 'spoofed.example.invalid' });
    resolveForwardedFor(headers, '9.8.7.6');
    expect(headers.get('x-forwarded-for')).toBe('spoofed.example.invalid, 9.8.7.6');
  });

  it('no chain → sourceIp becomes the chain', () => {
    const headers = new Headers();
    resolveForwardedFor(headers, '9.8.7.6');
    expect(headers.get('x-forwarded-for')).toBe('9.8.7.6');
  });
});

describe('CloudFront ranges loader retry (round 4)', () => {
  it('retries a failed load after the interval and installs the checker', async () => {
    // Simulate the Lambda runtime env so the NODE_ENV=test skip does not
    // suppress the loader (also pins the round-4 guard shape).
    vi.stubEnv('AWS_LAMBDA_FUNCTION_NAME', 'iblearn-auth');
    __resetCloudFrontRangeLoader();

    let attempts = 0;
    const fetchMock = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('network down');
      return {
        ok: true,
        json: async () => ({
          prefixes: [{ ip_prefix: '13.249.0.0/16', service: 'CLOUDFRONT' }],
          ipv6_prefixes: [],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const t0 = 1_000_000_000;

    // First attempt fails → checker stays uninstalled.
    ensureCloudFrontIpCheckerLoaded(t0);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // Let the rejected load's .finally reset the in-flight guard before the
    // next synchronous ensure() calls (macrotask flush).
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(__getCloudFrontIpChecker()('13.249.1.1')).toBeNull();

    // Within the retry window → no re-fetch.
    ensureCloudFrontIpCheckerLoaded(t0 + 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Past the 5-minute interval → ONE retry, which succeeds and installs.
    ensureCloudFrontIpCheckerLoaded(t0 + 6 * 60_000);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(__getCloudFrontIpChecker()('13.249.1.1')).toBe(true));

    // Installed → no further fetches on later calls.
    ensureCloudFrontIpCheckerLoaded(t0 + 30 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('toLambdaResult (cookies array)', () => {
  it('preserves MULTIPLE Set-Cookie headers via the cookies array (round 2)', async () => {
    const headers = new Headers();
    headers.append('Set-Cookie', 'octav_session=abc; Path=/; HttpOnly');
    headers.append('Set-Cookie', 'octav_session=; Max-Age=0');
    const response = new Response(JSON.stringify({ ok: true }), { status: 200, headers });

    const result = await toLambdaResult(response);

    expect(result.statusCode).toBe(200);
    expect(result.headers['set-cookie']).toBeUndefined();
    expect(result.cookies).toHaveLength(2);
    expect(result.cookies![0]).toContain('octav_session=abc');
    expect(result.cookies![1]).toContain('Max-Age=0');
  });

  it('omits the cookies field when there are none', async () => {
    const result = await toLambdaResult(Response.json({ ok: true }));
    expect(result.cookies).toBeUndefined();
  });
});
