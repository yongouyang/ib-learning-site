import { test, expect } from '@playwright/test';

test.describe('Flashcards page', () => {
  test('should flip a flashcard and navigate through the whole deck to completion', async ({ page }) => {
    await page.goto('/subjects/biology/bio-cell-1/flashcards');

    // First card is visible
    await expect(page.getByRole('heading', { name: 'Nucleus' })).toBeVisible();
    await expect(page.getByText('1/5')).toBeVisible();

    // Flip the card and verify the definition appears
    const card = page.locator('.card').filter({ hasText: 'Tap to flip' });
    await expect(card).toBeVisible();
    await card.click();
    await expect(page.getByText('Control centre; contains DNA.')).toBeVisible();

    // Navigate through all remaining cards to completion
    const remainingTerms = ['Mitochondria', 'Cell membrane', 'Chloroplast', 'Cell wall'];
    for (let i = 0; i < 5; i++) {
      const buttonLabel = i < 4 ? 'Next →' : 'Finish';
      const navButton = page.getByRole('button', { name: buttonLabel });
      await expect(navButton).toBeVisible();
      await navButton.click();

      if (i < 4) {
        await expect(page.getByRole('heading', { name: remainingTerms[i] })).toBeVisible();
      }
    }

    // Completion screen
    await expect(page.getByRole('heading', { name: 'Deck Complete!' })).toBeVisible();
    await expect(page.getByText('You reviewed all 5 flashcards.')).toBeVisible();
  });
});
