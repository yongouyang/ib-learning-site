import { test, expect } from '@playwright/test';

// Phase 3: mock exams — index, overall-timer run, recorded result.
test.describe('Mock exams', () => {
  test('index lists all courses with their papers', async ({ page }) => {
    await page.goto('/exams');
    await expect(page.getByRole('heading', { name: 'Mock Exams', level: 1 })).toBeVisible();

    // 8 course cards; math courses have 2 papers, others 1 → 12 paper links.
    const papers = page.getByRole('link').filter({ hasText: /min · 20 questions/ });
    await expect(papers).toHaveCount(12);
    await expect(page.getByRole('heading', { name: 'Math — Year 7' })).toBeVisible();
    await expect(page.getByText('Paper 2 — extended response')).toBeVisible();
    // Fresh browser context → nothing attempted yet.
    await expect(page.getByText('Not attempted').first()).toBeVisible();
  });

  test('a full timed run shows the overall countdown and records the result', async ({ page }) => {
    await page.goto('/exams/math-y7/paper-1');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();

    // Overall (exam) countdown, not a per-question timer.
    await expect(page.getByText('Exam time remaining')).toBeVisible();
    await expect(page.getByText(/\d+:\d{2}/).first()).toBeVisible();

    // 20 questions; answer all with "A." (score doesn't matter for this test).
    for (let i = 0; i < 20; i++) {
      const choice = page.getByRole('button').filter({ hasText: /^A\./ }).first();
      await expect(choice).toBeVisible();
      await choice.click();
      const nextBtn = page.getByRole('button', { name: /Next Question|See Results/ });
      await expect(nextBtn).toBeVisible();
      await nextBtn.evaluate((el) => (el as HTMLElement).click());
      if (i < 19) {
        await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
      }
    }

    await expect(page.getByRole('heading', { name: 'Quiz Complete!' })).toBeVisible();

    // The result is recorded: the index now shows a best score for this paper.
    await page.goto('/exams');
    const paperRow = page.getByRole('link').filter({ hasText: /Paper 1/ }).first();
    await expect(paperRow.getByText(/Best: \d+%/)).toBeVisible();
    await expect(paperRow.getByText(/1 attempt/)).toBeVisible();
  });

  test('progress page links to mock exams', async ({ page }) => {
    await page.goto('/progress');
    await page.getByRole('link', { name: /Mock Exams/ }).click();
    await page.waitForURL('/exams');
    await expect(page.getByRole('heading', { name: 'Mock Exams', level: 1 })).toBeVisible();
  });

  test('course cards cross-link to their free-response sets', async ({ page }) => {
    await page.goto('/exams');
    const links = page.getByRole('link', { name: /— free-response/ });
    await expect(links).toHaveCount(8);
    await links.first().click();
    await page.waitForURL('**/papers/math-y7/math-y7-set-1');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
  });
});
