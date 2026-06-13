import { test, expect } from '@playwright/test';

test.describe('Flashcards page', () => {
  test('should flip a flashcard and navigate through the deck', async ({ page }) => {
    await page.goto('/subjects/biology/bio-cell-1/flashcards');

    // First card is visible — title is now "Cell Structure & Microscopy" with 12 cards
    // The first flashcard term is "Nucleus"
    await expect(page.getByRole('heading', { name: 'Nucleus' })).toBeVisible();
    await expect(page.getByText('1/12')).toBeVisible();

    // Flip the card and verify the definition appears
    const card = page.locator('.card').filter({ hasText: 'Tap to flip' });
    await expect(card).toBeVisible();
    await card.click();
    await expect(page.getByText('Control centre of the cell; contains genetic material (DNA) and controls all cell activities.')).toBeVisible();

    // Navigate forward through several cards
    for (let i = 0; i < 4; i++) {
      const navButton = page.getByRole('button', { name: 'Next →' });
      await expect(navButton).toBeVisible();
      await navButton.click();
    }

    // Should now be on card 6
    await expect(page.getByText('6/12')).toBeVisible();
  });
});
