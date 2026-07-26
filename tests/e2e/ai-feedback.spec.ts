import { test, expect } from '@playwright/test';

// Phase 5: AI feedback UI. The e2e webServer runs with FEEDBACK_PROVIDER=dummy
// + FEEDBACK_TEST_MODE=1 (see playwright.config.ts), so tests exercise the REAL
// /api/feedback route with zero tokens. Per-case responses are injected by
// rewriting the outgoing POST body with `_testResponse` via page.route.
test.describe('AI feedback', () => {
  async function answerFirstQuestion(page: import('@playwright/test').Page) {
    await page.goto('/papers/math-y7/math-y7-set-1');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    await page.getByLabel(/Your answer/i).fill('I added the columns and got 933.');
    await page.getByRole('button', { name: /Check answer/i }).click();
    await expect(page.getByText('Model answer')).toBeVisible();
  }

  test('default dummy flow: marks all points and shows canned feedback', async ({ page }) => {
    await answerFirstQuestion(page);

    await page.getByRole('button', { name: /Mark with AI/i }).click();

    // Both points of q1 (2 marks) awarded by the dummy default.
    await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(2);
    await expect(page.getByText('Dummy marker: point awarded').first()).toBeVisible();
    await expect(page.getByText(/Dummy marker — configure FEEDBACK_API_KEY/)).toBeVisible();

    // Ticks feed the per-question tally.
    await expect(page.getByRole('button', { name: /Next Question \(2\/2 marks\)/ })).toBeVisible();
  });

  test('injected response: specific mark pattern, comments and feedback shown', async ({ page }) => {
    const injected = {
      marks: 0,
      perPoint: [
        { point: 'M1: correct column-addition method with at least one carry shown', awarded: true, comment: 'Method is clearly shown.' },
        { point: 'A1: $933$', awarded: false, comment: 'Final value is incorrect.' },
      ],
      feedback: 'Good method, but check the final addition carefully.',
    };
    await page.route('**/api/feedback', async (route) => {
      const request = route.request();
      if (request.method() !== 'POST') return route.continue();
      const body = request.postDataJSON() as Record<string, unknown>;
      body._testResponse = injected;
      const response = await route.fetch({ postData: JSON.stringify(body) });
      return route.fulfill({ response });
    });

    await answerFirstQuestion(page);
    await page.getByRole('button', { name: /Mark with AI/i }).click();

    // One point awarded, one not — exactly as injected.
    await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator('button[aria-pressed="false"]')).toHaveCount(1);
    await expect(page.getByText('Method is clearly shown.')).toBeVisible();
    await expect(page.getByText('Final value is incorrect.')).toBeVisible();
    await expect(page.getByText('Good method, but check the final addition carefully.')).toBeVisible();

    // Student can override the AI tick — self-marking stays the source of truth.
    await page.locator('button[aria-pressed="false"]').first().click();
    await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(2);
    await expect(page.getByRole('button', { name: /Next Question \(2\/2 marks\)/ })).toBeVisible();
  });

  test('malformed injected response: error banner, manual checklist still works', async ({ page }) => {
    await page.route('**/api/feedback', async (route) => {
      const request = route.request();
      if (request.method() !== 'POST') return route.continue();
      const body = request.postDataJSON() as Record<string, unknown>;
      body._testResponse = { marks: 0, perPoint: [], feedback: 'wrong length' };
      const response = await route.fetch({ postData: JSON.stringify(body) });
      return route.fulfill({ response });
    });

    await answerFirstQuestion(page);
    await page.getByRole('button', { name: /Mark with AI/i }).click();

    await expect(page.getByText(/AI marker is unavailable/)).toBeVisible();
    // Manual marking unaffected.
    await page.locator('button[aria-pressed="false"]').first().click();
    await expect(page.getByRole('button', { name: /Next Question \(1\/2 marks\)/ })).toBeVisible();
  });

  test('429 rate limit: friendly message, manual checklist still works', async ({ page }) => {
    await page.route('**/api/feedback', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      return route.fulfill({ status: 429, json: { error: 'Rate limit exceeded' } });
    });

    await answerFirstQuestion(page);
    await page.getByRole('button', { name: /Mark with AI/i }).click();

    await expect(page.getByText(/AI marker is busy/)).toBeVisible();
    await page.locator('button[aria-pressed="false"]').first().click();
    await expect(page.getByRole('button', { name: /Next Question \(1\/2 marks\)/ })).toBeVisible();
  });

  test('unconfigured provider: button hidden, self-marking unaffected', async ({ page }) => {
    await page.route('**/api/feedback', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ json: { configured: false } });
      }
      return route.continue();
    });

    await answerFirstQuestion(page);
    await expect(page.getByRole('button', { name: /Mark with AI/i })).toHaveCount(0);
    await page.locator('button[aria-pressed="false"]').first().click();
    await expect(page.getByRole('button', { name: /Next Question \(1\/2 marks\)/ })).toBeVisible();
  });
});
