import { test, expect } from '@playwright/test';
import { completeQuiz } from './quiz-session';

test('builds a scoped test and measures its complete review and retry funnel', async ({ page }) => {
  const events: Array<{ name: string; props: Record<string, unknown> }> = [];
  await page.route('**/api/analytics/event', async (route) => {
    events.push(route.request().postDataJSON() as { name: string; props: Record<string, unknown> });
    await route.fulfill({ status: 204 });
  });
  await page.goto('/custom-test');
  await expect(page.getByRole('heading', { name: 'Build a Test' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start my test' })).toBeDisabled();

  await page.getByLabel('Year group or course').selectOption('7');
  await page.getByRole('checkbox', { name: /^Angles / }).check();
  await page.getByRole('checkbox', { name: /^Fractions / }).check();
  await page.getByLabel('Multiple-choice questions', { exact: true }).selectOption('5');
  await page.getByRole('button', { name: 'Start my test' }).click();

  await expect(page.getByText('1/5')).toBeVisible();
  await completeQuiz(page);
  await expect(page.getByRole('button', { name: /Retry mistakes/ })).toBeVisible();
  await expect.poll(() => events.filter((event) => event.name === 'quiz_question_answered').length).toBe(5);
  const start = events.find((event) => event.name === 'quiz_started');
  const completion = events.find((event) => event.name === 'quiz_completed');
  expect(start?.props.attemptId).toEqual(expect.any(String));
  expect(completion?.props.attemptId).toBe(start?.props.attemptId);
  expect(events.filter((event) => event.name === 'quiz_question_answered').every((event) => event.props.attemptId === start?.props.attemptId)).toBe(true);

  await page.getByRole('button', { name: /Review answers/ }).click();
  await expect(page.getByText('Correct answer:').first()).toBeVisible();
  await expect.poll(() => events.some((event) => event.name === 'quiz_review_opened' && event.props.attemptId === start?.props.attemptId)).toBe(true);
  await page.getByRole('button', { name: /Retry mistakes/ }).click();
  await expect(page.getByRole('button', { name: /Review answers/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
  await expect.poll(() => events.some((event) => event.name === 'quiz_retry_started' && event.props.kind === 'mistakes' && event.props.attemptId !== start?.props.attemptId)).toBe(true);
  await completeQuiz(page);
  const attempts = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('iblearn_progress') ?? '{}') as {
      topicProgress: Record<string, { attempts: Array<{ totalCount: number }> }>;
    };
    return Object.values(stored.topicProgress).map((topic) => topic.attempts.map((attempt) => attempt.totalCount));
  });
  expect(attempts.some((topicAttempts) => topicAttempts.length === 2)).toBe(true);
  for (const topicAttempts of attempts) {
    expect(topicAttempts.length).toBeLessThanOrEqual(2);
    if (topicAttempts.length === 2) expect(topicAttempts[1]).toBeLessThanOrEqual(topicAttempts[0]);
  }
});


test('starts a fresh similar-question drill from topic mistakes', async ({ page }) => {
  await page.goto('/subjects/math/math-yr7-calculations/quiz');
  await completeQuiz(page);
  const similar = page.getByRole('button', { name: 'Practise similar questions' });
  await expect(similar).toBeVisible();
  await similar.click();
  await expect(page.getByRole('heading', { name: 'Quiz Complete!' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
  await expect(page.getByRole('button').filter({ hasText: /^A\./ }).first()).toBeEnabled();
});


test('avoids completed questions when the next request returns the same candidates', async ({ page }) => {
  let firstPayload: unknown;
  await page.route('**/api/content/public/custom-test/**', async (route) => {
    if (firstPayload) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(firstPayload) });
      return;
    }
    const response = await route.fetch();
    firstPayload = await response.json();
    await route.fulfill({ response });
  });

  await page.goto('/custom-test');
  await page.getByLabel('Year group or course').selectOption('7');
  await page.getByRole('checkbox', { name: /^Angles / }).check();
  await page.getByLabel('Multiple-choice questions', { exact: true }).selectOption('5');
  await page.getByRole('button', { name: 'Start my test' }).click();
  await completeQuiz(page);

  const latestStems = () => page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('iblearn_progress') ?? '{}') as {
      topicProgress: Record<string, { attempts: Array<{ questionResults?: Array<{ question?: { stem: string } }> }> }>;
    };
    const attempts = stored.topicProgress['math:math-yr7-angles'].attempts;
    return attempts.at(-1)?.questionResults?.map((result) => result.question?.stem) ?? [];
  });
  const firstStems = await latestStems();
  expect(firstStems).toHaveLength(5);
  expect((firstPayload as { questions: unknown[] }).questions.length).toBeGreaterThan(5);

  await page.getByRole('button', { name: 'New Question Set' }).click();
  await expect(page.getByRole('heading', { name: 'Quiz Complete!' })).toBeHidden();
  await expect(page.getByText('1/5')).toBeVisible();
  await completeQuiz(page);
  const secondStems = await latestStems();
  expect(secondStems).toHaveLength(5);
  expect(secondStems.filter((stem) => firstStems.includes(stem))).toEqual([]);
});


test('Back resets the current test from a question and from results', async ({ page }) => {
  await page.goto('/custom-test');
  await page.getByLabel('Year group or course').selectOption('7');
  await page.getByRole('checkbox', { name: /^Angles / }).check();
  await page.getByRole('checkbox', { name: /^Fractions / }).check();
  await page.getByLabel('Multiple-choice questions', { exact: true }).selectOption('5');
  await page.getByRole('button', { name: 'Start my test' }).click();

  await page.getByRole('link', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Build a Test' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /^Angles / })).toBeChecked();

  await page.getByRole('button', { name: 'Start my test' }).click();
  await completeQuiz(page);
  await page.getByRole('link', { name: 'Back to Test Builder' }).click();
  await expect(page.getByRole('heading', { name: 'Build a Test' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start my test' })).toBeEnabled();
});
