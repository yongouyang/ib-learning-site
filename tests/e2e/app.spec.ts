import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('should show the subject grid', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'IBLearn' })).toBeVisible();

    // 5 subject cards — use heading within links
    await expect(page.getByRole('heading', { name: 'Subjects' })).toBeVisible();
    for (const subject of ['Math', 'English', 'Biology', 'Chemistry', 'Physics']) {
      await expect(page.getByRole('heading', { name: subject })).toBeVisible();
    }
  });

  test('should navigate to a subject', async ({ page }) => {
    await page.goto('/');

    // Click the Math subject card and wait for navigation to finish
    const mathCard = page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Math' }) });
    await expect(mathCard).toBeVisible();
    await mathCard.click();
    await page.waitForURL('/subjects/math');

    await expect(page.getByRole('heading', { name: 'Math' }).first()).toBeVisible();
    // Topic titles visible
    await expect(page.getByText('Written Calculations')).toBeVisible();
  });

  test('should navigate to progress from nav', async ({ page }) => {
    await page.goto('/progress');
    await expect(page.getByRole('heading', { name: 'My Progress' })).toBeVisible();
    await expect(page.getByText('Total Stars')).toBeVisible();
  });

  test('subject cards use subject accent colour on top border', async ({ page }) => {
    await page.goto('/');
    const mathCard = page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Math' }) });
    await expect(mathCard).toBeVisible();
    const borderTopColor = await mathCard.evaluate((el) => getComputedStyle(el).borderTopColor);
    // Tailwind blue-500 / #3B82F6 in rgb
    expect(borderTopColor).toBe('rgb(59, 130, 246)');
  });
});

test.describe('Subject pages', () => {
  test('math subject page should show DP-level topics', async ({ page }) => {
    await page.goto('/subjects/math');
    await expect(page.getByRole('heading', { name: 'Math' }).first()).toBeVisible();
    // A DP topic should be visible
    await expect(page.getByText('Sequences & Series')).toBeVisible();
    // An MYP topic should also be visible
    await expect(page.getByText('Algebra Basics')).toBeVisible();
  });

  test('biology subject page should show enriched topics', async ({ page }) => {
    await page.goto('/subjects/biology');
    await expect(page.getByText('Cell Structure')).toBeVisible();
    await expect(page.getByText('Genetics')).toBeVisible();
    await expect(page.getByText('Ecology')).toBeVisible();
    // Should now show 11 topics after enrichment (was 5)
    const topicLinks = page.locator('a[href*="/biology/"]');
    await expect(topicLinks.first()).toBeVisible();
  });

  test('math subject page filters topics by search query', async ({ page }) => {
    await page.goto('/subjects/math');
    const searchInput = page.getByRole('textbox', { name: /Search topics/i });
    await expect(searchInput).toBeVisible();

    // Search for a topic that exists
    await searchInput.fill('Sequences');
    await expect(page.getByText('Sequences & Series')).toBeVisible();
    await expect(page.getByText('Algebra Basics')).not.toBeVisible();

    // Clear search
    await page.getByRole('button', { name: /Clear search/i }).click();
    await expect(page.getByText('Algebra Basics')).toBeVisible();
  });

  test('math subject page filters topics by level', async ({ page }) => {
    await page.goto('/subjects/math');

    const dpButton = page.getByRole('button', { name: 'DP', exact: true });
    const mypButton = page.getByRole('button', { name: 'MYP', exact: true });

    // Filter to DP: DP badge should be visible, a known MYP topic should not
    await dpButton.click();
    await expect(page.getByText('Sequences & Series')).toBeVisible();
    await expect(page.getByText('Written Calculations')).not.toBeVisible();

    // Filter to MYP
    await mypButton.click();
    await expect(page.getByText('Written Calculations')).toBeVisible();
    await expect(page.getByText('Sequences & Series')).not.toBeVisible();
  });

  test('topic cards use subject accent colour on left border', async ({ page }) => {
    await page.goto('/subjects/math');
    const topicCard = page.locator('.card').filter({ has: page.locator('a[href*="/math/"]') }).first();
    await expect(topicCard).toBeVisible();
    const borderLeftColor = await topicCard.evaluate((el) => getComputedStyle(el).borderLeftColor);
    expect(borderLeftColor).toBe('rgb(59, 130, 246)');
  });
});

test.describe('Quiz flow', () => {
  test('should complete a full MYP quiz and show results', async ({ page }) => {
    await page.goto('/subjects/math/math-yr7-calculations/quiz');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();

    // Answer all questions (the topic has 15 questions after enrichment)
    const totalQuestions = 15;
    for (let i = 0; i < totalQuestions; i++) {
      const choice = page.getByRole('button').filter({ hasText: /^A\./ }).first();
      await expect(choice).toBeVisible();
      await choice.click();

      const nextBtn = page.getByRole('button', { name: /Next Question|See Results/ });
      await expect(nextBtn).toBeVisible();
      await nextBtn.click();

      if (i < totalQuestions - 1) {
        await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
      }
    }

    // Should see results page
    await expect(page.getByRole('heading', { name: 'Quiz Complete!' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back' })).toBeVisible();
  });

  test('should load a DP-level quiz page with KaTeX-rendered math', async ({ page }) => {
    // Start on the study page for the DP topic where notes render KaTeX
    await page.goto('/subjects/math/math-dp-sequences/study');
    await expect(page.getByRole('heading', { name: 'Sequences & Series', level: 1 })).toBeVisible();
    await expect(page.locator('.katex').first()).toBeVisible({ timeout: 10000 });

    // Navigate into the quiz from the study page
    await page.getByRole('link', { name: /Take Quiz/i }).click();
    await page.waitForURL('/subjects/math/math-dp-sequences/quiz');

    // Quiz page should have a question stem heading visible
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    // Should have choice buttons with A., B., etc.
    await expect(page.getByRole('button').filter({ hasText: /^A\./ }).first()).toBeVisible();
    // Should have a back link
    await expect(page.getByRole('link', { name: /Back/i })).toBeVisible();
  });
});

test.describe('Progress page', () => {
  test('should show stats cards', async ({ page }) => {
    await page.goto('/progress');
    await expect(page.getByRole('heading', { name: 'My Progress' })).toBeVisible();
    await expect(page.getByText('Total Stars')).toBeVisible();
    await expect(page.getByText('Day Streak')).toBeVisible();
    await expect(page.getByText('Topics Done')).toBeVisible();
  });
});
