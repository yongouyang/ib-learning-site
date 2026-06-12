import { test, expect } from '@playwright/test';

test.describe('Study page', () => {
  test('should render a DP math topic with notes, KaTeX formulas, and action links', async ({ page }) => {
    await page.goto('/subjects/math/math-dp-sequences/study');

    // Topic title should be visible
    await expect(page.getByRole('heading', { name: 'Sequences & Series', level: 1 })).toBeVisible();

    // At least one note heading should be visible
    await expect(page.getByRole('heading', { name: 'Arithmetic Sequences and Series' })).toBeVisible();
    await expect(page.locator('h2').first()).toBeVisible();

    // KaTeX should have rendered LaTeX formulas in the notes
    await expect(page.locator('.katex').first()).toBeVisible({ timeout: 10000 });

    // Study-mode action links should be present
    await expect(page.getByRole('link', { name: /Study Flashcards/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Take Quiz/i })).toBeVisible();
  });
});
