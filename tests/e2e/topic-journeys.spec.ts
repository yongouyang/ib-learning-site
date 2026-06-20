import { test, expect } from '@playwright/test';
import { getSubjects } from '../../src/content/registry';

// This sweep is intentionally skipped by default because it exercises every topic and is slower
// than the regular e2e suite. Run it with RUN_TOPIC_SWEEP=1 (ideally against a production build).
const runSweep = !!process.env.RUN_TOPIC_SWEEP;
test.skip(!runSweep, 'Topic sweep disabled by default; set RUN_TOPIC_SWEEP=1 to enable');

test.setTimeout(300000);

test('every topic can load study, flashcards and quiz pages', async ({ page }) => {
  const failures: string[] = [];

  for (const subject of getSubjects()) {
    for (const topic of subject.topics) {
      const basePath = `/subjects/${subject.id}/${topic.id}`;

      try {
        // 1. Study page renders and exposes the action links
        await page.goto(`${basePath}/study`);
        await expect(page.getByRole('heading', { name: topic.title, level: 1 })).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('link', { name: /Study Flashcards/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /Take Quiz/i })).toBeVisible();

        // 2. Flashcards page renders and the first card can be flipped
        await page.goto(`${basePath}/flashcards`);
        await expect(page.getByText(`1/${topic.flashcards.length}`)).toBeVisible({ timeout: 10000 });
        const card = page.locator('.card').filter({ hasText: 'Tap to flip' });
        await expect(card).toBeVisible();
        await card.click();

        // 3. Quiz page renders and the first question can be answered
        await page.goto(`${basePath}/quiz`);
        await expect(page.getByText(`1/${topic.questions.length}`)).toBeVisible({ timeout: 10000 });
        const firstChoice = page.getByRole('button').filter({ hasText: /^A\./ }).first();
        await expect(firstChoice).toBeVisible();
        await firstChoice.click();

        const nextButton = page.getByRole('button', { name: /Next Question|See Results/ });
        await expect(nextButton).toBeVisible();
        await nextButton.click();

        if (topic.questions.length > 1) {
          await expect(page.getByText(`2/${topic.questions.length}`)).toBeVisible({ timeout: 10000 });
        } else {
          await expect(page.getByRole('heading', { name: 'Quiz Complete!' })).toBeVisible({ timeout: 10000 });
        }
      } catch (error) {
        failures.push(`${subject.name} › ${topic.title}: ${(error as Error).message.split('\n')[0]}`);
      }
    }
  }

  expect(failures, `Topic smoke failures:\n${failures.join('\n')}`).toHaveLength(0);
});
