import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryContentStorage } from '@/lib/content/dummy';
import { handleContentGet } from '@/lib/content/http-handler';
import type { ContentDeps } from '@/lib/content/deps';
import {
  CONTENT_MAX_TOPIC_IDS,
  CONTENT_PREMIUM_ANOMALY_THRESHOLD,
  CONTENT_PREMIUM_REQUESTS_PER_WINDOW,
  CONTENT_PREMIUM_WINDOW_SECONDS,
  CONTENT_PRIVATE_CACHE_CONTROL,
  CONTENT_PUBLIC_CACHE_CONTROL,
  contentAccountScope,
  contentIpScope,
  contentRateLimitBucket,
  contentWindowResetAt,
  accountRef,
  maskEmail,
  parseMixedReviewPath,
  parsePremiumPaperPath,
} from '@/lib/content/types';
import { getPaperContent } from '@/content/registry.papers';
import { MIXED_REVIEW_COUNT } from '@/lib/mixed-review';
import { hashSessionToken } from '@/lib/auth/types';
import type { SessionRecord, UserRecord } from '@/lib/auth/types';

// Phase 1b — the content API contract (docs/premium-content-protection-plan.md §4). The premium route
// is a REAL gate (not the UX-only LockedFeature): an anonymous crawler must not be able to read a
// mark scheme at all. These drive the handler directly with a fresh dummy universe, so the premium
// access matrix (anonymous / free / premium) is pinned without AWS and without a browser.

const PREMIUM_SET = 'math-y9-set-2'; // sets 2+ are premium (isFreePaperSet)
const FREE_SET = 'math-y9-set-1';
const COURSE = 'math-y9';

/** A session row + user row in the dummy universe, returning the cookie the request should carry. */
async function signIn(
  storage: InMemoryContentStorage,
  tier: 'free' | 'premium',
  /** Distinguishes two accounts of the same tier — the premium budget is per ACCOUNT, not per tier. */
  account = '',
): Promise<string> {
  const token = `token-${tier}${account}`;
  const userId = `user-${tier}${account}`;
  const sessionId = hashSessionToken(token);
  const nowSec = Math.floor(Date.now() / 1000);
  const session: SessionRecord = {
    sessionId,
    userId,
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    expiresAt: nowSec + 3600,
    email: `${tier}${account}@example.com`,
    userAgent: 'vitest',
    ip: '127.0.0.1',
  };
  const user = {
    userId,
    email: `${tier}${account}@example.com`,
    tier,
    createdAt: new Date().toISOString(),
    childProfiles: [],
  } as unknown as UserRecord;
  await storage.createSession(session);
  await storage.createUser(user);
  return `octav_session=${token}`;
}

function deps(storage: InMemoryContentStorage): ContentDeps {
  return { storage, clock: () => Date.now() };
}

const get = (path: string, cookie?: string) =>
  new Request(`https://octavlearning.com${path}`, {
    method: 'GET',
    headers: cookie ? { cookie } : {},
  });

