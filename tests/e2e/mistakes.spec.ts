import { test, expect } from '@playwright/test';

const question = {
  id: 'angles-q1', stem: 'Which angle is reflex?', choices: ['150°', '90°', '200°', '45°'],
  correctIndex: 2, explanation: 'A reflex angle is between 180° and 360°.', difficulty: 'easy', variantOf: 'angle-types',
};

async function seedAttempts(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate((q) => {
    localStorage.setItem('iblearn_progress', JSON.stringify({
      version: 2,
      userProgress: { totalStars: 0, currentStreakDays: 1, lastStudyDate: '2026-11-07' },
      topicProgress: {
        'math:math-yr7-angles': {
          topicId: 'math-yr7-angles', subjectId: 'math', topicTitle: 'Angles', subjectTitle: 'Math',
          attempts: [
            { date: '2026-11-06T10:00:00.000Z', correctCount: 0, totalCount: 1, questionResults: [{ questionId: q.id, correct: false, selectedIndex: 0, question: q }] },
            { date: '2026-11-07T10:00:00.000Z', correctCount: 1, totalCount: 1, questionResults: [{ questionId: q.id, correct: true, selectedIndex: 2, question: q }] },
          ],
        },
      },
      examResults: [], ladderProgress: {}, flashcardProgress: {},
    }));
  }, question);
}

test('shows unresolved mistakes, improvement and weak-topic test creation', async ({ page }) => {
  await seedAttempts(page);
  await page.goto('/mistakes');
  await expect(page.getByRole('heading', { name: 'Mistake Notebook' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Which angle is reflex?' })).toBeVisible();
  await expect(page.getByText('150°', { exact: true })).toBeVisible();
  await expect(page.getByText('200°', { exact: true })).toBeVisible();
  await expect(page.getByText('First attempt 0% → latest 100% (+100 points)')).toBeVisible();
  await expect(page.getByText('One related correction — one more resolves this mistake')).toBeVisible();

  await page.getByRole('link', { name: 'Practise my weak areas' }).click();
  await expect(page.getByRole('heading', { name: 'Weak-area test' })).toBeVisible();
  await expect(page.getByText('1 topic selected: Angles.')).toBeVisible();
  await page.getByRole('button', { name: 'Practise my weak areas' }).click();
  await expect(page.getByText('1/10')).toBeVisible();
});

test('empty notebook explains the next action', async ({ page }) => {
  await page.goto('/mistakes');
  await expect(page.getByRole('heading', { name: 'No unresolved mistakes' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Build a practice test' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Turn weak areas into your next test' })).toHaveCount(0);
});
