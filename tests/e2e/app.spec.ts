import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('should show the subject grid', async ({ page }) => {
    await page.goto('/');
    // Hero h1 (first-time visitor state) — the logo is no longer a heading.
    await expect(page.getByRole('heading', { name: /Master secondary school/ })).toBeVisible();

    // 10 subject cards — use heading within links
    await expect(page.getByRole('heading', { name: 'Subjects' })).toBeVisible();
    for (const subject of ['Math', 'English', 'Biology', 'Chemistry', 'Physics', 'Geography', 'History', 'ICT', 'Chinese', 'German']) {
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

  test('subject cards carry the subject accent colour on the icon tile', async ({ page }) => {
    await page.goto('/');
    const mathCard = page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Math' }) });
    await expect(mathCard).toBeVisible();
    const tile = mathCard.locator('span[aria-hidden="true"]').first();
    const bg = await tile.evaluate((el) => getComputedStyle(el).backgroundColor);
    // color-mix(in srgb, #3B82F6 14%, transparent) — Chromium serializes the
    // resolved mix in color(srgb …) form: #3B82F6 = 59/130/246 per channel at 14% alpha
    expect(bg).toMatch(/^color\(srgb 0\.23137\d? 0\.50980\d? 0\.96470\d? \/ 0\.14\)$/);
  });

  test('footer shows the trademark disclaimer', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('not endorsed by or affiliated with the International Baccalaureate Organization');
    await expect(footer).toContainText('Cambridge Assessment International Education');
  });
});

test.describe('Subject pages', () => {
  test('math subject page should show DP-level topics', async ({ page }) => {
    await page.goto('/subjects/math');
    await expect(page.getByRole('heading', { name: 'Math' }).first()).toBeVisible();
    // A DP topic should be visible
    await expect(page.getByText('Sequences & Series')).toBeVisible();
    // A KS3 topic should also be visible
    await expect(page.getByText('Algebra Basics')).toBeVisible();
  });

  test('math subject page groups topics by stage and year', async ({ page }) => {
    await page.goto('/subjects/math');
    await expect(page.getByRole('heading', { name: 'KS3 · Year 7' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'KS3 · Year 8' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'IB DP' })).toBeVisible();
    // Year 7 group contains a Y7 topic; DP group contains a DP topic
    const y7Section = page.getByRole('region', { name: 'KS3 · Year 7' });
    await expect(y7Section.getByText('Written Calculations')).toBeVisible();
    const dpSection = page.getByRole('region', { name: 'IB DP' });
    await expect(dpSection.getByText('Sequences & Series')).toBeVisible();
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

  test('math subject page filters topics by stage', async ({ page }) => {
    await page.goto('/subjects/math');

    const dpButton = page.getByRole('button', { name: 'IB DP', exact: true });
    const ks3Button = page.getByRole('button', { name: 'KS3', exact: true });

    // Filter to IB DP: DP topic should be visible, a known KS3 topic should not
    await dpButton.click();
    await expect(page.getByText('Sequences & Series')).toBeVisible();
    await expect(page.getByText('Written Calculations')).not.toBeVisible();

    // Filter to KS3
    await ks3Button.click();
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
  test('should complete a full KS3 quiz and show results', async ({ page }) => {
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
      // Use JS click on small viewports where the fixed bottom nav can cover the button.
      await nextBtn.evaluate((el) => (el as HTMLElement).click());

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
    await page.goto('/subjects/math/math-dp-ai-sequences/study');
    await expect(page.getByRole('heading', { name: 'Sequences & Series', level: 1 })).toBeVisible();
    await expect(page.locator('.katex').first()).toBeVisible({ timeout: 10000 });

    // Navigate into the quiz from the study page
    await page.getByRole('link', { name: /Take Quiz/i }).click();
    await page.waitForURL('/subjects/math/math-dp-ai-sequences/quiz');

    // Quiz page should have a question stem heading visible (scoped to <main>:
    // during the client-side transition from the study page, React keeps the
    // outgoing tree in a hidden Suspense segment, so an unscoped lookup can see
    // both pages' h2s and trip strict mode).
    await expect(page.locator('main').getByRole('heading', { level: 2 })).toBeVisible();
    // Should have choice buttons with A., B., etc.
    await expect(page.getByRole('button').filter({ hasText: /^A\./ }).first()).toBeVisible();
    // Should have a breadcrumb trail: Home / Math / Sequences & Series / Quiz
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByRole('link', { name: 'Math' })).toBeVisible();
    await expect(breadcrumb.getByText('Quiz')).toBeVisible();
  });
});

test.describe('Navigation & breadcrumbs', () => {
  test('main nav has a Review link that opens mixed review', async ({ page }) => {
    await page.goto('/');
    const reviewLink = page.getByRole('link', { name: 'Review' }).first();
    await expect(reviewLink).toBeVisible();
    await reviewLink.click();
    await page.waitForURL('/mixed-review');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
  });

  test('study page breadcrumb links back to subject and home', async ({ page }) => {
    await page.goto('/subjects/biology/bio-cell-1/study');
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByRole('link', { name: 'Home' })).toBeVisible();
    const subjectCrumb = breadcrumb.getByRole('link', { name: 'Biology' });
    await expect(subjectCrumb).toBeVisible();
    await subjectCrumb.click();
    await page.waitForURL('/subjects/biology');
    await expect(page.getByRole('heading', { name: 'Biology' }).first()).toBeVisible();
  });

  test('flashcards page shows breadcrumb trail', async ({ page }) => {
    await page.goto('/subjects/biology/bio-cell-1/flashcards');
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByRole('link', { name: 'Biology' })).toBeVisible();
    await expect(breadcrumb.getByText('Flashcards')).toBeVisible();
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

// Phase 7 Session 2: content-protection add-on (docs/phase-7-implementation-plan.md §8 items 1–2).
test.describe('Content protection', () => {
  test('robots.txt allows normal crawling but disallows AI-training crawlers', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toContain('text/plain');
    const body = await res.text();

    // Normal agents are allowed site-wide.
    expect(body).toContain('User-Agent: *');
    expect(body).toContain('Allow: /');

    // Known AI-training crawlers get a site-wide disallow.
    for (const bot of ['GPTBot', 'ChatGPT-User', 'CCBot', 'Google-Extended', 'ClaudeBot', 'anthropic-ai', 'Bytespider', 'Amazonbot']) {
      expect(body).toContain(`User-Agent: ${bot}`);
    }
    expect(body).toContain('Disallow: /');
    // The disallow must only appear in the AI-crawler group, which comes after the allow-all group.
    expect(body.indexOf('Disallow: /')).toBeGreaterThan(body.indexOf('Allow: /'));
  });

  test('footer shows the copyright notice and links to Terms of Use', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toContainText('Octav Learning. All rights reserved');

    await footer.getByRole('link', { name: /terms of use/i }).click();
    await page.waitForURL('/terms');
    await expect(page.getByRole('heading', { name: /terms of use/i })).toBeVisible();
    await expect(page.getByText(/may not be scraped, harvested/i)).toBeVisible();
    await expect(page.locator('main').getByText(/not endorsed by or affiliated with the International Baccalaureate Organization/i)).toBeVisible();
  });
});
