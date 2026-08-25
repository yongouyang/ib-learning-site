import { test, expect, type Page } from '@playwright/test';

// Feature 3 (Contact Us): the webServer runs with CONTACT_STORAGE=dummy (see
// playwright.config.ts), so the real /api/contact route runs against the
// shared in-memory universe — dummy-OTP sessions resolve for prefill, and the
// per-IP fixed-window rate limit (3 messages/hour) is real.
//
// Rate-limit isolation: every e2e request shares ONE IP, so this spec is
// SERIAL and budget-aware — only the final test submits successfully (3 OK +
// 1 rejected). The validation test submits an empty form, which fails schema
// validation BEFORE the budget increment, and the prefill test never submits.
// One project per server instance is assumed (the CI matrix guarantee).

function uniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

// The dummy-OTP sign-in pattern (AUTH_TEST_MODE=1 → code 123456 for any email).
async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send sign-in code' }).click();
  await expect(page.getByText(/Enter the 6-digit code/)).toBeVisible();
  await page.getByLabel('6-digit code').fill('123456');
  await page.getByRole('button', { name: 'Verify code' }).click();
  await expect(page).toHaveURL('/');
}

async function openModal(page: Page) {
  await page.getByRole('button', { name: 'Get help' }).click();
  const dialog = page.getByRole('dialog', { name: 'Contact us' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function fillAndSend(page: Page, message: string) {
  const dialog = await openModal(page);
  await dialog.getByLabel('Name').fill('Test User');
  await dialog.getByLabel('Email').fill(uniqueEmail());
  await dialog.getByLabel('Message').fill(message);
  await dialog.getByRole('button', { name: 'Send message' }).click();
  return dialog;
}

test.describe.configure({ mode: 'serial' });

test.describe('contact', () => {
  test('help button opens the modal; Escape closes it and returns focus', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Get help' })).toBeVisible();

    const dialog = await openModal(page);
    await expect(dialog.getByLabel('Name')).toBeFocused();
    await expect(dialog.getByLabel('Email')).toBeVisible();
    await expect(dialog.getByLabel('Subject')).toBeVisible();
    await expect(dialog.getByLabel('Message')).toBeVisible();

    // Character counter tracks the message.
    await dialog.getByLabel('Message').fill('Hello');
    await expect(dialog.getByText('5 / 2,000')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Get help' })).toBeFocused();
  });

  test('empty submit surfaces the server validation issues', async ({ page }) => {
    await page.goto('/');
    const dialog = await openModal(page);
    await dialog.getByRole('button', { name: 'Send message' }).click();

    // 400 issues, mapped to friendly copy (schema fails BEFORE the rate-limit
    // budget increments, so this test consumes nothing).
    const alert = dialog.getByRole('alert');
    await expect(alert.getByText('Tell us your name.')).toBeVisible();
    await expect(alert.getByText('That email address doesn’t look right.')).toBeVisible();
    await expect(alert.getByText('Write your message first.')).toBeVisible();
    // The modal stays open so the user can fix the form.
    await expect(dialog).toBeVisible();
  });

  test('logged-in users get name and email pre-filled', async ({ page }) => {
    const email = uniqueEmail();
    await signIn(page, email);

    const dialog = await openModal(page);
    // The auto-created profile is "Me" (same display name the header shows).
    await expect(dialog.getByLabel('Name')).toHaveValue('Me');
    await expect(dialog.getByLabel('Email')).toHaveValue(email);

    // Never submits — the shared per-IP budget is reserved for the last test.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('successful submit confirms; the 4th message in an hour is rate-limited', async ({ page }) => {
    await page.goto('/');

    // 3 messages fit the per-IP hourly budget: each closes the modal and
    // shows the success toast.
    for (let i = 1; i <= 3; i++) {
      const dialog = await fillAndSend(page, `Test message ${i}`);
      await expect(page.getByText('Message sent — we’ll be in touch soon.')).toBeVisible();
      await expect(dialog).toBeHidden();
    }

    // The 4th hits the budget: 429 copy surfaces as an in-modal alert and the
    // form (and the user's message) stays put.
    const dialog = await fillAndSend(page, 'Test message 4');
    await expect(dialog.getByRole('alert').getByText('Too many messages — try again later')).toBeVisible();
    await expect(dialog.getByLabel('Message')).toHaveValue('Test message 4');
  });
});
