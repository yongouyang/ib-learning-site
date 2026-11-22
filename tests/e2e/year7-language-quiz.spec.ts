import { test, expect, type Page } from '@playwright/test';
import { getContentTopic } from '../../src/content/registry.content';
import type { Topic } from '../../src/content/types';

async function currentQuestion(page: Page, topic: Topic) {
  const stem = await page.getByRole('heading', { level: 2 }).textContent();
  const question = topic.questions.find((candidate) => candidate.stem === stem);
  expect(question, `Question bank contains rendered stem: ${stem}`).toBeDefined();
  return question!;
}

async function completeWithAcceptedAnswers(page: Page, topic: Topic) {
  for (let index = 0; index < topic.questions.length; index += 1) {
    const question = await currentQuestion(page, topic);
    const input = page.getByRole('textbox');
    await expect(input).toBeEnabled();
    await input.fill(question.choices[question.choices.length - 1]);
    await page.getByRole('button', { name: 'Check answer' }).click();
    await expect(page.getByText('Correct!')).toBeVisible();
    const next = page.getByRole('button', { name: /Next Question|See Results/ });
    const lastQuestion = (await next.textContent())?.includes('See Results') ?? false;
    await next.evaluate((element) => (element as HTMLElement).click());
    if (lastQuestion) break;
    await expect(next).toBeHidden();
    await expect.poll(() => page.getByRole('heading', { level: 2 }).textContent()).not.toBe(question.stem);
  }
  await expect(page.getByRole('heading', { name: 'Quiz Complete!' })).toBeVisible();
}

test.describe('Year 7 target-language quizzes', () => {
  test('German accepts every authored answer form in a complete typed quiz', async ({ page }) => {
    const topic = getContentTopic('german', 'germ-yr7-school-life')!;
    await page.goto(`/subjects/german/${topic.id}/quiz`);

    const input = page.getByRole('textbox', { name: 'Type the full German word or phrase' });
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('lang', 'de-DE');
    await expect(page.getByRole('button', { name: /^[A-D]\./ })).toHaveCount(0);
    await expect(page.getByText('1/15').first()).toBeVisible();

    await completeWithAcceptedAnswers(page, topic);
    await expect(page.getByText('15 out of 15 correct')).toBeVisible();
    await page.getByRole('button', { name: /Review answers/ }).click();
    await expect(page.locator('article')).toHaveCount(15);
    await expect(page.locator('article').first()).not.toContainText(/Your answer: [A-D]\./);
  });

  test('Chinese completes with Traditional alternatives and never renders choices', async ({ page }) => {
    const topic = getContentTopic('chinese', 'chin-yr7-greetings-names')!;
    await page.goto(`/subjects/chinese/${topic.id}/quiz`);

    const input = page.getByRole('textbox', { name: 'Type your answer in Chinese characters' });
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('lang', 'zh-CN');
    await expect(page.getByText('Simplified or Traditional Chinese is accepted. Use characters, not pinyin.').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^[A-D]\./ })).toHaveCount(0);

    await completeWithAcceptedAnswers(page, topic);
    await expect(page.getByText('15 out of 15 correct')).toBeVisible();
  });

  test('Chinese rejects pinyin rather than awarding a point', async ({ page }) => {
    await page.goto('/subjects/chinese/chin-yr7-greetings-names/quiz');
    const input = page.getByRole('textbox');
    await expect(input).toBeEnabled();
    await input.fill('ni hao');
    await page.getByRole('button', { name: 'Check answer' }).click();

    await expect(page.getByText('Incorrect')).toBeVisible();
    await expect(page.getByText('Point awarded — check the spelling next time.')).toHaveCount(0);
  });

  test('German rejects a wrong article in the regular Year 7 quiz', async ({ page }) => {
    const topic = getContentTopic('german', 'germ-yr7-school-life')!;
    await page.goto(`/subjects/german/${topic.id}/quiz`);

    let question = await currentQuestion(page, topic);
    while (question.choices[0] !== 'der Stift') {
      await page.getByRole('textbox').fill('not the answer');
      await page.getByRole('button', { name: 'Check answer' }).click();
      const next = page.getByRole('button', { name: /Next Question|See Results/ });
      await next.evaluate((element) => (element as HTMLElement).click());
      await expect(next).toBeHidden();
      await expect(page.getByRole('textbox')).toBeEnabled();
      await expect.poll(() => page.getByRole('heading', { level: 2 }).textContent()).not.toBe(question.stem);
      question = await currentQuestion(page, topic);
    }

    await page.getByRole('textbox').fill('die Stift');
    await page.getByRole('button', { name: 'Check answer' }).click();
    await expect(page.getByText('Incorrect')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Listen to der Stift' })).toBeVisible();
  });
});
