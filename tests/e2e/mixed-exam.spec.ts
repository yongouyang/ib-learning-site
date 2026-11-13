import { test, expect } from '@playwright/test';
import { completeQuiz } from './quiz-session';

test('completes a mixed exam and preserves detailed written-answer history', async ({ page }) => {
  await page.goto('/custom-test');
  await page.getByLabel('Year group or course').selectOption('7');
  await page.getByRole('checkbox', { name: /^Angles / }).check();
  await page.getByRole('checkbox', { name: /^Fractions / }).check();
  await page.getByLabel('Multiple-choice questions', { exact: true }).selectOption('5');
  await page.getByLabel('Question type').selectOption('mixed');
  await page.getByRole('button', { name: 'Start my test' }).click();

  await completeQuiz(page);
  await page.getByRole('button', { name: 'Continue to written section' }).click();
  await expect(page.getByRole('heading', { name: /Written section/ })).toBeVisible();
  await page.getByLabel('Your answer').fill('I used the angle sum and got x = 40 degrees.');
  await page.getByRole('button', { name: 'Next Question' }).click();
  await expect(page.getByLabel('Your answer')).toHaveValue('');
  await page.getByLabel('Your answer').fill('I used denominator 20 and got 7/20.');
  await page.getByRole('button', { name: /Submit & Review/ }).click();
  await expect(page.getByText('Model answer')).toBeVisible();

  for (let i = 0; i < 2; i++) {
    let remaining = await page.locator('button[aria-pressed="false"]').count();
    while (remaining > 0) {
      await page.locator('button[aria-pressed="false"]').first().click();
      remaining--;
      await expect(page.locator('button[aria-pressed="false"]')).toHaveCount(remaining);
    }
    await page.getByRole('button', { name: /Next Question|See Results/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'Mixed Exam Complete!' })).toBeVisible();
  await page.getByRole('button', { name: 'Review answers' }).click();
  await expect(page.getByText('I used the angle sum and got x = 40 degrees.')).toBeVisible();
  await page.getByRole('button', { name: 'Next Question (3/3 marks)' }).click();
  await page.getByRole('button', { name: /See Results/ }).click();

  await page.goto('/progress');
  await expect(page.getByRole('heading', { name: 'Exam history' })).toBeVisible();
  const result = page.locator('details').filter({ hasText: 'Custom mixed exam' }).first();
  await result.locator('summary').click();
  await expect(result).toContainText('I used denominator 20 and got 7/20.');
  await expect(result).toContainText('Model answer:');
});

test('avoids completed written questions when the next mixed exam has the same candidates', async ({ page }) => {
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

  const completeMixedExam = async () => {
    await page.goto('/custom-test');
    await page.getByLabel('Year group or course').selectOption('7');
    await page.getByRole('checkbox', { name: /^Angles / }).check();
    await page.getByRole('checkbox', { name: /^Fractions / }).check();
    await page.getByLabel('Multiple-choice questions', { exact: true }).selectOption('5');
    await page.getByLabel('Question type').selectOption('mixed');
    await page.getByRole('button', { name: 'Start my test' }).click();
    await completeQuiz(page);
    await page.getByRole('button', { name: 'Continue to written section' }).click();

    for (let i = 0; i < 2; i++) {
      await page.getByLabel('Your answer').fill(`Worked answer ${i + 1}`);
      await page.getByRole('button', { name: i === 0 ? 'Next Question' : /Submit & Review/ }).click();
    }
    await expect(page.getByText('Model answer')).toBeVisible();
    for (let i = 0; i < 2; i++) {
      let remaining = await page.locator('button[aria-pressed="false"]').count();
      while (remaining > 0) {
        await page.locator('button[aria-pressed="false"]').first().click();
        remaining--;
        await expect(page.locator('button[aria-pressed="false"]')).toHaveCount(remaining);
      }
      await page.getByRole('button', { name: /Next Question|See Results/ }).click();
    }
    await expect(page.getByRole('heading', { name: 'Mixed Exam Complete!' })).toBeVisible();

    return page.evaluate(() => {
      const stored = JSON.parse(localStorage.getItem('iblearn_progress') ?? '{}') as {
        examResults: Array<{ questionResults?: Array<{ question: { id: string } }> }>;
      };
      return stored.examResults.at(-1)?.questionResults?.map((result) => result.question.id) ?? [];
    });
  };

  const firstIds = await completeMixedExam();
  const secondIds = await completeMixedExam();
  expect(firstIds).toHaveLength(2);
  expect(secondIds).toHaveLength(2);
  expect(secondIds.filter((id) => firstIds.includes(id))).toEqual([]);
  expect(secondIds.some((id) => id.startsWith('math-y7-custom-written-'))).toBe(true);
});

test('Build a Test exits reset a mixed exam from the written section and results', async ({ page }) => {
  const startMixedExam = async () => {
    await page.getByRole('button', { name: 'Start my test' }).click();
    await completeQuiz(page);
    await page.getByRole('button', { name: 'Continue to written section' }).click();
    await expect(page.getByRole('heading', { name: /Written section/ })).toBeVisible();
  };

  await page.goto('/custom-test');
  await page.getByLabel('Year group or course').selectOption('7');
  await page.getByRole('checkbox', { name: /^Angles / }).check();
  await page.getByRole('checkbox', { name: /^Fractions / }).check();
  await page.getByLabel('Multiple-choice questions', { exact: true }).selectOption('5');
  await page.getByLabel('Question type').selectOption('mixed');
  await startMixedExam();

  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Build a Test' }).click();
  await expect(page.getByRole('heading', { name: 'Build a Test' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /^Angles / })).toBeChecked();

  await startMixedExam();
  for (let i = 0; i < 2; i++) {
    await page.getByLabel('Your answer').fill(`Worked answer ${i + 1}`);
    await page.getByRole('button', { name: i === 0 ? 'Next Question' : /Submit & Review/ }).click();
  }
  await expect(page.getByText('Model answer')).toBeVisible();
  for (let i = 0; i < 2; i++) {
    let remaining = await page.locator('button[aria-pressed="false"]').count();
    while (remaining > 0) {
      await page.locator('button[aria-pressed="false"]').first().click();
      remaining--;
      await expect(page.locator('button[aria-pressed="false"]')).toHaveCount(remaining);
    }
    await page.getByRole('button', { name: /Next Question|See Results/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'Mixed Exam Complete!' })).toBeVisible();
  await page.getByRole('link', { name: 'Build another test' }).click();
  await expect(page.getByRole('heading', { name: 'Build a Test' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /^Angles / })).toBeChecked();
});
