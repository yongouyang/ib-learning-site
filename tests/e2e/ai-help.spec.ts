import { test, expect } from '@playwright/test';

function uniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function answerQuestion(page: import('@playwright/test').Page) {
  await page.goto('/subjects/math/math-yr7-calculations/quiz');
  const choice = page.getByRole('button').filter({ hasText: /^A\./ }).first();
  await expect(choice).toBeEnabled();
  await choice.click();
  await expect(page.getByText('Need another explanation?')).toBeVisible();
}

test('logged-out students are offered sign-in only after asking for AI help', async ({ page }) => {
  await answerQuestion(page);
  await page.getByRole('button', { name: 'Why was my answer wrong?' }).click();
  await expect(page.getByRole('link', { name: 'Sign in to use AI help' })).toBeVisible();
  await expect(page.locator('main')).toContainText('AI-generated help can make mistakes');
});

test('signed-in students receive contextual dummy help', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(uniqueEmail());
  await page.getByRole('button', { name: 'Send sign-in code' }).click();
  await page.getByLabel('6-digit code').fill('123456');
  await page.getByRole('button', { name: 'Verify code' }).click();
  await expect(page).toHaveURL('/');

  await answerQuestion(page);
  await page.getByRole('button', { name: 'Explain differently' }).click();
  await expect(page.getByText('AI help', { exact: true })).toBeVisible();
  await expect(page.getByText(/Dummy AI help for simpler/)).toBeVisible();
});
