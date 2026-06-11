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

test.describe('Subject pages', () => {
  test('math subject page should show DP-level topics', async ({ page }) => {
    await page.goto('/subjects/math');
    await expect(page.getByRole('heading', { name: 'Math' })).toBeVisible();
    // A DP topic should be visible
    await expect(page.getByText('Sequences & Series')).toBeVisible();
    // An MYP topic should also be visible
    await expect(page.getByText('Algebra Basics')).toBeVisible();
  });

  test('biology subject page should show 5 topics', async ({ page }) => {
    await page.goto('/subjects/biology');
    await expect(page.getByText('Cell Structure')).toBeVisible();
    await expect(page.getByText('Genetics & Inheritance')).toBeVisible();
    await expect(page.getByText('Ecology & Ecosystems')).toBeVisible();
  });
});

test.describe('Quiz flow', () => {
  test('should complete a full MYP quiz and show results', async ({ page }) => {
    await page.goto('/subjects/math/math-yr7-calculations/quiz');

    // Answer all questions (the topic has 10 questions)
    for (let i = 0; i < 10; i++) {
      await page.locator('button').filter({ hasText: 'A.' }).first().click();
      const nextBtn = page.getByRole('button', { name: /Next Question|See Results/ });
      await nextBtn.click();
    }

    // Should see results page
    await expect(page.getByRole('heading', { name: 'Quiz Complete!' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to Topics' })).toBeVisible();
  });

  test('should load a DP-level quiz page', async ({ page }) => {
    await page.goto('/subjects/math/math-dp-sequences/quiz');
    // Quiz page should have a question stem heading visible
    await expect(page.getByRole('heading').first()).toBeVisible();
    // Should have choice buttons with A., B., etc.
    await expect(page.locator('button').filter({ hasText: 'A.' }).first()).toBeVisible();
    // Should have a back link
    await expect(page.getByText('← Back')).toBeVisible();
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
