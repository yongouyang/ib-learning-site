import { test, expect, type Page } from '@playwright/test';

// Phase B (accounts): the webServer runs with AUTH_STORAGE/AUTH_EMAIL=dummy and
// AUTH_TEST_MODE=1 (see playwright.config.ts), so the real /api/auth/* routes run
// against in-memory storage with the deterministic code 123456 for any email.

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

test.describe('auth', () => {
  test('login signs in and persists across reload', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop header flow');
    await signIn(page, uniqueEmail());

    const trigger = page.locator('header').getByRole('button', { name: 'Me', exact: true });
    await expect(trigger).toBeVisible();

    await page.reload();
    await expect(page.locator('header').getByRole('button', { name: 'Me', exact: true })).toBeVisible();
  });

  test('a signed-in visitor hitting /login?next= is sent straight to next', async ({ page }) => {
    await signIn(page, uniqueEmail()); // lands on /
    await page.goto('/login?next=%2Fpricing');
    await expect(page).toHaveURL('/pricing');
  });

  test('?next= returns the user to the calling page after sign-in', async ({ page }) => {
    await page.goto('/login?next=%2Fpricing');
    await page.getByLabel('Email').fill(uniqueEmail());
    await page.getByRole('button', { name: 'Send sign-in code' }).click();
    await expect(page.getByText(/Enter the 6-digit code/)).toBeVisible();
    await page.getByLabel('6-digit code').fill('123456');
    await page.getByRole('button', { name: 'Verify code' }).click();
    await expect(page).toHaveURL('/pricing');
  });

  test('unsafe ?next= values fall back to the home page', async ({ page }) => {
    // Protocol-relative open-redirect attempt must be rejected.
    await page.goto('/login?next=%2F%2Fevil.example%2Fphish');
    await page.getByLabel('Email').fill(uniqueEmail());
    await page.getByRole('button', { name: 'Send sign-in code' }).click();
    await expect(page.getByText(/Enter the 6-digit code/)).toBeVisible();
    await page.getByLabel('6-digit code').fill('123456');
    await page.getByRole('button', { name: 'Verify code' }).click();
    await expect(page).toHaveURL('/');
  });

  test('header sign-in link carries the current page as next', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop header flow');
    await page.goto('/pricing');
    await page.locator('header').getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fpricing/);

    await page.getByLabel('Email').fill(uniqueEmail());
    await page.getByRole('button', { name: 'Send sign-in code' }).click();
    await expect(page.getByText(/Enter the 6-digit code/)).toBeVisible();
    await page.getByLabel('6-digit code').fill('123456');
    await page.getByRole('button', { name: 'Verify code' }).click();
    await expect(page).toHaveURL('/pricing');
  });

  test('wrong code shows an error and stays on the code step', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(uniqueEmail());
    await page.getByRole('button', { name: 'Send sign-in code' }).click();
    await expect(page.getByText(/Enter the 6-digit code/)).toBeVisible();

    await page.getByLabel('6-digit code').fill('000000');
    await page.getByRole('button', { name: 'Verify code' }).click();

    await expect(page.getByText('Invalid or expired code.')).toBeVisible();
    await expect(page.getByLabel('6-digit code')).toBeVisible();
  });

  test('sign out returns to logged-out state and /account redirects', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop header flow');
    await signIn(page, uniqueEmail());

    await page.locator('header').getByRole('button', { name: 'Me', exact: true }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.locator('header').getByRole('link', { name: 'Sign in' })).toBeVisible();

    await page.goto('/account');
    await expect(page).toHaveURL(/\/login/);
  });

  test('profile picker and account settings update the header', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop header flow');
    await signIn(page, uniqueEmail());

    // Add a profile.
    await page.goto('/account');
    // The Leaderboard section also renders profile names/stages — scope
    // profile-list assertions to the Child profiles section.
    const childProfiles = page.locator('section', { has: page.getByRole('heading', { name: 'Child profiles' }) });
    await page.getByLabel('Name', { exact: true }).fill('Alex');
    await page.getByLabel('Stage').selectOption('igcse');
    await page.getByRole('button', { name: 'Add profile' }).click();
    await expect(childProfiles.getByText('Alex', { exact: true })).toBeVisible();

    // Switch to it from the header menu → trigger label updates.
    await page.locator('header').getByRole('button', { name: 'Me', exact: true }).click();
    await page.locator('#account-menu').getByRole('button', { name: /Alex/ }).click();
    await expect(page.locator('header').getByRole('button', { name: 'Alex' })).toBeVisible();

    // Edit the active profile (name + stage) from account settings → header
    // and the stage badge reflect the changes.
    await page.goto('/account');
    await page.getByRole('button', { name: 'Edit Alex' }).click();
    await page.getByLabel('Edit Alex').fill('Parent One');
    await page.getByLabel('Stage for Alex').selectOption('dp');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('header').getByRole('button', { name: 'Parent One' })).toBeVisible();
    await expect(childProfiles.locator('li', { hasText: 'Parent One' }).getByText('IB DP', { exact: true })).toBeVisible();
  });

  test('sessions list shows the current device with no revoke on it', async ({ page }) => {
    await signIn(page, uniqueEmail());
    await page.goto('/account');

    await expect(page.getByText('This device')).toBeVisible();
    const currentRow = page.locator('li', { hasText: 'This device' });
    await expect(currentRow.getByRole('button', { name: 'Revoke' })).toHaveCount(0);
  });

  test('delete account confirms, logs out, and protects /account', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop header flow');
    await signIn(page, uniqueEmail());

    await page.goto('/account');
    await page.getByRole('button', { name: 'Delete account' }).click();
    await page.getByRole('button', { name: 'Yes, delete my account' }).click();

    // Signed out and bounced to the login page by the unauthenticated guard.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('header').getByRole('link', { name: 'Sign in' })).toBeVisible();

    await page.goto('/account');
    await expect(page).toHaveURL(/\/login/);
  });

  test('rate limit shows the 429 message on the 4th request', async ({ page }) => {
    const email = uniqueEmail();
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);

    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Send sign-in code' }).click();
      await expect(page.getByText(/Enter the 6-digit code/)).toBeVisible();
      await page.getByRole('button', { name: 'Use a different email' }).click();
      await expect(page.getByLabel('Email')).toBeVisible();
    }

    // 4th request exceeds the 3/10min per-email limit.
    await page.getByRole('button', { name: 'Send sign-in code' }).click();
    await expect(page.getByText('Too many requests. Try again in 10 minutes.')).toBeVisible();
  });

  test('a11y smoke: single h1 and labelled email input on /login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toHaveCount(1);
    await expect(page.getByLabel('Email')).toBeVisible();
  });

  test('a11y smoke: single h1 on /account', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop header flow');
    await signIn(page, uniqueEmail());
    await page.goto('/account');
    await expect(page.getByRole('heading', { level: 1, name: 'Account' })).toHaveCount(1);
  });
});
