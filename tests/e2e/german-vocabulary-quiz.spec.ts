import { test, expect, type Page } from '@playwright/test';

const topicPath = '/subjects/german/germ-yr7-animals-colours';

async function completeTypedQuiz(page: Page) {
  const results = page.getByRole('heading', { name: 'Quiz Complete!' });
  for (let i = 0; i < 40; i += 1) {
    if (await results.isVisible()) break;
    const input = page.getByRole('textbox', { name: 'Type the full German word or phrase' });
    await expect(input).toBeEnabled();
    await input.fill('not the answer');
    await page.getByRole('button', { name: 'Check answer' }).click();
    const next = page.getByRole('button', { name: /Next Question|See Results/ });
    await expect(next).toBeVisible();
    const label = (await next.textContent()) ?? '';
    await next.evaluate((element) => (element as HTMLElement).click());
    if (/See Results/.test(label)) break;
    await expect(next).toBeHidden();
  }
  await expect(results).toBeVisible();
}

test.describe('German vocabulary quiz', () => {
  test('a topic card opens an untimed typed-recall quiz using that topic vocabulary', async ({ page }) => {
    await page.goto('/subjects/german');
    const topicCard = page.locator('.card').filter({
      has: page.getByRole('heading', { name: 'Tiere & Farben (Animals & Colours)' }),
    });
    const vocabularyLink = topicCard.getByRole('link', { name: 'Vocab Quiz' });
    expect((await vocabularyLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await vocabularyLink.click();
    await page.waitForURL(`${topicPath}/vocabulary-quiz`);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vocabulary Quiz: Tiere & Farben (Animals & Colours)');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(/What is .+ in German\?/);
    await expect(page.getByText('1/12')).toBeVisible();
    await expect(page.getByText(/Time remaining/)).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Type the full German word or phrase' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^[A-D]\./ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Listen to / })).toHaveCount(0);

    await completeTypedQuiz(page);
    await expect(page.getByText('out of 12 correct')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Shuffle Questions' })).toBeVisible();
    await page.getByRole('button', { name: /Review answers/ }).click();
    await expect(page.getByRole('heading', { name: 'Review your answers' })).toBeAttached();
    await expect(page.locator('article')).toHaveCount(12);
    await expect(page.locator('article').first()).toContainText('not the answer');
    await expect(page.locator('article').first()).not.toContainText(/Correct answer: [A-D]\./);
  });

  test('an exact answer earns the point and unlocks pronunciation without a spelling reminder', async ({ page }) => {
    await page.goto('/subjects/german/germ-yr7-greetings-basics/vocabulary-quiz');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText('What is “Where do you come from?” in German?');

    await page.getByRole('textbox').fill('Woher kommst du?');
    await page.getByRole('button', { name: 'Check answer' }).click();

    await expect(page.getByText('Correct!')).toBeVisible();
    await expect(page.getByText('Point awarded — check the spelling next time.')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Listen to Woher kommst du?' })).toBeVisible();
    const next = page.getByRole('button', { name: 'Next Question' });
    await expect(next).toBeVisible();
    await expect.poll(async () => {
      const nextBox = await next.boundingBox();
      const helpBox = await page.getByRole('button', { name: 'Get help' }).boundingBox();
      if (!nextBox || !helpBox) return false;
      return nextBox.x >= helpBox.x + helpBox.width || nextBox.y >= helpBox.y + helpBox.height
        || nextBox.x + nextBox.width <= helpBox.x || nextBox.y + nextBox.height <= helpBox.y;
    }).toBe(true);
    await next.evaluate((element) => (element as HTMLElement).click());
    await expect(page.getByRole('textbox')).toHaveValue('');
  });

  test('a minor spelling mistake earns the point with a reminder', async ({ page }) => {
    await page.goto('/subjects/german/germ-yr7-greetings-basics/vocabulary-quiz');

    await page.getByRole('textbox').fill('Woher kommt du?');
    await page.getByRole('button', { name: 'Check answer' }).click();

    await expect(page.getByText('Correct!')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Point awarded' })).toHaveText('Point awarded — check the spelling next time.');
    await expect(page.getByText('Woher kommst du?', { exact: false }).first()).toBeVisible();
  });

  test('a wrong article is incorrect', async ({ page }) => {
    await page.goto(`${topicPath}/vocabulary-quiz`);
    const heading = page.getByRole('heading', { level: 2 });
    for (let i = 0; i < 12; i += 1) {
      if ((await heading.textContent()) === 'What is “the dog” in German?') break;
      await page.getByRole('textbox').fill('not the answer');
      await page.getByRole('button', { name: 'Check answer' }).click();
      await page.getByRole('button', { name: /Next Question|See Results/ }).evaluate((element) => (element as HTMLElement).click());
      await expect(page.getByRole('textbox')).toBeEnabled();
    }
    await expect(heading).toHaveText('What is “the dog” in German?');

    await page.getByRole('textbox').fill('die Hund');
    await page.getByRole('button', { name: 'Check answer' }).click();
    await expect(page.getByText('Incorrect')).toBeVisible();
    await expect(page.getByText('Point awarded — check the spelling next time.')).toHaveCount(0);
    await expect(page.getByText('der Hund', { exact: false }).first()).toBeVisible();
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
