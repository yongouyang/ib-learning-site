import { test, expect } from '@playwright/test';

test.describe('Flashcards page', () => {
  test('should flip a flashcard and self-sort through the deck', async ({ page }) => {
    await page.goto('/subjects/biology/bio-cell-1/flashcards');

    // First card is visible — the deck donut and counter are shown
    await expect(page.getByRole('heading', { name: 'Nucleus' })).toBeVisible();
    await expect(page.getByText('1/12')).toBeVisible();
    await expect(page.getByRole('img', { name: /Flashcards:/ })).toBeVisible();

    // Flip the card and verify the definition appears
    const card = page.locator('.card').filter({ hasText: 'Tap to flip' });
    await expect(card).toBeVisible();
    await card.click();
    await expect(page.getByText('Control centre of the cell; contains genetic material (DNA) and controls all cell activities.')).toBeVisible();

    // Self-sort forward through several cards: flip, then "I know this"
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: /I know this/i }).click();
      await page.locator('.card').filter({ hasText: 'Tap to flip' }).click();
    }

    // Should now be on card 6
    await expect(page.getByText('6/12')).toBeVisible();

    // "Still learning" also advances the deck
    await page.getByRole('button', { name: /Still learning/i }).click();
    await expect(page.getByText('7/12')).toBeVisible();
  });
});
