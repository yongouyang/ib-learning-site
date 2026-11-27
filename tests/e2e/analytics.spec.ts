import { test, expect, type Page } from '@playwright/test';
import { completeQuiz } from './quiz-session';

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

test.describe('analytics', () => {
  test('page view and performance metrics fire on navigation', async ({ page }) => {
    const events: Array<{ name: string; props: Record<string, unknown>; test?: boolean }> = [];
    await page.route('**/api/analytics/event', async (route) => {
      const payload = route.request().postDataJSON() as { name: string; props: Record<string, unknown>; test?: boolean };
      events.push(payload);
      await route.fulfill({ status: 204 });
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Master secondary school/ })).toBeVisible();

    await expect.poll(() => events.map((event) => event.name)).toContain('page_view');
    await expect.poll(() => events.some((event) => event.name === 'page_performance' && event.props.metric === 'TTFB')).toBe(true);
    await expect.poll(() => events.some((event) => event.name === 'page_performance' && event.props.metric === 'FCP')).toBe(true);
    await page.getByRole('heading', { name: /Master secondary school/ }).click();
    await expect.poll(() => events.some((event) => event.name === 'page_performance' && event.props.metric === 'LCP')).toBe(true);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => events.some((event) => event.name === 'page_performance' && event.props.metric === 'CLS')).toBe(true);
    expect(events.every((event) => event.test === true)).toBe(true);
    const performance = events.find((event) => event.name === 'page_performance');
    expect(performance?.props.value).toEqual(expect.any(Number));
    expect(performance?.props.rating).toMatch(/^(good|needs-improvement|poor)$/);
    expect(performance?.props.navigationType).toBe('navigate');
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
    await expect.poll(() => events).toContain('quiz_question_answered');
    await expect.poll(() => events).toContain('quiz_completed');
    await expect.poll(() => events.filter((name) => name === 'quiz_started').length).toBe(1);
  });

  test('opt-in journey events persist across real routes and are erased on opt-out', async ({ page }) => {
    await signIn(page, uniqueEmail());
    await page.goto('/account');
    const preference = page.getByLabel(/Learning journey analytics/);
    await expect(preference).not.toBeChecked();
    const enabledResponse = page.waitForResponse((response) =>
      response.url().endsWith('/api/auth/account') && response.request().method() === 'POST' && response.ok()
    );
    await preference.check();
    await enabledResponse;
    await expect(preference).toBeChecked();

    const quizStartedResponse = page.waitForResponse((response) => {
      if (!response.url().endsWith('/api/analytics/event') || response.request().method() !== 'POST') return false;
      return response.request().postDataJSON()?.name === 'quiz_started';
    });
    await page.goto('/subjects/math/math-algebra-1/quiz');
    await expect(page.getByRole('button').filter({ hasText: /^A\./ }).first()).toBeVisible();
    expect((await quizStartedResponse).status()).toBe(204);

    const readExport = () => page.evaluate(async () => {
      const response = await fetch('/api/auth/export', { credentials: 'same-origin' });
      return response.json() as Promise<{
        user: { userId: string };
        journeyEvents: Array<Record<string, unknown> & { name: string; userId: string }>;
      }>;
    });
    await expect.poll(async () => {
      const data = await readExport();
      return data.journeyEvents.some((event) => event.name === 'quiz_started');
    }).toBe(true);

    const exported = await readExport();
    expect(exported.journeyEvents.length).toBeGreaterThan(0);
    for (const event of exported.journeyEvents) {
      expect(event.userId).toBe(exported.user.userId);
      expect(event).not.toHaveProperty('email');
      expect(event).not.toHaveProperty('ip');
      expect(event).not.toHaveProperty('ua');
      expect(event).not.toHaveProperty('referrer');
      expect(event).not.toHaveProperty('textAnswer');
    }

    await page.goto('/account');
    const disabledResponse = page.waitForResponse((response) =>
      response.url().endsWith('/api/auth/account') && response.request().method() === 'POST' && response.ok()
    );
    await preference.uncheck();
    await disabledResponse;
    await expect(preference).not.toBeChecked();
    await expect.poll(async () => (await readExport()).journeyEvents.length).toBe(0);
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

  test('admin dashboard: breadcrumb goes back to Account, which re-enters the console', async ({ page }) => {
    // the Account crumb is hidden below sm by design (Breadcrumbs hideOnMobile), so the round-trip is a >=640px behaviour
    test.skip((page.viewportSize()?.width ?? 1280) < 640, 'Account crumb hidden below sm');
    await signIn(page, 'admin2@example.com'); // distinct admin per test — the dummy per-IP OTP budget is shared
    await page.goto('/admin/analytics');
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();

    // Back via the breadcrumb trail (was Home-only before the fix).
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Account' }).click();
    await expect(page).toHaveURL('/account');

    // The Admin console section on /account is the in-app re-entry path.
    await page.getByRole('link', { name: 'Analytics', exact: true }).click();
    await expect(page).toHaveURL('/admin/analytics');
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  });
});
