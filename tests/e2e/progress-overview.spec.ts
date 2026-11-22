import { test, expect } from '@playwright/test';

const NOW = '2026-11-22T08:00:00.000Z';

function subjectCard(page: import('@playwright/test').Page, subjectId: string) {
  return page.locator(`details[data-subject-progress="${subjectId}"]`);
}

test.describe('Progress overview', () => {
  test('keeps topic lists collapsed until their subject and year are expanded', async ({ page }) => {
    await page.goto('/progress');

    const math = subjectCard(page, 'math');
    await expect(math).toBeVisible();
    await expect(math).not.toHaveAttribute('open', '');
    await expect(math.getByRole('link', { name: /Written Calculations/ })).toBeHidden();

    await math.locator(':scope > summary').click();
    await expect(math).toHaveAttribute('open', '');
    await expect(math.getByRole('heading', { name: 'KS3 · Year 7' })).toBeVisible();
    await expect(math.getByRole('heading', { name: 'IGCSE' })).toBeVisible();
    await expect(math.getByRole('heading', { name: 'IB DP' })).toBeVisible();
    await expect(math).toContainText('Flashcards known');
    await expect(math.getByRole('link', { name: /Written Calculations/ })).toBeHidden();

    const year7 = math.locator('details[data-topic-group="ks3-y7"]');
    await expect(year7).not.toHaveAttribute('open', '');
    await year7.locator(':scope > summary').click();
    await expect(year7).toHaveAttribute('open', '');
    await expect(math.getByRole('link', { name: /Written Calculations/ })).toBeVisible();

    await math.locator(':scope > summary').click();
    await expect(math.getByRole('link', { name: /Written Calculations/ })).toBeHidden();
  });

  test('filters subjects and topic groups by curriculum stage', async ({ page }) => {
    await page.goto('/progress');

    const dpFilter = page.getByRole('button', { name: /^IB DP/ });
    await dpFilter.click();
    await expect(dpFilter).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('details[data-subject-progress]')).toHaveCount(1);
    await expect(subjectCard(page, 'german')).toHaveCount(0);

    const math = subjectCard(page, 'math');
    await math.locator(':scope > summary').click();
    await expect(math.getByRole('heading', { name: 'IB DP', exact: true })).toBeVisible();
    await expect(math.getByRole('heading', { name: 'KS3 · Year 7' })).toHaveCount(0);
    await expect(math.getByRole('heading', { name: 'IGCSE', exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Show all stages' }).click();
    await expect(dpFilter).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('details[data-subject-progress]')).toHaveCount(10);
    await expect(math).not.toHaveAttribute('open', '');
  });

  test('summarises scores for each stage and year from stored attempts', async ({ page }) => {
    await page.addInitScript(({ now }) => {
      localStorage.setItem('iblearn_progress', JSON.stringify({
        version: 2,
        userProgress: { totalStars: 13, currentStreakDays: 2, lastStudyDate: now },
        topicProgress: {
          'math:math-yr7-angles': {
            topicId: 'math-yr7-angles', subjectId: 'math', topicTitle: 'Angles', subjectTitle: 'Math',
            attempts: [{ date: now, correctCount: 8, totalCount: 10 }],
          },
          'math:math-igcse-algebraic-manipulation': {
            topicId: 'math-igcse-algebraic-manipulation', subjectId: 'math', topicTitle: 'Algebraic Manipulation', subjectTitle: 'Math',
            attempts: [{ date: now, correctCount: 5, totalCount: 10 }],
          },
        },
        examResults: [],
        ladderProgress: {},
        flashcardProgress: {},
      }));
    }, { now: NOW });
    await page.goto('/progress');

    await expect(page.getByRole('button', { name: /^KS3/ })).toContainText('80% average');
    await expect(page.getByRole('button', { name: /^IGCSE/ })).toContainText('50% average');
    await expect(subjectCard(page, 'math')).toContainText('65% average');

    const math = subjectCard(page, 'math');
    await math.locator(':scope > summary').click();
    await expect(math.getByRole('heading', { name: 'KS3 · Year 7' }).locator('..')).toContainText('80% average');
    await expect(math.getByRole('heading', { name: 'IGCSE', exact: true }).locator('..')).toContainText('50% average');

    await page.getByRole('button', { name: /^IGCSE/ }).click();
    await expect(math).toContainText(/1\/\d+ topics started · 50% average/);
    await expect(math).not.toHaveAttribute('open', '');
    await math.locator(':scope > summary').click();
    const igcse = math.locator('details[data-topic-group="igcse"]');
    await expect(math.getByRole('link', { name: /Algebraic Manipulation/ })).toBeHidden();
    await igcse.locator(':scope > summary').click();
    await expect(math.getByRole('link', { name: /Algebraic Manipulation/ })).toContainText('50%');
    await expect(math.locator('a[href="/subjects/math/math-yr7-angles/quiz"]')).toHaveCount(0);

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
