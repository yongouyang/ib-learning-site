import { test, expect } from '@playwright/test';
import { getPaperContent } from '../../src/content/registry.papers';

// Phase 4: free-response practice papers — index, self-marking flow, recorded result.
test.describe('Practice papers', () => {
  test('index lists the pilot set with marks and duration', async ({ page }) => {
    await page.goto('/papers');
    await expect(page.getByRole('heading', { name: 'Practice Papers', level: 1 })).toBeVisible();
    const setLink = page.locator('a[href="/papers/math-y7/math-y7-set-1"]');
    await expect(setLink).toBeVisible();
    await expect(setLink.getByText(/30 min · 8 questions · 20 marks/)).toBeVisible();
    await expect(setLink.getByText('Not attempted')).toBeVisible();
    // 15 courses × 2 sets, plus IGCSE Maths' third set (wave 2) — 31 set rows
    // in the DOM.
    await expect(page.locator('a[href^="/papers/"]')).toHaveCount(31);

    // Set 2 renders as a locked row for anonymous visitors: the preview links
    // exist in the DOM (one per course) but are inert/aria-hidden, so they are
    // NOT accessible links. ONE page-level premium card makes the pitch
    // (copy voice: say it once); each course gets a compact lock row.
    await expect(page.locator('a[href$="-set-2"]')).toHaveCount(15);
    await expect(page.getByRole('link', { name: /Practice Set 2/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'See Premium plans' })).toHaveCount(1);
    await expect(page.getByRole('link', { name: /Premium · Full exam sets/ })).toHaveCount(15);
  });

  // Phase 1b (docs/premium-content-protection-plan.md §4): a premium set's questions and mark
  // schemes are no longer in the build at all, so an anonymous visitor who guesses the URL gets the
  // premium pitch and NOTHING else. `set-1`'s own text is the control: the same course page DOES
  // carry its (free) questions.
  test('a premium set page leaks no content to an anonymous visitor', async ({ page }) => {
    await page.goto('/papers/math-y7/math-y7-set-2');
    await expect(page.getByRole('link', { name: 'See Premium plans' })).toBeVisible();
    // The runner never mounts: no answer boxes, no tick rows.
    await expect(page.getByLabel(/Your answer/i)).toHaveCount(0);
    await expect(page.locator('button[aria-pressed]')).toHaveCount(0);

    // The real assertion: the paper's own prose must appear NOWHERE in the delivered page, hydrated
    // DOM included. (The page's public *description* legitimately says "model answer for every
    // question", which is why this checks the paper's text rather than a word like "model answer".)
    const paper = getPaperContent('math-y7', 'math-y7-set-2')!;
    const strip = (value: string) => value.split('\\').join('');
    const probes = [
      ...paper.questions.flatMap((q) => [q.stem, q.modelAnswer, ...q.markscheme]),
    ]
      .map((value) => strip(value).replace(/\s+/g, ' ').trim().slice(0, 50))
      .filter((value) => value.length === 50);
    expect(probes.length).toBeGreaterThan(10);

    const markup = (await page.content()).split('\\').join('').replace(/\s+/g, ' ');
    for (const probe of probes) expect(markup).not.toContain(probe);

    // The inert preview is built from public metadata (this set ships 8 questions / 20 marks).
    await expect(page.getByText(/8 questions · 20 marks/)).toBeVisible();
  });

  test('a full two-phase run records the result', async ({ page }) => {
    await page.goto('/papers/math-y7/math-y7-set-1');
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();

    // Timed answering phase: write an answer per question, free navigation.
    // 8 questions; the last one shows "Submit & Review" instead of Next.
    for (let i = 0; i < 8; i++) {
      // Marks badge and difficulty chip are visible on each question.
      await expect(page.getByText(/\d marks?/).first()).toBeVisible();

      await page.getByLabel(/Your answer/i).fill('My worked answer.');
      const nextBtn = page.getByRole('button', { name: /Next Question/i });
      if (await nextBtn.count()) {
        await nextBtn.click();
        // The old card exits before the new one mounts (AnimatePresence
        // mode="wait") — wait for a fresh, empty textarea before filling.
        await expect(page.getByLabel(/Your answer/i)).toHaveValue('');
      }
    }
    await page.getByRole('button', { name: /Submit & Review/i }).click();

    // Untimed review phase: the clock is gone; tick every point (full marks).
    await expect(page.getByText('Model answer')).toBeVisible();
    await expect(page.getByText(/Time remaining/)).toHaveCount(0);
    for (let i = 0; i < 8; i++) {
      // Wait for this question's unticked points to mount (card animation),
      // then tick them one at a time, confirming each state flip.
      await expect(page.locator('button[aria-pressed="false"]').first()).toBeVisible();
      let remaining = await page.locator('button[aria-pressed="false"]').count();
      while (remaining > 0) {
        await page.locator('button[aria-pressed="false"]').first().click();
        remaining--;
        await expect(page.locator('button[aria-pressed="false"]')).toHaveCount(remaining);
      }

      const nextBtn = page.getByRole('button', { name: /Next Question|See Results/ });
      await expect(nextBtn).toBeVisible();
      await nextBtn.click();
    }

    // Full marks: 20/20 = 100%.
    await expect(page.getByRole('heading', { name: 'Paper Complete!' })).toBeVisible();
    await expect(page.getByText('100%')).toBeVisible();
    await expect(page.getByText('20 out of 20 marks')).toBeVisible();

    // Recorded: index shows a best score for the set.
    await page.goto('/papers');
    const setLink = page.locator('a[href="/papers/math-y7/math-y7-set-1"]');
    await expect(setLink.getByText('Best: 100%')).toBeVisible();
  });

  test('progress page links to practice papers', async ({ page }) => {
    await page.goto('/progress');
    await page.getByRole('link', { name: /Practice Papers/ }).click();
    await page.waitForURL('/papers');
    await expect(page.getByRole('heading', { name: 'Practice Papers', level: 1 })).toBeVisible();
  });
});
