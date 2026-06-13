import { test, expect } from '@playwright/test';

test.describe('Theme toggle', () => {
  test('cycles through light, dark, and system themes', async ({ page }) => {
    // Fix the system preference so "system" resolves to dark.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');

    const toggle = page.getByRole('button', { name: /Current theme:/i });
    await expect(toggle).toBeVisible();

    // System (dark) → light
    await toggle.click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // Light → dark
    await toggle.click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Dark → system (which is dark)
    await toggle.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('applies dark mode styles to the page', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');

    const toggle = page.getByRole('button', { name: /Current theme:/i });
    // Cycle: system (light) → light → dark
    await toggle.click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await toggle.click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    const body = page.locator('body');
    const bgColor = await body.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    // Tailwind gray-950 is rgb(3, 7, 18)
    expect(bgColor).toBe('rgb(3, 7, 18)');
  });
});
