import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryContentStorage } from '@/lib/content/dummy';
import { handleContentGet } from '@/lib/content/http-handler';
import type { ContentDeps } from '@/lib/content/deps';
import {
  CONTENT_MAX_TOPIC_IDS,
  CONTENT_PRIVATE_CACHE_CONTROL,
  CONTENT_PUBLIC_CACHE_CONTROL,
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
async function signIn(storage: InMemoryContentStorage, tier: 'free' | 'premium'): Promise<string> {
  const token = `token-${tier}`;
  const sessionId = hashSessionToken(token);
  const nowSec = Math.floor(Date.now() / 1000);
  const session: SessionRecord = {
    sessionId,
    userId: `user-${tier}`,
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    expiresAt: nowSec + 3600,
    email: `${tier}@example.com`,
    userAgent: 'vitest',
    ip: '127.0.0.1',
  };
  const user = {
    userId: `user-${tier}`,
    email: `${tier}@example.com`,
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

describe('content API — health and routing', () => {
  it('health reports the bundled topic count (an esbuild that dropped the JSON fails here)', async () => {
    const res = await handleContentGet(get('/api/content/_health'), deps(new InMemoryContentStorage()));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; topicCount: number };
    expect(body.ok).toBe(true);
    expect(body.topicCount).toBe(233);
    // `"ok":true` is what keeps the CI probe path-discriminating — the /api/* catch-all answers
    // {"configured":true} for any unclaimed path.
    expect(JSON.stringify(body)).toContain('"ok":true');
  });

  it('404s an unknown path under the content prefix', async () => {
    const res = await handleContentGet(get('/api/content/nope'), deps(new InMemoryContentStorage()));
    expect(res.status).toBe(404);
  });
});
