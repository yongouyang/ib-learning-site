import { test, expect } from '@playwright/test';
import { completeQuiz } from './quiz-session';

test('builds a scoped test and reviews and retries mistakes', async ({ page }) => {
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

  await page.getByRole('button', { name: /Review answers/ }).click();
  await expect(page.getByText('Correct answer:').first()).toBeVisible();
  await page.getByRole('button', { name: /Retry mistakes/ }).click();
  await expect(page.getByRole('button', { name: /Review answers/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
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