describe('content API — path parsing', () => {
  it('parses the premium papers path and refuses anything else', () => {
    expect(parsePremiumPaperPath(`/api/content/premium/papers/${COURSE}/${PREMIUM_SET}`)).toEqual({
      courseId: COURSE,
      setId: PREMIUM_SET,
    });
    expect(parsePremiumPaperPath('/api/content/premium/papers/math-y9')).toBeNull();
    expect(parsePremiumPaperPath('/api/content/premium/papers/a/b/c')).toBeNull();
    // Charset-checked: ids become path segments, so traversal-ish input cannot reach the registry.
    expect(parsePremiumPaperPath('/api/content/premium/papers/..%2Fetc/passwd')).toBeNull();
    expect(parsePremiumPaperPath('/api/content/public/mixed-review/seed')).toBeNull();
  });

  it('parses the public mixed-review path with and without weak-topic ids', () => {
    expect(parseMixedReviewPath('/api/content/public/mixed-review/random:abc')).toEqual({
      seed: 'random:abc',
      topicIds: null,
    });
    expect(parseMixedReviewPath('/api/content/public/mixed-review/weak:abc/math-yr7-angles,bio-cell-1')).toEqual({
      seed: 'weak:abc',
      topicIds: ['math-yr7-angles', 'bio-cell-1'],
    });
    // Bounded: an over-long id list is refused rather than assembled.
    const tooMany = Array.from({ length: CONTENT_MAX_TOPIC_IDS + 1 }, (_, i) => `t${i}`).join(',');
    expect(parseMixedReviewPath(`/api/content/public/mixed-review/seed/${tooMany}`)).toBeNull();
    expect(parseMixedReviewPath('/api/content/public/mixed-review/bad seed')).toBeNull();
    expect(parseMixedReviewPath('/api/content/premium/papers/a/b')).toBeNull();
  });
});

describe('content API — premium papers is a real gate', () => {
  let storage: InMemoryContentStorage;

  beforeEach(() => {
    storage = new InMemoryContentStorage();
  });

  it('401s an anonymous request (this is the hole the API exists to close)', async () => {
    const res = await handleContentGet(get(`/api/content/premium/papers/${COURSE}/${PREMIUM_SET}`), deps(storage));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'login_required' });
    expect(res.headers.get('Cache-Control')).toBe(CONTENT_PRIVATE_CACHE_CONTROL);
  });

  it('403s a free-tier session and never leaks the paper', async () => {
    const cookie = await signIn(storage, 'free');
    const res = await handleContentGet(
      get(`/api/content/premium/papers/${COURSE}/${PREMIUM_SET}`, cookie),
      deps(storage)
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: 'not_entitled' });
    expect(JSON.stringify(body)).not.toContain('markscheme');
  });

  it('serves the paper to a premium session, private and no-store', async () => {
    const cookie = await signIn(storage, 'premium');
    const res = await handleContentGet(
      get(`/api/content/premium/papers/${COURSE}/${PREMIUM_SET}`, cookie),
      deps(storage)
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(CONTENT_PRIVATE_CACHE_CONTROL);
    // The session TTL is slid, like every other authenticated handler.
    expect(res.headers.get('Set-Cookie')).toContain('octav_session=');
    const body = (await res.json()) as { paper: { id: string; questions: unknown[] } };
    expect(body.paper.id).toBe(PREMIUM_SET);
    expect(body.paper.questions.length).toBe(getPaperContent(COURSE, PREMIUM_SET)!.questions.length);
  });

  it('404s an unknown set for an entitled session', async () => {
    const cookie = await signIn(storage, 'premium');
    const res = await handleContentGet(
      get(`/api/content/premium/papers/${COURSE}/math-y9-set-99`, cookie),
      deps(storage)
    );
    expect(res.status).toBe(404);
  });

  it('serves a FREE set to a premium session too (only premium content is gated)', async () => {
    const cookie = await signIn(storage, 'premium');
    const res = await handleContentGet(get(`/api/content/premium/papers/${COURSE}/${FREE_SET}`, cookie), deps(storage));
    expect(res.status).toBe(200);
  });
});

