import { test, expect } from '@playwright/test';

test.describe('Mixed review', () => {
  test('loads random mixed review and shows a question', async ({ page }) => {
    await page.goto('/mixed-review');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(page.getByRole('button').filter({ hasText: /^A\./ }).first()).toBeVisible();
    await expect(page.getByText('← Back')).toBeVisible();
  });

  test('loads weak-area mixed review from progress page', async ({ page }) => {
    await page.goto('/progress');
    const weakBtn = page.getByRole('link', { name: /Practice Weak Areas/i });
    await expect(weakBtn).toBeVisible();
    await weakBtn.click();
    await page.waitForURL('/mixed-review?mode=weak');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
  });

  test('completes a mixed review and shows results', async ({ page }) => {
    await page.goto('/mixed-review');
    for (let i = 0; i < 10; i++) {
      const choice = page.getByRole('button').filter({ hasText: /^A\./ }).first();
      await expect(choice).toBeVisible();
      await choice.click();
      const nextBtn = page.getByRole('button', { name: /Next Question|See Results/ });
      await expect(nextBtn).toBeVisible();
      await nextBtn.click();
    }
    await expect(page.getByRole('heading', { name: 'Quiz Complete!' })).toBeVisible();
  });
});
