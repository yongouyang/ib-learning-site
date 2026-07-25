import { test, expect } from '@playwright/test';

// Phase 3: revision ladder — overview unlock states, level run + recording.
test.describe('Revision ladder', () => {
  test('overview shows level 1 unlocked and later levels locked on a fresh profile', async ({ page }) => {
    await page.goto('/exams/math-y7/ladder');
    await expect(page.getByRole('heading', { name: /Revision Ladder — Math — Year 7/, level: 1 })).toBeVisible();

    // Level 1 is a link; levels 2–5 are locked (no link, lock hint shown).
    await expect(page.getByRole('link', { name: /Level 1 — Warm-up/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Level 2/ })).toHaveCount(0);
    await expect(page.getByText(/Score ≥60% on Level 1 to unlock/)).toBeVisible();
    await expect(page.getByText(/Score ≥60% on Level 4 to unlock/)).toBeVisible();
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
    // Level 3 stays locked (level 2 not completed).
    await expect(page.getByRole('link', { name: /Level 3/ })).toHaveCount(0);
  });

  test('a locked level cannot be run directly', async ({ page }) => {
    await page.goto('/exams/math-y7/ladder/3');
    await expect(page.getByText(/This level is locked/)).toBeVisible();
  });

  test('exams index links to the ladder', async ({ page }) => {
    await page.goto('/exams');
    await page.getByRole('link', { name: /Revision Ladder — 5 levels/ }).first().click();
    await page.waitForURL('**/exams/math-y7/ladder');
    await expect(page.getByRole('heading', { name: /Revision Ladder/, level: 1 })).toBeVisible();
  });
});
