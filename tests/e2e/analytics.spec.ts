import { test, expect, type Page } from '@playwright/test';

// Phase A (analytics) e2e — docs/phase-a-analytics-plan.md §A7. The webServer
// runs with ANALYTICS_STORAGE=dummy (shared universe with auth, so the
// dummy-OTP session resolves for /summary), ANALYTICS_ADMIN_EMAILS=
// admin@example.com, and AUTH_TEST_MODE=1 (deterministic code 123456) — see
// playwright.config.ts. Real routes, in-memory storage.

function uniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send sign-in code' }).click();
  await expect(page.getByText(/Enter the 6-digit code/)).toBeVisible();
  await page.getByLabel('6-digit code').fill('123456');
  await page.getByRole('button', { name: 'Verify code' }).click();
  await expect(page).toHaveURL('/');
}

/** Answer every question by picking choice A; exits on the results screen. */
async function completeQuiz(page: Page) {
  for (let i = 0; i < 15; i++) {
    const choice = page.getByRole('button').filter({ hasText: /^A\./ }).first();
    if (await choice.isVisible()) await choice.click();
    const nextBtn = page.getByRole('button', { name: /Next Question|See Results/ });
    if (!(await nextBtn.isVisible())) break; // results screen
    await nextBtn.click();
  }
  await expect(page.getByRole('heading', { name: 'Quiz Complete!' })).toBeVisible();
}

test.describe('analytics', () => {
  test('page_view fires on navigation', async ({ page }) => {
    const events: string[] = [];
    await page.route('**/api/analytics/event', async (route) => {
      const payload = route.request().postDataJSON() as { name: string };
      events.push(payload.name);
      await route.fulfill({ status: 204 });
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Master secondary school/ })).toBeVisible();

    await expect.poll(() => events).toContain('page_view');
  });

  test('quiz flow fires quiz_started and quiz_completed', async ({ page }) => {
    const events: string[] = [];
    await page.route('**/api/analytics/event', async (route) => {
      const payload = route.request().postDataJSON() as { name: string };
      events.push(payload.name);
      await route.fulfill({ status: 204 });
    });

    await page.goto('/subjects/math/math-algebra-1/quiz');
    await expect(page.getByRole('button').filter({ hasText: /^A\./ }).first()).toBeVisible();
    await completeQuiz(page);

    await expect.poll(() => events).toContain('quiz_started');
    await expect.poll(() => events).toContain('quiz_completed');
  });

  test('admin dashboard: logged out shows the sign-in prompt', async ({ page }) => {
    await page.goto('/admin/analytics');
    await expect(page.getByText('Sign in to view analytics.')).toBeVisible();
  });

  test('admin dashboard: non-admin gets not authorized', async ({ page }) => {
    await signIn(page, uniqueEmail()); // not in the ANALYTICS_ADMIN_EMAILS allowlist
    await page.goto('/admin/analytics');
    await expect(page.getByText(/have access to analytics/)).toBeVisible();
  });

  test('admin dashboard: admin sees the dashboard', async ({ page }) => {
    await signIn(page, 'admin@example.com');
    await page.goto('/admin/analytics');
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
    await expect(page.getByText('Traffic by day')).toBeVisible();
  });
});
