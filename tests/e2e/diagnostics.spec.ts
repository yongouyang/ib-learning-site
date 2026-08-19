import { test, expect } from '@playwright/test';

// Phase 2: diagnostics — index, a full run, and weak-area seeding.
test.describe('Diagnostics', () => {
  test('index lists the 13 course diagnostics', async ({ page }) => {
    await page.goto('/diagnostics');
    await expect(page.getByRole('heading', { name: 'Diagnostic Tests', level: 1 })).toBeVisible();

    const links = page.getByRole('link', { name: /questions · \d+ topics/ });
    await expect(links).toHaveCount(13);
    await expect(page.getByRole('link', { name: /Math — Year 7/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Geography — KS3/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /DP Applications & Interpretation/ })).toBeVisible();
  });

  test('homepage hero shows the diagnostic CTA for first-time visitors', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Master secondary school/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Start with a free diagnostic/ })).toBeVisible();
    await page.getByRole('link', { name: /Start with a free diagnostic/ }).click();
    await page.waitForURL('/diagnostics');
    await expect(page.getByRole('heading', { name: 'Diagnostic Tests', level: 1 })).toBeVisible();
  });

  test('a full diagnostic run seeds the weak-areas system', async ({ page }) => {
    await page.goto('/diagnostics/math-y7');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();

    // The math-y7 diagnostic has 15 questions across 15 topics.
    const totalQuestions = 15;
    for (let i = 0; i < totalQuestions; i++) {
      // Always pick "A." — with per-topic 1-question attempts, every wrong
      // answer drops that topic below the 70% weak-area threshold.
      const choice = page.getByRole('button').filter({ hasText: /^A\./ }).first();
      await expect(choice).toBeVisible();
      await choice.click();

      const nextBtn = page.getByRole('button', { name: /Next Question|See Results/ });
      await expect(nextBtn).toBeVisible();
      await nextBtn.evaluate((el) => (el as HTMLElement).click());

      if (i < totalQuestions - 1) {
        await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
      }
    }

    await expect(page.getByRole('heading', { name: 'Quiz Complete!' })).toBeVisible();

    // Weak areas seeded: the homepage "Needs Practice" card appears with topics
    // from the diagnostic, and links into weak-mode mixed review.
    await page.goto('/');
    const card = page.getByText('Needs Practice');
    await expect(card).toBeVisible();
    await expect(page.getByRole('link', { name: /Practise all weak areas in mixed review/ })).toBeVisible();
  });
});
