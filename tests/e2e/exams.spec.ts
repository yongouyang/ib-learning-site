import { test, expect } from '@playwright/test';
import { mockPremiumSession } from './premium-session';

// Phase 3 + E3: mock exams are the Premium "timed mock mode"
// (docs/entitlement-policy.md §Tier 2). Anonymous/free sessions see the
// LockedFeature tease; premium sessions (me() mocked — see premium-session.ts)
// run everything.
test.describe('Mock exams', () => {
  test('anonymous visitors see ONE page-level premium tease plus compact lock rows per course', async ({ page }) => {
    await page.goto('/exams');
    await expect(page.getByRole('heading', { name: 'Mock Exams', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Math — Year 7' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Geography — KS3' })).toBeVisible();

    // One page-level tease card (copy voice: say it once)…
    await expect(page.getByText('Timed mock mode').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'See Premium plans' })).toHaveCount(1);
    // …and a compact lock row per course (13 courses) instead of 13 full cards.
    await expect(page.getByRole('link', { name: /Premium · Timed mock mode/ })).toHaveCount(13);
    // The paper rows stay visible as an inert preview — not real links.
    await expect(page.getByRole('link').filter({ hasText: /min · 20 questions/ })).toHaveCount(0);
  });

  test('the direct mock URL is gated too, while practice set 1 stays free', async ({ page }) => {
    await page.goto('/exams/math-y7/paper-1');
    await expect(page.getByText('Timed mock mode')).toBeVisible();
    await expect(page.getByRole('link', { name: 'See Premium plans' })).toBeVisible();
    // A static summary stands in for the quiz: title visible, no ticking
    // countdown, no live question card.
    await expect(page.getByRole('heading', { level: 1, name: /Math — Year 7 · Paper 1/ })).toBeVisible();
    await expect(page.getByText(/30 min · 20 questions/)).toBeVisible();
    await expect(page.getByText('Exam time remaining')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(0);

    // First free-response set per course stays free and runnable (Tier-0/1).
    await page.goto('/papers/math-y7/math-y7-set-1');
    await expect(page.getByLabel(/Your answer/i)).toBeVisible();
    await expect(page.getByText('See Premium plans')).toHaveCount(0);
  });

  test('premium sessions see every mock unlocked and a full timed run records the result', async ({ page }) => {
    await mockPremiumSession(page);
    await page.goto('/exams');

    // 13 course cards; math courses have 2 papers, others 1 → 17 paper links,
    // and no tease cards anywhere.
    const papers = page.getByRole('link').filter({ hasText: /min · 20 questions/ });
    await expect(papers).toHaveCount(17);
    await expect(page.getByRole('link', { name: 'See Premium plans' })).toHaveCount(0);
    await expect(page.getByText('Paper 2 — extended response')).toBeVisible();
    // Fresh browser context → nothing attempted yet.
    await expect(page.getByText('Not attempted').first()).toBeVisible();

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
