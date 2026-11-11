import { test, expect } from '@playwright/test';

// Phase 2: difficulty badges, easy->hard ordering, and the ?difficulty= filter.
// Uses math-yr7-calculations without pinning its expanding question-bank size.
test.describe('Quiz difficulty features', () => {
  test('shows a difficulty badge on each question, ordered easy first', async ({ page }) => {
    await page.goto('/subjects/math/math-yr7-calculations/quiz');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();

    // First question must be from the easy band (easy -> hard ordering)
    const card = page.locator('.card').first();
    await expect(card.getByText('easy', { exact: true })).toBeVisible();
  });

  test('renders the difficulty filter chips with All active by default', async ({ page }) => {
    await page.goto('/subjects/math/math-yr7-calculations/quiz');

    const group = page.getByRole('group', { name: 'Filter by difficulty' });
    await expect(group).toBeVisible();
    await expect(group.getByRole('link', { name: /All \(\d+\)/ })).toHaveAttribute('aria-current', 'page');
    await expect(group.getByRole('link', { name: /Easy \(\d+\)/ })).toBeVisible();
    await expect(group.getByRole('link', { name: /Medium \(\d+\)/ })).toBeVisible();
    await expect(group.getByRole('link', { name: /Hard \(\d+\)/ })).toBeVisible();
  });

  test('?difficulty=hard shows only hard questions', async ({ page }) => {
    await page.goto('/subjects/math/math-yr7-calculations/quiz?difficulty=hard');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();

    const group = page.getByRole('group', { name: 'Filter by difficulty' });
    await expect(group.getByRole('link', { name: /Hard \(\d+\)/ })).toHaveAttribute('aria-current', 'page');

    // Scoped to <main>: React's streaming Suspense leaves a hidden copy of the
    // page in <div hidden id="S:0"> under <body>, and an unscoped text lookup
    // trips strict mode on it.
    const firstCounter = page.locator('main').getByText(/^1\/\d+$/);
    await expect(firstCounter).toBeVisible();
    const total = (await firstCounter.innerText()).split('/')[1];

    const card = page.locator('.card').first();
    await expect(card.getByText('hard', { exact: true })).toBeVisible();
    await expect(card.getByText('easy', { exact: true })).not.toBeVisible();

    // Answer and advance: the next question is also hard
    const choice = page.getByRole('button').filter({ hasText: /^A\./ }).first();
    await choice.click();
    const nextBtn = page.getByRole('button', { name: /Next Question/ });
    await nextBtn.evaluate((el) => (el as HTMLElement).click());
    await expect(page.locator('main').getByText(`2/${total}`)).toBeVisible();
    await expect(page.locator('.card').first().getByText('hard', { exact: true })).toBeVisible();
  });

  test('clicking a filter chip navigates to the filtered quiz', async ({ page }) => {
    await page.goto('/subjects/math/math-yr7-calculations/quiz');
    await page.getByRole('group', { name: 'Filter by difficulty' }).getByRole('link', { name: /Easy/ }).click();
    await page.waitForURL('**/quiz?difficulty=easy');
    await expect(page.locator('.card').first().getByText('easy', { exact: true })).toBeVisible();
  });
});
