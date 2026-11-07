import { test, expect } from '@playwright/test';
import { completeQuiz } from './quiz-session';

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
    await expect(allToggle).toHaveAttribute('aria-current', 'page');

    await weakToggle.click();
    await page.waitForURL('/mixed-review?mode=weak');
    await expect(page.getByRole('link', { name: /Weak areas/i })).toHaveAttribute('aria-current', 'page');

    await page.getByRole('link', { name: /All topics/i }).click();
    await page.waitForURL('/mixed-review');
  });

  test('opens weak-area custom tests from progress page', async ({ page }) => {
    await page.goto('/progress');
    const weakBtn = page.getByRole('link', { name: /Practise Weak Areas/i });
    await expect(weakBtn).toBeVisible();
    await weakBtn.click();
    await page.waitForURL('/custom-test?mode=weak');
    await expect(page.getByRole('heading', { name: 'Weak-area test' })).toBeVisible();
  });

  test('completes a mixed review and shows results', async ({ page }) => {
    const events: string[] = [];
    await page.route('**/api/analytics/event', async (route) => {
      events.push((route.request().postDataJSON() as { name: string }).name);
      await route.fulfill({ status: 204 });
    });
    await page.goto('/mixed-review');
    await completeQuiz(page);
    await expect.poll(() => events.filter((name) => name === 'quiz_question_answered').length).toBe(10);
    await expect.poll(() => events).toContain('quiz_completed');
  });
});