describe('content API — public mixed review', () => {
  let storage: InMemoryContentStorage;

  beforeEach(() => {
    storage = new InMemoryContentStorage();
  });

  it('needs no session and is edge-cacheable', async () => {
    const res = await handleContentGet(get('/api/content/public/mixed-review/random:seeded'), deps(storage));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(CONTENT_PUBLIC_CACHE_CONTROL);
    const body = (await res.json()) as { questions: unknown[] };
    expect(body.questions).toHaveLength(MIXED_REVIEW_COUNT);
  });

  it('draws only from the requested weak topics', async () => {
    const res = await handleContentGet(
      get('/api/content/public/mixed-review/weak:seeded/math-yr7-angles'),
      deps(storage)
    );
    const body = (await res.json()) as { questions: { topicId: string }[] };
    expect(body.questions.length).toBeGreaterThan(0);
    expect(new Set(body.questions.map((q) => q.topicId))).toEqual(new Set(['math-yr7-angles']));
  });

  it('throttles per IP once the window budget is spent', async () => {
    let allowed = 0;
    for (let i = 0; i < 70; i += 1) {
      const res = await handleContentGet(get('/api/content/public/mixed-review/seed-x'), deps(storage));
      if (res.status === 200) allowed += 1;
      else {
        expect(res.status).toBe(429);
        expect(res.headers.get('Cache-Control')).toBe(CONTENT_PRIVATE_CACHE_CONTROL);
        break;
      }
    }
    expect(allowed).toBe(60); // CONTENT_PUBLIC_REQUESTS_PER_WINDOW
  });

  it('404s ids that match no topic instead of returning an empty quiz', async () => {
    const res = await handleContentGet(
      get('/api/content/public/mixed-review/seed/not-a-real-topic'),
      deps(storage)
    );
    expect(res.status).toBe(404);
  });
});

