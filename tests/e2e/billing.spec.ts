import { test, expect, type Page } from '@playwright/test';

// E4.3 billing UI: the Checkout/Portal wiring on /pricing and /account.
//
// Stripe itself is never contacted. Two of the three states are reached by route
// interception (the established `premium-session.ts` "me()/API mock" escape
// hatch) so the UI's DECISION logic is what's under test: which action each
// billing state offers, where a refusal sends the user, and that the request
// payload is the one the API expects. The real end-to-end (dummy Stripe client
// → webhook → tier flip) is covered by the unit suites and the deployed
// signed-webhook probe.

function uniqueEmail() {
  return `billing-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(uniqueEmail());
  await page.getByRole('button', { name: 'Send sign-in code' }).click();
  await expect(page.getByText(/Enter the 6-digit code/)).toBeVisible();
  await page.getByLabel('6-digit code').fill('123456');
  await page.getByRole('button', { name: 'Verify code' }).click();
  await expect(page).toHaveURL('/');
}

const FREE_STATUS = {
  plan: null,
  status: null,
  tier: 'free',
  billingAvailable: true,
  currentPeriodEnd: null,
  trialEndsAt: null,
  cancelAtPeriodEnd: false,
  card: null,
};

test.describe('billing UI (E4.3)', () => {
  test('signed out: pricing asks you to sign in instead of offering plans', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByRole('link', { name: /sign in to see your plan/i })).toHaveAttribute(
      'href',
      '/login?next=/pricing'
    );
    await expect(page.getByRole('button', { name: /\$20 per month/i })).toHaveCount(0);
  });

  test('signed in: choosing a plan posts it to Checkout and follows Stripe', async ({ page }) => {
    await signIn(page);

    // Stub billing state and Checkout so no real Stripe call happens; the
    // returned URL points back at our own origin so navigation is observable.
    await page.route('**/api/subscriptions/status', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FREE_STATUS) })
    );
    let posted: unknown = null;
    await page.route('**/api/subscriptions/checkout', async (route) => {
      posted = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: '/pricing?checkout=stubbed' }),
      });
    });

    await page.goto('/pricing');
    await page.getByRole('button', { name: /\$200 per year/i }).click();

    await expect(page).toHaveURL(/checkout=stubbed/);
    expect(posted).toEqual({ plan: 'annual' });
  });

  test('signed in on a trialing plan: /account shows the trial and opens the Portal', async ({ page }) => {
    await signIn(page);

    await page.route('**/api/subscriptions/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...FREE_STATUS,
          plan: 'monthly',
          status: 'trialing',
          tier: 'premium',
          trialEndsAt: '2026-09-27T02:17:13.000Z',
          card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2034 },
        }),
      })
    );
    let portalCalled = false;
    await page.route('**/api/subscriptions/portal', async (route) => {
      portalCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: '/account?portal=stubbed' }),
      });
    });

    await page.goto('/account');
    await expect(page.getByText(/Monthly — free trial/i)).toBeVisible();
    await expect(page.getByText(/First charge 27 September 2026/)).toBeVisible();
    await expect(page.getByText(/Visa ending 4242/)).toBeVisible();

    await page.getByRole('button', { name: /manage billing/i }).click();
    await expect(page).toHaveURL(/portal=stubbed/);
    expect(portalCalled).toBe(true);
  });

  test('billing not configured: pricing says so rather than offering a dead button', async ({ page }) => {
    await signIn(page);
    await page.route('**/api/subscriptions/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...FREE_STATUS, billingAvailable: false }),
      })
    );

    await page.goto('/pricing');
    await expect(page.getByText(/not taking payments yet/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /\$20 per month/i })).toHaveCount(0);
  });
});
