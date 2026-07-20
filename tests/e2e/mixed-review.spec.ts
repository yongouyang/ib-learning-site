import { test, expect } from '@playwright/test';

test.describe('Mixed review', () => {
  test('loads random mixed review and shows a question', async ({ page }) => {
    await page.goto('/mixed-review');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(page.getByRole('button').filter({ hasText: /^A\./ }).first()).toBeVisible();
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByText('Mixed Review')).toBeVisible();
  });

  test('mode toggle switches between weak areas and all topics', async ({ page }) => {
    await page.goto('/mixed-review');
    const weakToggle = page.getByRole('link', { name: /Weak areas/i });
    const allToggle = page.getByRole('link', { name: /All topics/i });
    await expect(weakToggle).toBeVisible();
    await expect(allToggle).toBeVisible();
    await expect(allToggle).toHaveAttribute('aria-pressed', 'true');

    await weakToggle.click();
    await page.waitForURL('/mixed-review?mode=weak');
    await expect(page.getByRole('link', { name: /Weak areas/i })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('link', { name: /All topics/i }).click();
    await page.waitForURL('/mixed-review');
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
