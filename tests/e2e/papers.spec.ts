import { test, expect } from '@playwright/test';

// Phase 4: free-response practice papers — index, self-marking flow, recorded result.
test.describe('Practice papers', () => {
  test('index lists the pilot set with marks and duration', async ({ page }) => {
    await page.goto('/papers');
    await expect(page.getByRole('heading', { name: 'Practice Papers', level: 1 })).toBeVisible();
    const setLink = page.getByRole('link', { name: /Practice Set 1/ });
    await expect(setLink).toBeVisible();
    await expect(setLink.getByText(/30 min · 8 questions · 20 marks/)).toBeVisible();
    await expect(setLink.getByText('Not attempted')).toBeVisible();
  });

  test('a full self-marking run records the result', async ({ page }) => {
    await page.goto('/papers/math-y7/math-y7-set-1');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();

    // 8 questions; write an answer, reveal the markscheme, tick every point.
    for (let i = 0; i < 8; i++) {
      // Marks badge and difficulty chip are visible on each question.
      await expect(page.getByText(/\d marks?/).first()).toBeVisible();

      await page.getByLabel(/Your answer/i).fill('My worked answer.');
      await page.getByRole('button', { name: /Check answer/i }).click();

      // Model answer appears, then tick every markscheme point (full marks).
      await expect(page.getByText('Model answer')).toBeVisible();
      const points = page.locator('button[aria-pressed="false"]');
      const count = await points.count();
      for (let j = 0; j < count; j++) {
        await page.locator('button[aria-pressed="false"]').first().click();
      }

      const nextBtn = page.getByRole('button', { name: /Next Question|See Results/ });
      await expect(nextBtn).toBeVisible();
      await nextBtn.click();
      if (i < 7) {
        await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
      }
    }

    // Full marks: 20/20 = 100%.
    await expect(page.getByRole('heading', { name: 'Paper Complete!' })).toBeVisible();
    await expect(page.getByText('100%')).toBeVisible();
    await expect(page.getByText('20 out of 20 marks')).toBeVisible();

    // Recorded: index shows a best score for the set.
    await page.goto('/papers');
    const setLink = page.getByRole('link', { name: /Practice Set 1/ });
    await expect(setLink.getByText('Best: 100%')).toBeVisible();
  });

  test('progress page links to practice papers', async ({ page }) => {
    await page.goto('/progress');
    await page.getByRole('link', { name: /Practice Papers/ }).click();
    await page.waitForURL('/papers');
    await expect(page.getByRole('heading', { name: 'Practice Papers', level: 1 })).toBeVisible();
  });
});
