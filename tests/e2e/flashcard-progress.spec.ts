import { test, expect } from '@playwright/test';

// Phase 6: flashcard self-sorting persistence, deck filters, due surfacing, mastery bars.
const TEN_DAYS_AGO = new Date(Date.now() - 10 * 86_400_000).toISOString();
const NOW = new Date().toISOString();

function seedProgress(extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    version: 2,
    userProgress: { totalStars: 0, currentStreakDays: 0, lastStudyDate: null },
    topicProgress: {},
    examResults: [],
    ladderProgress: {},
    flashcardProgress: {},
    ...extra,
  });
}

test.describe('Flashcard progress', () => {
  test('self-sorting persists across reloads and updates the donut', async ({ page }) => {
    await page.goto('/subjects/biology/bio-cell-1/flashcards');
    // Wait out the Next 16 streaming shell (hidden S:0 copy) before clicking.
    await expect(page.locator('[id="S:0"]')).toHaveCount(0);
    await page.locator('.card').filter({ hasText: 'Tap to flip' }).click();
    await page.getByRole('button', { name: /I know this/i }).click();
    await expect(page.getByText('2/12')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('img', { name: /1 known of 1 seen, 12 total/ })).toBeVisible();
  });

  test('due and learning filters build the right decks from seeded state', async ({ page }) => {
    await page.addInitScript((seed) => {
      localStorage.setItem('iblearn_progress', seed);
    }, seedProgress({
      flashcardProgress: {
        'bio-cell-1-f1': { status: 'learning', lastReviewed: NOW, knownStreak: 0 },
        'bio-cell-1-f2': { status: 'known', lastReviewed: TEN_DAYS_AGO, knownStreak: 1 }, // overdue (interval 1d)
        'bio-cell-1-f3': { status: 'known', lastReviewed: NOW, knownStreak: 2 }, // not due (interval 3d)
      },
    }));

    // due = learning ∪ overdue known → 2 cards
    await page.goto('/subjects/biology/bio-cell-1/flashcards?filter=due');
    await expect(page.getByText('1/2')).toBeVisible();
    await expect(page.getByText('Due for review ·')).toBeVisible();

    // learning = explicitly marked learning → 1 card
    await page.goto('/subjects/biology/bio-cell-1/flashcards?filter=learning');
    await expect(page.getByText('1/1')).toBeVisible();
  });

  test('homepage shows the flashcards-due card and deep-links into the due deck', async ({ page }) => {
    await page.addInitScript((seed) => {
      localStorage.setItem('iblearn_progress', seed);
    }, seedProgress({
      flashcardProgress: {
        'bio-cell-1-f1': { status: 'learning', lastReviewed: NOW, knownStreak: 0 },
        'bio-cell-1-f2': { status: 'learning', lastReviewed: NOW, knownStreak: 0 },
      },
    }));

    await page.goto('/');
    await expect(page.getByText('2 flashcards due for review')).toBeVisible();
    const link = page.getByRole('link', { name: /Cell Structure & Microscopy/ });
    await expect(link.getByText('2 due')).toBeVisible();
    await link.click();
    await page.waitForURL('**/subjects/biology/bio-cell-1/flashcards?filter=due');
    await expect(page.getByText('1/2')).toBeVisible();
  });

  test('subject page shows a mastery bar from quiz history', async ({ page }) => {
    await page.addInitScript((seed) => {
      localStorage.setItem('iblearn_progress', seed);
    }, seedProgress({
      topicProgress: {
        'biology:bio-cell-1': {
          topicId: 'bio-cell-1',
          subjectId: 'biology',
          topicTitle: 'Cell Structure & Microscopy',
          subjectTitle: 'Biology',
          attempts: [{ date: NOW, correctCount: 8, totalCount: 10 }],
        },
      },
    }));

    await page.goto('/subjects/biology');
    await expect(page.getByLabel('Mastery 80%')).toBeVisible();
  });
});
