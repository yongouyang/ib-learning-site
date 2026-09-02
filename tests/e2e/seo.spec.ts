import { test, expect } from '@playwright/test';

/**
 * SEO wiring checks (docs/seo-technical-plan.md §1.2 + §2.4).
 *
 * The unit tests prove the metadata *derivation*; these prove the *wiring* — that the right
 * helper is attached to the right route, in the URL shape the sitemap promises. A helper
 * imported into the wrong page.tsx is invisible to unit tests and fatal in production.
 * Runs in both dev (`npm run test:e2e`) and against the static export (`test:e2e:static`).
 */

async function head(page: import('@playwright/test').Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  const title = await page.title();
  const robots = (await page.getAttribute('meta[name="robots"]', 'content')) ?? '';
  const canonical = await page.getAttribute('link[rel="canonical"]', 'href');
  const description = (await page.getAttribute('meta[name="description"]', 'content')) ?? '';
  return { title, robots, canonical, description };
}

test.describe('SEO metadata wiring', () => {
  test('topic study page is indexable, self-canonical and curriculum-qualified', async ({ page }) => {
    const h = await head(page, '/subjects/math/math-yr7-angles/study');
    expect(h.title).toBe('Angles — KS3 Year 7 Maths');
    expect(h.robots).toContain('index');
    expect(h.robots).not.toContain('noindex');
    expect(h.robots).toContain('max-image-preview:large');
    expect(h.canonical).toBe('https://octavlearning.com/subjects/math/math-yr7-angles/study');
    // counts are stated where they can be verified against the page
    expect(h.description).toContain('7 illustrated notes');
    expect(h.description).toContain('15 practice questions');
    expect(h.description).not.toMatch(/[$\\{}]/); // no KaTeX leaking into the meta tag
  });

  test('quiz and flashcards are noindex but follow, canonicalised to the study page', async ({ page }) => {
    for (const tool of ['quiz', 'flashcards']) {
      const h = await head(page, `/subjects/math/math-yr7-angles/${tool}`);
      expect(h.robots).toContain('noindex');
      expect(h.robots).toContain('follow');
      expect(h.canonical).toBe('https://octavlearning.com/subjects/math/math-yr7-angles/study');
      expect(h.title).toContain(tool);
    }
  });

  test('subject page names every tier it actually has content in', async ({ page }) => {
    const h = await head(page, '/subjects/math');
    expect(h.title).toBe('Maths revision notes — KS3 & IB DP · Octav Learning');
    expect(h.title).not.toContain('IGCSE'); // no IGCSE content: the title must not claim it
    expect(h.canonical).toBe('https://octavlearning.com/subjects/math');
  });

  test('free assessment surfaces stay indexable and premium ones do not', async ({ page }) => {
    const free = [
      ['/diagnostics/math-y7', 'KS3 Year 7 Maths diagnostic test · Octav Learning'],
      ['/exams/math-y7/ladder/1', 'KS3 Year 7 Maths ladder level 1 · Octav Learning'],
      ['/papers/math-y7/math-y7-set-1', 'KS3 Year 7 Maths practice paper set 1 · Octav Learning'],
    ] as const;
    for (const [path, title] of free) {
      const h = await head(page, path);
      expect(h.title).toBe(title);
      expect(h.robots).not.toContain('noindex');
    }

    const premium = [
      '/exams/math-y7/ladder/3',
      '/papers/math-y7/math-y7-set-2',
      '/exams/math-y7/paper-1', // timed mocks are Premium end-to-end
    ] as const;
    for (const path of premium) {
      const h = await head(page, path);
      expect(h.robots, `${path} must be noindex,follow`).toContain('noindex');
      expect(h.robots, `${path} must stay crawlable`).toContain('follow');
      expect(h.title).not.toContain('Octav Learning · Octav Learning'); // brand appears once
    }
  });

  test('tier hubs render 200, indexable, self-canonical and hreflang-bearing', async ({ page, request }) => {
    // The URL set the sitemap's core.xml promises (docs/seo-technical-plan.md S3).
    const hubs = [
      ['/ks3', 'KS3 revision · Octav Learning'],
      ['/ks3/math', 'KS3 Maths · Octav Learning'],
      ['/ks3/english', 'KS3 English · Octav Learning'],
      ['/ibdp', 'IB DP revision · Octav Learning'],
      ['/ibdp/math', 'IB DP Maths · Octav Learning'],
    ] as const;
    for (const [path, title] of hubs) {
      const res = await request.get(path);
      expect(res.status(), `${path} must be a live page`).toBe(200);
      const h = await head(page, path);
      expect(h.title, path).toBe(title);
      expect(h.robots, path).toContain('index');
      expect(h.robots, path).not.toContain('noindex');
      expect(h.canonical, path).toBe(`https://octavlearning.com${path}`);
      // hreflang is emitted on hub URLs only — the H0 self-referencing group
      const xDefault = await page.getAttribute('link[rel="alternate"][hreflang="x-default"]', 'href');
      const enGb = await page.getAttribute('link[rel="alternate"][hreflang="en-GB"]', 'href');
      expect(xDefault, path).toBe(`https://octavlearning.com${path}`);
      expect(enGb, path).toBe(`https://octavlearning.com${path}`);
    }
    // Hubs index the study pages (internal-link depth ≤ 3, plan §4.4 item 3)
    await page.goto('/ks3/math', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('a[href="/subjects/math/math-yr7-angles/study"]').first()).toBeVisible();
    await page.goto('/ibdp/math', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('a[href^="/subjects/math/math-dp-ai-"]').first()).toBeVisible();
  });

  test('the empty IGCSE tier has no route', async ({ request }) => {
    expect((await request.get('/igcse')).status()).toBe(404);
    expect((await request.get('/igcse/math')).status()).toBe(404);
  });

  test('app and internal surfaces are noindex, follow', async ({ page }) => {
    for (const path of ['/login', '/mixed-review', '/leaderboard', '/account', '/progress', '/offline']) {
      const h = await head(page, path);
      expect(h.robots, `${path} must be noindex`).toContain('noindex');
      expect(h.robots, `${path} must be follow`).toContain('follow');
    }
  });

  test('every rendered title carries the brand exactly once', async ({ page }) => {
    for (const path of ['/pricing', '/terms', '/subjects/english', '/exams', '/papers', '/diagnostics', '/', '/account']) {
      const h = await head(page, path);
      const occurrences = h.title.split('Octav Learning').length - 1;
      expect(occurrences, `${path}: "${h.title}"`).toBeLessThanOrEqual(1);
      expect(occurrences, `${path} must name the brand once`).toBe(1);
    }
  });

  test('the homepage is indexable with a self-canonical and an absolute brand title', async ({ page }) => {
    // The one page of 809 that shipped with neither robots nor canonical while page.tsx
    // was 'use client' (found by scripts/verify-seo-live.ts). The server-wrapper fix must
    // not regress: exact title, index robots, canonical on the apex.
    const h = await head(page, '/');
    expect(h.title).toBe('Octav Learning');
    expect(h.robots).toContain('index');
    expect(h.robots).not.toContain('noindex');
    expect(h.canonical).toBe('https://octavlearning.com');
  });

  test('no page title overruns the SERP width budget on an indexable page', async ({ page }) => {
    const wide = /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/;
    for (const path of [
      '/subjects/chinese/chin-yr7-greetings-names/study',
      '/subjects/math/math-yr7-angles/study',
      '/subjects/history/hist-yr7-medieval-europe/study',
    ]) {
      const h = await head(page, path);
      if (h.robots.includes('noindex')) continue;
      const cells = [...h.title].reduce((n, ch) => n + (wide.test(ch) ? 2 : 1), 0);
      expect(cells, `${path}: ${h.title}`).toBeLessThanOrEqual(60);
    }
  });
});

test.describe('crawler infrastructure', () => {
  test('robots.txt is served as text and allows the curriculum tree', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/User-agent: \*/i);
    expect(body).toMatch(/Allow: \/|Disallow: \/api\//i);
  });

  test('a deep topic page returns 200 and its HTML is prerendered (no JS-render gap)', async ({ request }) => {
    const res = await request.get('/subjects/math/math-yr7-angles/study');
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain('Types of Angles'); // real copy in the document, not client-fetched
    expect(html).toContain('<link rel="canonical"');
  });
});