describe('content API — premium per-account budget (Phase 2)', () => {
  const FIXED_MS = Date.parse('2026-09-18T12:34:56.000Z');
  let storage: InMemoryContentStorage;
  let deps: ContentDeps;

  beforeEach(() => {
    // One frozen clock for BOTH the storage's bucket epoch and the handler's `resetAt`.
    const clock = () => FIXED_MS;
    storage = new InMemoryContentStorage(clock);
    deps = { storage, clock };
  });

  const premiumUrl = `/api/content/premium/papers/${COURSE}/${PREMIUM_SET}`;

  it('throttles an entitled account after the window budget, with resetAt and a slid session', async () => {
    const cookie = await signIn(storage, 'premium');
    let allowed = 0;
    for (let i = 0; i < CONTENT_PREMIUM_REQUESTS_PER_WINDOW + 2; i += 1) {
      const res = await handleContentGet(get(premiumUrl, cookie), deps);
      if (res.status === 200) {
        allowed += 1;
        continue;
      }
      expect(res.status).toBe(429);
      expect(res.headers.get('Cache-Control')).toBe(CONTENT_PRIVATE_CACHE_CONTROL);
      // The user is authenticated and legitimately active — the session must keep sliding.
      expect(res.headers.get('Set-Cookie')).toContain('octav_session=');
      const body = (await res.json()) as { error: string; resetAt: string };
      expect(body.error).toBe('quota_exceeded');
      const resetAt = Date.parse(body.resetAt);
      expect(resetAt).toBeGreaterThan(FIXED_MS);
      expect(resetAt).toBeLessThanOrEqual(FIXED_MS + CONTENT_PREMIUM_WINDOW_SECONDS * 1000);
      break;
    }
    expect(allowed).toBe(CONTENT_PREMIUM_REQUESTS_PER_WINDOW);
  });

  it('does not spend the budget on 401, 403 or 404 — only on a delivery that happens', async () => {
    // 404s for an entitled account: 40 of them, well past the budget.
    const cookie = await signIn(storage, 'premium');
    for (let i = 0; i < 40; i += 1) {
      const res = await handleContentGet(get(`/api/content/premium/papers/${COURSE}/math-y9-set-98`, cookie), deps);
      expect(res.status).toBe(404);
    }
    // …and the account can still read a real set.
    expect((await handleContentGet(get(premiumUrl, cookie), deps)).status).toBe(200);

    // Anonymous and free-tier refusals never touch anyone's counter either.
    for (let i = 0; i < 40; i += 1) {
      expect((await handleContentGet(get(premiumUrl), deps)).status).toBe(401);
    }
    const freeCookie = await signIn(storage, 'free');
    for (let i = 0; i < 40; i += 1) {
      expect((await handleContentGet(get(premiumUrl, freeCookie), deps)).status).toBe(403);
    }
  });

  it('keys the budget by account, not by IP or by tier', async () => {
    const a = await signIn(storage, 'premium', '-a');
    const b = await signIn(storage, 'premium', '-b');
    // Spend A's whole window.
    for (let i = 0; i < CONTENT_PREMIUM_REQUESTS_PER_WINDOW; i += 1) {
      expect((await handleContentGet(get(premiumUrl, a), deps)).status).toBe(200);
    }
    expect((await handleContentGet(get(premiumUrl, a), deps)).status).toBe(429);
    // B shares neither the IP nor the budget.
    expect((await handleContentGet(get(premiumUrl, b), deps)).status).toBe(200);
  });

  it('logs one attributable anomaly warning per account per window, below the budget', async () => {
    const cookie = await signIn(storage, 'premium');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (let i = 0; i < CONTENT_PREMIUM_ANOMALY_THRESHOLD; i += 1) {
        expect((await handleContentGet(get(premiumUrl, cookie), deps)).status).toBe(200);
      }
      const anomalies = warn.mock.calls.filter(([line]) => String(line).includes('premium anomaly'));
      expect(anomalies).toHaveLength(1);
      // Attributable: the account id is in the line, which is the whole point (plan §1 decision 1(b)).
      expect(String(anomalies[0][0])).toContain('userId=user-premium');

      // …and it does not repeat for the rest of the window.
      for (let i = 0; i < CONTENT_PREMIUM_REQUESTS_PER_WINDOW - CONTENT_PREMIUM_ANOMALY_THRESHOLD; i += 1) {
        await handleContentGet(get(premiumUrl, cookie), deps);
      }
      expect(warn.mock.calls.filter(([line]) => String(line).includes('premium anomaly'))).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('mirrors the DynamoDB adapter: refusals do not advance the counter and report the cap', async () => {
    // The adapter's conditional update does not write on failure, so the item stays exactly at the
    // limit. The dummy must agree, otherwise a log line or a future read would disagree with production.
    const scope = contentAccountScope('user-parity');
    const sequence: Array<{ allowed: boolean; count: number }> = [];
    for (let i = 0; i < 4; i += 1) {
      sequence.push(await storage.incrementContentRequestCount(scope, 2, 3600));
    }
    expect(sequence).toEqual([
      { allowed: true, count: 1 },
      { allowed: true, count: 2 },
      { allowed: false, count: 2 },
      { allowed: false, count: 2 },
    ]);
  });

  it('scopes the public budget to the IP and the premium one to the account', () => {
    expect(contentIpScope('1.2.3.4')).toBe('content:ip:1.2.3.4');
    expect(contentAccountScope('user-1')).toBe('content:acct:user-1');
    expect(contentRateLimitBucket(contentIpScope('1.2.3.4'), FIXED_MS, 3600)).toBe(
      `content:ip:1.2.3.4:${Math.floor(FIXED_MS / 3_600_000)}`
    );
    // resetAt is the END of the window containing `now`, never a moment inside it.
    expect(Date.parse(contentWindowResetAt(FIXED_MS, 3600))).toBe(
      (Math.floor(FIXED_MS / 3_600_000) + 1) * 3_600_000
    );
  });
});

describe('content API — the leak-tracing marker (Phase 2)', () => {
  // A frozen clock so `issuedAt` is assertable rather than merely well-formed.
  const FIXED_MS = Date.parse('2026-09-18T15:04:05.000Z');
  let storage: InMemoryContentStorage;
  let deps: ContentDeps;

  beforeEach(() => {
    const clock = () => FIXED_MS;
    storage = new InMemoryContentStorage(clock);
    deps = { storage, clock };
  });

  const premiumUrl = `/api/content/premium/papers/${COURSE}/${PREMIUM_SET}`;

  it('stamps a premium set with a masked, opaque, timestamped attribution', async () => {
    const cookie = await signIn(storage, 'premium');
    const res = await handleContentGet(get(premiumUrl, cookie), deps);
    expect(res.headers.get('Cache-Control')).toBe(CONTENT_PRIVATE_CACHE_CONTROL);
    const body = (await res.json()) as { attribution?: { issuedTo: string; ref: string; issuedAt: string } };
    // signIn() creates premium@example.com / user-premium.
    expect(body.attribution?.issuedTo).toBe('p***@example.com');
    expect(body.attribution?.issuedAt).toBe('2026-09-18T15:04:05.000Z');
    // The ref is an opaque pointer, not the account id — pinned as a shape, not as a value, so this
    // test does not merely restate the hash it is meant to be checking.
    expect(body.attribution?.ref).toMatch(/^[0-9a-f]{10}$/);
    expect(body.attribution?.ref).not.toContain('user-premium');
    // The paper itself is still delivered in full.
    expect((body as unknown as { paper: { id: string } }).paper.id).toBe(PREMIUM_SET);
  });

  it('leaves the FREE set 1 unmarked (it is not the paid asset, and its page is prerendered)', async () => {
    const cookie = await signIn(storage, 'premium');
    const res = await handleContentGet(get(`/api/content/premium/papers/${COURSE}/${FREE_SET}`, cookie), deps);
    const body = (await res.json()) as { attribution?: unknown };
    expect(body.attribution).toBeUndefined();
  });

  it('gives the same account the same ref across sets and two accounts different refs', async () => {
    // Stable-per-account is what makes a leaked copy resolve to ONE row of octav-users; distinct-per-
    // account is what makes that resolution useful.
    const a = await signIn(storage, 'premium', '-a');
    const b = await signIn(storage, 'premium', '-b');
    const refOf = async (cookie: string) => {
      const res = await handleContentGet(get(premiumUrl, cookie), deps);
      return ((await res.json()) as { attribution: { ref: string } }).attribution.ref;
    };
    const [refA, refB] = [await refOf(a), await refOf(b)];
    expect(refA).not.toBe(refB);
    expect(await refOf(a)).toBe(refA);
  });

  it('masks an email so a screenshot never carries a full address', () => {
    expect(maskEmail('maya@example.com')).toBe('m***@example.com');
    // Total by construction: a missing or malformed address must not blank the line, and must not throw.
    expect(maskEmail('')).toBe('your account');
    expect(maskEmail(undefined)).toBe('your account');
    expect(maskEmail('no-at-sign')).toBe('your account');
    expect(maskEmail('@example.com')).toBe('your account');
    expect(maskEmail('a@')).toBe('your account');
  });

  it('derives the ref from the userId alone (a hash, never the id)', () => {
    expect(accountRef('user-1')).toMatch(/^[0-9a-f]{10}$/);
    expect(accountRef('user-1')).toBe(accountRef('user-1'));
    expect(accountRef('user-1')).not.toBe(accountRef('user-2'));
    expect(accountRef('user-1')).not.toContain('user-1');
  });
});

describe('content API — health and routing', () => {
  it('health reports the bundled topic count (an esbuild that dropped the JSON fails here)', async () => {
    const res = await handleContentGet(get('/api/content/_health'), deps(new InMemoryContentStorage()));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; topicCount: number };
    expect(body.ok).toBe(true);
    expect(body.topicCount).toBe(245);
    // `"ok":true` is what keeps the CI probe path-discriminating — the /api/* catch-all answers
    // {"configured":true} for any unclaimed path.
    expect(JSON.stringify(body)).toContain('"ok":true');
  });

  it('404s an unknown path under the content prefix', async () => {
    const res = await handleContentGet(get('/api/content/nope'), deps(new InMemoryContentStorage()));
    expect(res.status).toBe(404);
  });
});
