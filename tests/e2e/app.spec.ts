import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('should show the subject grid', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'IBLearn' })).toBeVisible();

    // 5 subject cards — use heading within links
    await expect(page.getByRole('heading', { name: 'Subjects' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Math' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'English' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Biology' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Chemistry' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Physics' })).toBeVisible();
  });

  test('should navigate to a subject', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'Math' }).click();
    await expect(page.getByRole('heading', { name: 'Math' })).toBeVisible();
    // Topic titles visible
    await expect(page.getByText('Written Calculations')).toBeVisible();
  });

  test('should navigate to progress from nav', async ({ page }) => {
    await page.goto('/progress');
    await expect(page.getByRole('heading', { name: 'My Progress' })).toBeVisible();
    await expect(page.getByText('Total Stars')).toBeVisible();
  });
});

test.describe('Quiz flow', () => {
  test('should complete a full quiz and show results', async ({ page }) => {
    await page.goto('/subjects/math/math-yr7-calculations/quiz');

    // Answer all questions (the topic has 10 questions)
    for (let i = 0; i < 10; i++) {
      // Click the first choice
      await page.locator('button').filter({ hasText: 'A.' }).first().click();

      // Click next or see results
      const nextBtn = page.getByRole('button', { name: /Next Question|See Results/ });
      await nextBtn.click();
    }

    // Should see results page
    await expect(page.getByRole('heading', { name: 'Quiz Complete!' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to Topics' })).toBeVisible();
  });
});

test.describe('Progress page', () => {
  test('should show stats cards', async ({ page }) => {
    await page.goto('/progress');
    await expect(page.getByRole('heading', { name: 'My Progress' })).toBeVisible();
    await expect(page.getByText('Total Stars')).toBeVisible();
    await expect(page.getByText('Day Streak')).toBeVisible();
    await expect(page.getByText('Topics Done')).toBeVisible();
  });
});
