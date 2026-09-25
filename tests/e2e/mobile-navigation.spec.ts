import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * The longest topic title in the corpus, with its subject dir. Derived rather
 * than hard-coded so a longer title added later is the one that gets tested.
 */
function longestTopic(): { subject: string; id: string; title: string } {
  const topicsDir = path.join(process.cwd(), 'src/content/data/topics');
  const all = fs.readdirSync(topicsDir).flatMap((subject) => {
    const dir = path.join(topicsDir, subject);
    if (!fs.statSync(dir).isDirectory()) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json') && f !== 'order.json')
      .map((f) => {
        const t = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { id: string; title: string };
        return { subject, id: t.id, title: t.title };
      });
  });
  return all.sort((a, b) => b.title.length - a.title.length)[0];
}

test.describe('Mobile / tablet navigation', () => {
  test('bottom navigation is usable on mobile viewports', async ({ page, isMobile }) => {
    // Bottom nav is intentionally hidden at >=768px (md breakpoint) — tablets
    // like iPad Pro 11 (834px) get the desktop layout, so only phones apply.
    const width = page.viewportSize()?.width ?? 0;
    test.skip(!isMobile || width >= 768, 'Only runs on phone-sized viewports (bottom nav hidden at >=768px)');

    await page.goto('/');

    const bottomNav = page.locator('nav').filter({ has: page.getByRole('link', { name: 'Learn' }) });
    await expect(bottomNav).toBeVisible();

    await bottomNav.getByRole('link', { name: 'Progress' }).click();
    await page.waitForURL('/progress');
    await expect(page.getByRole('heading', { name: 'My Progress' })).toBeVisible();

    await bottomNav.getByRole('link', { name: 'Learn' }).click();
    await page.waitForURL('/');
    await expect(page.getByRole('heading', { name: 'Subjects' })).toBeVisible();
  });

  test('long topic titles do not overflow the viewport', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Only runs on mobile viewports');

    // Regression guard for the breadcrumb defect measured 2026-09-24: quiz and
    // flashcards print the WHOLE topic title as a mid-trail *linked* crumb, and
    // the link was `shrink-0` with an unbounded label — a flex item that cannot
    // shrink or wrap, so the document grew to 878px inside a 320px viewport
    // (iPhone SE; page-level horizontal scroll on every phone). No unit test can
    // see this: it is layout, so it needs a real viewport and a real width.
    const topic = longestTopic();
    expect(topic.title.length, 'the corpus still has a long title worth guarding').toBeGreaterThan(38);

    for (const surface of ['study', 'quiz', 'flashcards']) {
      await page.goto(`/subjects/${topic.subject}/${topic.id}/${surface}`);
      await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible();

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(
        scrollWidth,
        `${surface} scrolls horizontally: document is ${scrollWidth}px wide in a ${clientWidth}px viewport ` +
          `("${topic.title}")`,
      ).toBeLessThanOrEqual(clientWidth + 1);
    }
  });

  test('mobile topic page action buttons fit in viewport', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Only runs on mobile viewports');

    await page.goto('/subjects/math/math-yr7-calculations/study');
    await expect(page.getByRole('heading', { name: 'Written Calculations', level: 1 })).toBeVisible();

    const flashcardsButton = page.getByRole('link', { name: /Study Flashcards/i });
    const quizButton = page.getByRole('link', { name: /Take Quiz/i });

    await expect(flashcardsButton).toBeVisible();
    await expect(quizButton).toBeVisible();

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();

    for (const button of [flashcardsButton, quizButton]) {
      const box = await button.boundingBox();
      expect(box, 'action button has a bounding box').not.toBeNull();
      expect(box!.width, 'action button is wider than zero').toBeGreaterThan(0);
      expect(box!.x + box!.width, 'action button overflows viewport').toBeLessThanOrEqual(viewport!.width + 1);
      expect(box!.x, 'action button is off-screen left').toBeGreaterThanOrEqual(-1);
    }
  });
});
