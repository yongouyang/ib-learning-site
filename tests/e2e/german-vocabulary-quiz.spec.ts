import { test, expect } from '@playwright/test';
import { completeQuiz } from './quiz-session';

const topicPath = '/subjects/german/germ-yr7-animals-colours';

test.describe('German vocabulary quiz', () => {
  test('a topic card opens an untimed quiz using only that topic vocabulary', async ({ page }) => {
    await page.goto('/subjects/german');
    const topicCard = page.locator('.card').filter({
      has: page.getByRole('heading', { name: 'Tiere & Farben (Animals & Colours)' }),
    });
    const vocabularyLink = topicCard.getByRole('link', { name: 'Vocab Quiz' });
    expect((await vocabularyLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await vocabularyLink.click();
    await page.waitForURL(`${topicPath}/vocabulary-quiz`);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vocabulary Quiz: Tiere & Farben (Animals & Colours)');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(/What does .+ mean\?/);
    await expect(page.getByText('1/12')).toBeVisible();
    await expect(page.getByText(/Time remaining/)).toHaveCount(0);
    const questionCard = page.locator('main .card').filter({ has: page.getByRole('heading', { level: 2 }) });
    await expect(questionCard.getByRole('button')).toHaveCount(4);

    await completeQuiz(page);
    await expect(page.getByText('out of 12 correct')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Shuffle Questions' })).toBeVisible();
    await page.getByRole('button', { name: /Review answers/ }).click();
    await expect(page.getByRole('heading', { name: 'Review your answers' })).toBeAttached();
    await expect(page.locator('article')).toHaveCount(12);
  });

  test('study and flashcard pages link to the same topic quiz with tool metadata', async ({ page }) => {
    await page.goto(`${topicPath}/study`);
    await expect(page.getByRole('link', { name: 'Vocab Quiz' })).toBeVisible();

    await page.goto(`${topicPath}/flashcards`);
    const quizLink = page.getByRole('link', { name: 'Take Vocabulary Quiz' });
    await expect(quizLink).toBeVisible();
    await quizLink.click();
    await page.waitForURL(`${topicPath}/vocabulary-quiz`);

    await expect(page).toHaveTitle(/vocabulary quiz/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://octavlearning.com${topicPath}/study`);
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByText('Vocabulary Quiz')).toBeVisible();
  });

  test('other subjects do not show the German vocabulary action', async ({ page }) => {
    await page.goto('/subjects/math/math-yr7-calculations/study');
    await expect(page.getByRole('link', { name: 'Vocab Quiz' })).toHaveCount(0);
  });
});
