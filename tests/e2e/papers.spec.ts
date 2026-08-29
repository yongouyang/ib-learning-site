import { test, expect } from '@playwright/test';

// Phase 4: free-response practice papers — index, self-marking flow, recorded result.
test.describe('Practice papers', () => {
  test('index lists the pilot set with marks and duration', async ({ page }) => {
    await page.goto('/papers');
    await expect(page.getByRole('heading', { name: 'Practice Papers', level: 1 })).toBeVisible();
    const setLink = page.locator('a[href="/papers/math-y7/math-y7-set-1"]');
    await expect(setLink).toBeVisible();
    await expect(setLink.getByText(/30 min · 8 questions · 20 marks/)).toBeVisible();
    await expect(setLink.getByText('Not attempted')).toBeVisible();
    // All 13 courses have two sets — set 1 free, set 2 behind the premium lock
    // (Phase E3): 26 set rows in the DOM.
    await expect(page.locator('a[href^="/papers/"]')).toHaveCount(26);

    // Set 2 renders as a locked row for anonymous visitors: the preview links
    // exist in the DOM (one per course) but are inert/aria-hidden, so they are
    // NOT accessible links, and each course gets a premium tease card.
    await expect(page.locator('a[href$="-set-2"]')).toHaveCount(13);
    await expect(page.getByRole('link', { name: /Practice Set 2/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'See Premium plans' })).toHaveCount(13);
  });

  test('a full two-phase run records the result', async ({ page }) => {
    await page.goto('/papers/math-y7/math-y7-set-1');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();

    // Timed answering phase: write an answer per question, free navigation.
    // 8 questions; the last one shows "Submit & Review" instead of Next.
    for (let i = 0; i < 8; i++) {
      // Marks badge and difficulty chip are visible on each question.
      await expect(page.getByText(/\d marks?/).first()).toBeVisible();

      await page.getByLabel(/Your answer/i).fill('My worked answer.');
      const nextBtn = page.getByRole('button', { name: /Next Question/i });
      if (await nextBtn.count()) {
        await nextBtn.click();
        // The old card exits before the new one mounts (AnimatePresence
        // mode="wait") — wait for a fresh, empty textarea before filling.
        await expect(page.getByLabel(/Your answer/i)).toHaveValue('');
      }
    }
    await page.getByRole('button', { name: /Submit & Review/i }).click();

    // Untimed review phase: the clock is gone; tick every point (full marks).
    await expect(page.getByText('Model answer')).toBeVisible();
    await expect(page.getByText(/Time remaining/)).toHaveCount(0);
    for (let i = 0; i < 8; i++) {
      // Wait for this question's unticked points to mount (card animation),
      // then tick them one at a time, confirming each state flip.
      await expect(page.locator('button[aria-pressed="false"]').first()).toBeVisible();
      let remaining = await page.locator('button[aria-pressed="false"]').count();
      while (remaining > 0) {
        await page.locator('button[aria-pressed="false"]').first().click();
        remaining--;
        await expect(page.locator('button[aria-pressed="false"]')).toHaveCount(remaining);
      }

      const nextBtn = page.getByRole('button', { name: /Next Question|See Results/ });
      await expect(nextBtn).toBeVisible();
      await nextBtn.click();
    }

    // Full marks: 20/20 = 100%.
    await expect(page.getByRole('heading', { name: 'Paper Complete!' })).toBeVisible();
    await expect(page.getByText('100%')).toBeVisible();
    await expect(page.getByText('20 out of 20 marks')).toBeVisible();

    // Recorded: index shows a best score for the set.
    await page.goto('/papers');
    const setLink = page.locator('a[href="/papers/math-y7/math-y7-set-1"]');
    await expect(setLink.getByText('Best: 100%')).toBeVisible();
  });

  test('progress page links to practice papers', async ({ page }) => {
    await page.goto('/progress');
    await page.getByRole('link', { name: /Practice Papers/ }).click();
    await page.waitForURL('/papers');
    await expect(page.getByRole('heading', { name: 'Practice Papers', level: 1 })).toBeVisible();
  });
});
