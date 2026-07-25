import { test, expect } from '@playwright/test';

// Phase 2: difficulty badges, easy->hard ordering, and the ?difficulty= filter.
// Uses math-yr7-calculations (15 questions: 3 easy / 9 medium / 3 hard).
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
    await expect(group.getByRole('link', { name: /All \(15\)/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(group.getByRole('link', { name: /Easy \(\d+\)/ })).toBeVisible();
    await expect(group.getByRole('link', { name: /Medium \(\d+\)/ })).toBeVisible();
    await expect(group.getByRole('link', { name: /Hard \(\d+\)/ })).toBeVisible();
  });

  test('?difficulty=hard shows only hard questions', async ({ page }) => {
    await page.goto('/subjects/math/math-yr7-calculations/quiz?difficulty=hard');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();

    const group = page.getByRole('group', { name: 'Filter by difficulty' });
    await expect(group.getByRole('link', { name: /Hard \(3\)/ })).toHaveAttribute('aria-pressed', 'true');

    // Question counter reflects the filtered pool (3 hard questions)
    await expect(page.getByText('1/3')).toBeVisible();

    const card = page.locator('.card').first();
    await expect(card.getByText('hard', { exact: true })).toBeVisible();
    await expect(card.getByText('easy', { exact: true })).not.toBeVisible();

    // Answer and advance: the next question is also hard
    const choice = page.getByRole('button').filter({ hasText: /^A\./ }).first();
    await choice.click();
    const nextBtn = page.getByRole('button', { name: /Next Question/ });
    await nextBtn.evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByText('2/3')).toBeVisible();
    await expect(page.locator('.card').first().getByText('hard', { exact: true })).toBeVisible();
  });

  test('clicking a filter chip navigates to the filtered quiz', async ({ page }) => {
    await page.goto('/subjects/math/math-yr7-calculations/quiz');
    await page.getByRole('group', { name: 'Filter by difficulty' }).getByRole('link', { name: /Easy/ }).click();
    await page.waitForURL('**/quiz?difficulty=easy');
    await expect(page.locator('.card').first().getByText('easy', { exact: true })).toBeVisible();
  });
});
