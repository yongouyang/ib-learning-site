import { test, expect } from '@playwright/test';

// Phase 5: AI feedback UI. The e2e webServer runs with FEEDBACK_PROVIDER=dummy
// + FEEDBACK_TEST_MODE=1 (see playwright.config.ts), so tests exercise the REAL
// /api/feedback route with zero tokens. Per-case responses are injected by
// rewriting the outgoing POST body with `_testResponse` via page.route.
//
// Phase E2: POST /api/feedback requires a session, so the marking tests sign
// in first — AUTH_STORAGE/AUTH_EMAIL=dummy + AUTH_TEST_MODE=1 give the
// deterministic code 123456 for any email (the auth.spec.ts pattern), and the
// feedback quota lives in the SAME shared dummy universe.

function uniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(uniqueEmail());
  await page.getByRole('button', { name: 'Send sign-in code' }).click();
  await expect(page.getByText(/Enter the 6-digit code/)).toBeVisible();
  await page.getByLabel('6-digit code').fill('123456');
  await page.getByRole('button', { name: 'Verify code' }).click();
  await expect(page).toHaveURL('/');
}

test.describe('AI feedback', () => {
  // Answer q1, click through the rest of the answering phase, submit — the
  // untimed review phase (with the AI button) starts back at q1.
  async function answerFirstQuestionAndEnterReview(page: import('@playwright/test').Page) {
    await page.goto('/papers/math-y7/math-y7-set-1');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    await page.getByLabel(/Your answer/i).fill('I added the columns and got 933.');
    // 8 questions in this set: 7 Next clicks reach the last one. Settle on
    // the progress label each time — the card animates between questions.
    for (let i = 0; i < 7; i++) {
      await page.getByRole('button', { name: /Next Question/i }).click();
      await expect(page.getByText(`${i + 2}/8`, { exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: /Submit & Review/i }).click();
    await expect(page.getByText('Model answer')).toBeVisible();
  }

  test('default dummy flow: marks all points and shows canned feedback', async ({ page }) => {
    await signIn(page);
    await answerFirstQuestionAndEnterReview(page);

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

    await signIn(page);
    await answerFirstQuestionAndEnterReview(page);
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

    await signIn(page);
    await answerFirstQuestionAndEnterReview(page);
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

    await signIn(page);
    await answerFirstQuestionAndEnterReview(page);
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

    await answerFirstQuestionAndEnterReview(page);
    await expect(page.getByRole('button', { name: /Mark with AI/i })).toHaveCount(0);
    await page.locator('button[aria-pressed="false"]').first().click();
    await expect(page.getByRole('button', { name: /Next Question \(1\/2 marks\)/ })).toBeVisible();
  });
});
