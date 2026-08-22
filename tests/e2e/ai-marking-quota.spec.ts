import { test, expect } from '@playwright/test';

// Phase E2: AI-marking login gate + 30/month durable quota.
// The webServer runs FEEDBACK_PROVIDER=dummy, FEEDBACK_TEST_MODE=1 and
// FEEDBACK_STORAGE=dummy (playwright.config.ts), so the REAL /api/feedback
// route runs against the shared in-memory universe: a dummy-OTP login (code
// 123456, the auth.spec.ts pattern) resolves for /api/feedback, and the
// _testAiMarkUsed/_testTier POST-body injections (test-mode + dummy storage
// only) force quota states without 30 real marks.

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

// Answer q1, click through, submit — review phase starts back at q1 (the
// ai-feedback.spec.ts helper, duplicated so each spec stays self-contained).
async function answerFirstQuestionAndEnterReview(page: import('@playwright/test').Page) {
  await page.goto('/papers/math-y7/math-y7-set-1');
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
  await page.getByLabel(/Your answer/i).fill('I added the columns and got 933.');
  for (let i = 0; i < 7; i++) {
    await page.getByRole('button', { name: /Next Question/i }).click();
    await expect(page.getByText(`${i + 2}/8`, { exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: /Submit & Review/i }).click();
  await expect(page.getByText('Model answer')).toBeVisible();
}

test.describe('AI marking gate + quota (E2)', () => {
  test('logged out: sign-in prompt instead of the button, self-marking unaffected', async ({ page }) => {
    await answerFirstQuestionAndEnterReview(page);

    await expect(page.getByRole('button', { name: /Mark with AI/i })).toHaveCount(0);
    const prompt = page.getByRole('link', { name: /Sign in to use AI marking — 30 free marks\/month/i });
    await expect(prompt).toBeVisible();
    await expect(prompt).toHaveAttribute('href', '/login');

    // Self-marking stays available in every state.
    await page.locator('button[aria-pressed="false"]').first().click();
    await expect(page.getByRole('button', { name: /Next Question \(1\/2 marks\)/ })).toBeVisible();
  });

  test('logged in: quota decrements after a successful mark', async ({ page }) => {
    await signIn(page);
    await answerFirstQuestionAndEnterReview(page);

    // The GET quota state renders before any mark.
    await expect(page.getByText('30 marks left this month')).toBeVisible();

    await page.getByRole('button', { name: /Mark with AI/i }).click();
    await expect(page.getByText(/Dummy marker — configure FEEDBACK_API_KEY/)).toBeVisible();
    await expect(page.getByText('29 marks left this month')).toBeVisible();
  });

  test('quota exhausted: premium tease with pricing link, self-marking unaffected', async ({ page }) => {
    await signIn(page);
    // Force the account's monthly counter to the free limit (test-mode
    // injection — no 30 real marks needed).
    await page.route('**/api/feedback', async (route) => {
      const request = route.request();
      if (request.method() !== 'POST') return route.continue();
      const body = request.postDataJSON() as Record<string, unknown>;
      body._testAiMarkUsed = 30;
      const response = await route.fetch({ postData: JSON.stringify(body) });
      return route.fulfill({ response });
    });
    await answerFirstQuestionAndEnterReview(page);

    await page.getByRole('button', { name: /Mark with AI/i }).click();

    await expect(page.getByText(/used all 30 free AI marks this month/)).toBeVisible();
    const upgrade = page.getByRole('link', { name: /See Premium plans/i });
    await expect(upgrade).toBeVisible();
    await expect(upgrade).toHaveAttribute('href', '/pricing');

    // Self-marking stays available in every state.
    await page.locator('button[aria-pressed="false"]').first().click();
    await expect(page.getByRole('button', { name: /Next Question \(1\/2 marks\)/ })).toBeVisible();
  });

  test('premium tier: the free-30 limit does not apply (test-mode tier injection)', async ({ page }) => {
    await signIn(page);
    // Counter at the FREE limit, but the session is treated as premium —
    // the 1000/month safety cap applies instead, so the mark goes through.
    await page.route('**/api/feedback', async (route) => {
      const request = route.request();
      if (request.method() !== 'POST') return route.continue();
      const body = request.postDataJSON() as Record<string, unknown>;
      body._testAiMarkUsed = 30;
      body._testTier = 'premium';
      const response = await route.fetch({ postData: JSON.stringify(body) });
      return route.fulfill({ response });
    });
    await answerFirstQuestionAndEnterReview(page);

    await page.getByRole('button', { name: /Mark with AI/i }).click();
    await expect(page.getByText(/Dummy marker — configure FEEDBACK_API_KEY/)).toBeVisible();
    await expect(page.getByText(/used all 30 free AI marks/)).toHaveCount(0);
  });
});
