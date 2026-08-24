import { test, expect } from '@playwright/test';
import { mockPremiumSession } from './premium-session';

// Phase 3 + E3: revision ladder — levels 1–2 free, upper levels (3–5) Premium
// (docs/entitlement-policy.md §Tier 2). Score-unlock logic is unchanged and
// stacks on top of the tier gate.
test.describe('Revision ladder', () => {
  test('overview shows free levels 1–2 and the premium tease for upper levels on a fresh profile', async ({ page }) => {
    await page.goto('/exams/math-y7/ladder');
    await expect(page.getByRole('heading', { name: /Revision Ladder — Math — Year 7/, level: 1 })).toBeVisible();

    // Free tiers: level 1 is a link; level 2 is score-locked with its hint.
    await expect(page.getByRole('link', { name: /Level 1 — Warm-up/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Level 2/ })).toHaveCount(0);
    await expect(page.getByText(/Score ≥60% on Level 1 to unlock/)).toBeVisible();

    // Levels 3–5 sit behind one premium tease card with a pricing link, and
    // their locked rows name BOTH gates (premium and score), not score alone.
    await expect(page.getByText('Upper ladder levels')).toBeVisible();
    await expect(page.getByRole('link', { name: 'See Premium plans' })).toBeVisible();
    await expect(page.getByText(/Premium · unlock with ≥60% on Level 2/)).toBeVisible();
    // The upper-level rows are an inert preview — not real links.
    await expect(page.getByRole('link', { name: /Level [3-5]/ })).toHaveCount(0);
  });

  test('completing level 1 records a best score', async ({ page }) => {
    await page.goto('/exams/math-y7/ladder/1');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();

    // 10 questions; answer all with "A." (score doesn't matter for this test).
    for (let i = 0; i < 10; i++) {
      const choice = page.getByRole('button').filter({ hasText: /^A\./ }).first();
      await expect(choice).toBeVisible();
      await choice.click();
      const nextBtn = page.getByRole('button', { name: /Next Question|See Results/ });
      await expect(nextBtn).toBeVisible();
      await nextBtn.evaluate((el) => (el as HTMLElement).click());
      if (i < 9) {
        await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
      }
    }
    await expect(page.getByRole('heading', { name: 'Quiz Complete!' })).toBeVisible();

    // The overview now shows a best score for level 1.
    await page.goto('/exams/math-y7/ladder');
    await expect(page.getByText(/Best: \d+%/)).toBeVisible();
  });

  test('a passing level-1 score unlocks level 2', async ({ page }) => {
    // Seed storage with a passing level-1 result before any page script runs.
    await page.addInitScript(() => {
      localStorage.setItem('iblearn_progress', JSON.stringify({
        version: 1,
        userProgress: { totalStars: 0, currentStreakDays: 0, lastStudyDate: null },
        topicProgress: {},
        examResults: [],
        ladderProgress: { 'math-y7': { 1: { bestScore: 0.8, completedAt: new Date().toISOString() } } },
      }));
    });
    await page.goto('/exams/math-y7/ladder');
    await expect(page.getByRole('link', { name: /Level 2 — Getting going/ })).toBeVisible();
    await expect(page.getByText('Best: 80%')).toBeVisible();
    // Level 3 stays locked (level 2 not completed — and premium-gated anyway).
    await expect(page.getByRole('link', { name: /Level 3/ })).toHaveCount(0);
  });

  test('an upper level shows the premium tease on direct access, with the score status live', async ({ page }) => {
    await page.goto('/exams/math-y7/ladder/3');
    await expect(page.getByText('Upper ladder levels')).toBeVisible();
    await expect(page.getByRole('link', { name: 'See Premium plans' })).toBeVisible();
    // Fresh profile: level 3 is premium-gated AND score-locked — the status
    // message names both and shows at full opacity ABOVE the tease…
    const status = page.getByText(/Premium level — you'll also need 60% or more on Level 2/);
    await expect(status).toBeVisible();
    // …never ghosted inside the inert preview.
    await expect(page.locator('[aria-hidden="true"]').getByText(/Premium level/)).toHaveCount(0);
    // No live quiz behind the tease (static sample rows only).
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(0);
  });

  test('premium sessions see upper levels without the tease (score-unlock still applies)', async ({ page }) => {
    await mockPremiumSession(page);
    await page.goto('/exams/math-y7/ladder');
    await expect(page.getByRole('link', { name: 'See Premium plans' })).toHaveCount(0);
    // Level 3's row is live again — score-gated, with its hint accessible.
    await expect(page.getByText(/Score ≥60% on Level 2 to unlock/)).toBeVisible();
  });

  test('exams index links to the ladder', async ({ page }) => {
    await page.goto('/exams');
    await page.getByRole('link', { name: /Revision Ladder — 5 levels/ }).first().click();
    await page.waitForURL('**/exams/math-y7/ladder');
    await expect(page.getByRole('heading', { name: /Revision Ladder/, level: 1 })).toBeVisible();
  });
});
