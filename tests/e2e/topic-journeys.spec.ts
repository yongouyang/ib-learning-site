import { test, expect } from '@playwright/test';
import { getAllContentTopics } from '../../src/content/registry.content';
import { materializeTemplates } from '../../src/lib/generators';
import { hasVariantGroups, groupKeyOf } from '../../src/lib/quiz-utils';

// The quiz session is authored questions PLUS one materialized instance per template
// (QuizPageClient), and a grouped topic then samples one question per variant group.
// This spec used to assert `topic.questions.length` and so had already rotted for the
// templated topics the moment templates landed — a defect nobody saw because the sweep
// is disabled by default. Compute what the page actually shows instead.
function sessionSize(topic: ReturnType<typeof getAllContentTopics>[number]): number {
  const pool = [...topic.questions, ...materializeTemplates(topic, `${topic.id}:sweep`)];
  return hasVariantGroups(topic.questions) ? new Set(pool.map(groupKeyOf)).size : pool.length;
}

// This sweep is intentionally skipped by default because it exercises every topic and is slower
// than the regular e2e suite. Run it with RUN_TOPIC_SWEEP=1 (ideally against a production build).
const runSweep = !!process.env.RUN_TOPIC_SWEEP;
test.skip(!runSweep, 'Topic sweep disabled by default; set RUN_TOPIC_SWEEP=1 to enable');

// 10 min, not the 5-min default: the sweep walks EVERY topic (245 as of 2026-09-21)
// and the corpus has outgrown the old cap — at 233 topics it finished in 4.6 min, so
// the DP AA batch pushed it past 300s and the run died mid-sweep with an
// aggregate-timeout cascade, not a real page failure.
test.setTimeout(600000);

test('every topic can load study, flashcards and quiz pages', async ({ page }) => {
  const failures: string[] = [];

  // Content topics: the sweep asserts on question and flashcard counts, which metadata no longer
  // carries (Phase 1a).
  for (const topic of getAllContentTopics()) {
    {
      const basePath = `/subjects/${topic.subjectId}/${topic.id}`;

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
        const total = sessionSize(topic);
        await page.goto(`${basePath}/quiz`);
        await expect(page.getByText(`1/${total}`)).toBeVisible({ timeout: 10000 });
        const firstChoice = page.getByRole('button').filter({ hasText: /^A\./ }).first();
        await expect(firstChoice).toBeVisible();
        await firstChoice.click();

        const nextButton = page.getByRole('button', { name: /Next Question|See Results/ });
        await expect(nextButton).toBeVisible();
        await nextButton.click();

        if (total > 1) {
          await expect(page.getByText(`2/${total}`)).toBeVisible({ timeout: 10000 });
        } else {
          await expect(page.getByRole('heading', { name: 'Quiz Complete!' })).toBeVisible({ timeout: 10000 });
        }
      } catch (error) {
        failures.push(`${topic.subjectId} › ${topic.title}: ${(error as Error).message.split('\n')[0]}`);
      }
    }
  }

  expect(failures, `Topic smoke failures:\n${failures.join('\n')}`).toHaveLength(0);
});
