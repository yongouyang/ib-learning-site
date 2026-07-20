import { test, expect } from '@playwright/test';

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
