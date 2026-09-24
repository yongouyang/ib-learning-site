import { expect, type Page } from '@playwright/test';

/**
 * Answer every question of a quiz session by choosing option A, and stop on the RESULTS
 * SCREEN — never on a counted length.
 *
 * The caller must be on an UNANSWERED question (a fresh quiz page). Two things make that
 * precondition load-bearing:
 *   - an answered question has its choices DISABLED (`disabled={answerState !== 'unanswered'}`
 *     in QuizGame), so a helper that entered on one would wait forever for an enabled choice;
 *   - right after Next is clicked, the previous question's disabled buttons are still in the
 *     DOM for a frame, so a check that SAMPLES `.first()` reads the old, disabled button and
 *     silently skips the click — the question then never gets answered and the run hangs on a
 *     Next button that never appears. The fix is to WAIT for an enabled choice (`toBeEnabled`
 *     re-resolves the locator on every retry) rather than to sample it once.
 *
 * Why loop instead of counting: a topic's session size is its authored questions PLUS one
 * instance per template, so it changes the moment a generator is wired into the topic while
 * every JSON count stays identical. `math-yr7-calculations` went 15 -> 16 when
 * `math-integer-operations` was wired in on 2026-09-24, and a hard-coded 15 in `app.spec.ts`
 * failed all three e2e projects — green unit tests, green content gates, red CI.
 * `analytics.spec.ts` and `progress-sync.spec.ts` had each decided the same thing privately;
 * this is one copy so there is one place for it to stay honest.
 *
 * Next is clicked through `evaluate` because the fixed bottom nav covers it on the
 * phone-sized projects.
 */
export async function completeQuiz(page: Page): Promise<void> {
  const results = page.getByRole('heading', { name: 'Quiz Complete!' });
  const questionHeading = page.getByRole('heading', { level: 2 });
  const choice = page.getByRole('button').filter({ hasText: /^A\./ }).first();
  const nextBtn = page.getByRole('button', { name: /Next Question|See Results/ });

  for (let i = 0; i < 40; i++) {
    if (await results.isVisible()) break;

    await expect(questionHeading).toBeVisible({ timeout: 10_000 });
    await expect(choice).toBeEnabled({ timeout: 10_000 });
    await choice.click();

    await expect(nextBtn).toBeVisible({ timeout: 10_000 });
    const label = (await nextBtn.textContent()) ?? '';
    await nextBtn.evaluate((el) => (el as HTMLElement).click());
    if (/See Results/.test(label)) break;

    // The next question has only really arrived once Next is gone again.
    await expect(nextBtn).toBeHidden({ timeout: 10_000 });
  }

  await expect(results, 'the quiz session never reached the results screen').toBeVisible();
}
