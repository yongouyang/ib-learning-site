import { test, expect, type Page } from '@playwright/test';

// Phase C (progress sync) e2e — offline-first background sync against the real
// /api/progress routes running on the shared dummy universe (PROGRESS_STORAGE
// defaults to dummy and shares auth's in-memory universe; AUTH_TEST_MODE=1 code
// 123456). Desktop Chrome only.

function uniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send sign-in code' }).click();
  await expect(page.getByText(/Enter the 6-digit code/)).toBeVisible();
  await page.getByLabel('6-digit code').fill('123456');
  await page.getByRole('button', { name: 'Verify code' }).click();
  await expect(page).toHaveURL('/');
}

/** Answer a short quiz (easy filter) through to "Quiz Complete!". */
async function completeQuiz(page: Page) {
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
  for (let i = 0; i < 30; i++) {
    const choice = page.getByRole('button').filter({ hasText: /^A\./ }).first();
    await expect(choice).toBeVisible();
    await choice.click();

    const nextBtn = page.getByRole('button', { name: /Next Question|See Results/ });
    await expect(nextBtn).toBeVisible();
    const label = (await nextBtn.textContent()) ?? '';
    await nextBtn.evaluate((el) => (el as HTMLElement).click());

    if (/See Results/.test(label)) {
      await expect(page.getByRole('heading', { name: 'Quiz Complete!' })).toBeVisible();
      return;
    }
  }
  throw new Error('quiz did not complete within 30 questions');
}

/** Total topic attempts across all profiles on the server. */
async function serverAttemptCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const res = await fetch('/api/progress');
    if (!res.ok) return -1;
    const body = (await res.json()) as { profiles?: Record<string, { topicProgress?: Record<string, { attempts?: unknown[] }> }> };
    let n = 0;
    for (const p of Object.values(body.profiles ?? {})) {
      for (const tp of Object.values(p.topicProgress ?? {})) {
        n += (tp.attempts ?? []).length;
      }
    }
    return n;
  });
}

/** True when any namespaced local store has at least one topic attempt. */
async function hasLocalTopicAttempt(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('octav_progress:')) {
        const data = JSON.parse(localStorage.getItem(key)!) as {
          topicProgress?: Record<string, { attempts?: unknown[] }>;
        };
        for (const tp of Object.values(data.topicProgress ?? {})) {
          if ((tp.attempts ?? []).length > 0) return true;
        }
      }
    }
    return false;
  });
}

test.describe('progress sync', () => {
  test('offline quiz attempt flushes when back online', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop Chrome only');
    await signIn(page, uniqueEmail());

    await page.goto('/subjects/math/math-yr7-equations/quiz?difficulty=easy');
    await expect(page.getByRole('button').filter({ hasText: /^A\./ }).first()).toBeVisible();
    await page.context().setOffline(true);

    await completeQuiz(page);

    // Offline-first: the attempt is recorded locally (UI completed + persisted).
    await expect(page.getByRole('heading', { name: 'Quiz Complete!' })).toBeVisible();
    expect(await hasLocalTopicAttempt(page)).toBe(true);

    await page.context().setOffline(false);

    // Sync flushes on the online event.
    await expect.poll(() => serverAttemptCount(page), { timeout: 30_000 }).toBeGreaterThan(0);
  });

  test('first-login migration uploads anonymous progress exactly once', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop Chrome only');

    // Seed the anonymous iblearn_progress blob with one topic attempt (v2 shape).
    await page.addInitScript(() => {
      localStorage.setItem(
        'iblearn_progress',
        JSON.stringify({
          version: 2,
          userProgress: { totalStars: 3, currentStreakDays: 1, lastStudyDate: '2026-01-01' },
          topicProgress: {
            'math:math-yr7-equations': {
              topicId: 'math-yr7-equations',
              subjectId: 'math',
              topicTitle: 'Solving Equations',
              subjectTitle: 'Math',
              attempts: [{ date: '2026-01-01T00:00:00.000Z', correctCount: 9, totalCount: 10 }],
            },
          },
          examResults: [],
          ladderProgress: {},
          flashcardProgress: {},
        })
      );
    });

    await signIn(page, uniqueEmail());

    // The migration bulk-uploads the anonymous attempt.
    await expect.poll(() => serverAttemptCount(page), { timeout: 30_000 }).toBe(1);

    // A subsequent login (reload → re-merge) does NOT duplicate it.
    await page.reload();
    await expect.poll(() => serverAttemptCount(page), { timeout: 30_000 }).toBe(1);
  });

  test('a pending queue survives a reload of the logged-in session', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop Chrome only');
    await signIn(page, uniqueEmail());

    // Discover the signed-in identity and plant a pending flashcard event
    // directly in the queue (recorded by a hypothetical offline stretch —
    // planting it keeps the test deterministic).
    const planted = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me');
      const body = (await res.json()) as { user: { userId: string; childProfiles: { profileId: string }[] } };
      const userId = body.user.userId;
      const profileId = body.user.childProfiles[0].profileId;
      localStorage.setItem(
        'octav_sync_queue',
        JSON.stringify([
          {
            userId,
            profileId,
            event: {
              type: 'flashcardResult',
              profileId,
              cardId: 'bio-cell-1-f1',
              status: 'known',
              knownStreak: 2,
              date: '2026-08-15T10:00:00.000Z',
            },
          },
        ])
      );
      return { userId, profileId };
    });

    // Reload the signed-in session: the mount-time identity effect used to run
    // as "logged out" and PURGE the queue before /me answered (a superseded
    // me() settled authLoaded with user still null) — the flashcard would then
    // never reach the server (flashcards are not re-derived by the merge's
    // re-upload path).
    await page.reload();
    await expect(page).toHaveURL('/');

    await expect
      .poll(
        () =>
          page.evaluate(async (profileId) => {
            const res = await fetch('/api/progress');
            if (!res.ok) return false;
            const body = (await res.json()) as { profiles?: Record<string, { flashcardProgress?: Record<string, unknown> }> };
            return Boolean(body.profiles?.[profileId]?.flashcardProgress?.['bio-cell-1-f1']);
          }, planted.profileId),
        { timeout: 30_000 }
      )
      .toBe(true);
  });

  test('a second account on the same device imports nothing (at-most-once migration)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop Chrome only');

    // Seed the anonymous blob, as a logged-out legacy device would carry it.
    await page.addInitScript(() => {
      localStorage.setItem(
        'iblearn_progress',
        JSON.stringify({
          version: 2,
          userProgress: { totalStars: 3, currentStreakDays: 1, lastStudyDate: '2026-01-01' },
          topicProgress: {
            'math:math-yr7-equations': {
              topicId: 'math-yr7-equations',
              subjectId: 'math',
              topicTitle: 'Solving Equations',
              subjectTitle: 'Math',
              attempts: [{ date: '2026-01-01T00:00:00.000Z', correctCount: 9, totalCount: 10 }],
            },
          },
          examResults: [],
          ladderProgress: {},
          flashcardProgress: {},
        })
      );
    });

    // Account A imports the anonymous blob once.
    await signIn(page, uniqueEmail());
    await expect.poll(() => serverAttemptCount(page), { timeout: 30_000 }).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem('iblearn_progress'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('octav_anon_claimed'))).toBe('1');

    // Sign out and in as account B on the SAME device. (The init script
    // re-seeds the anonymous blob on every navigation, so B's sign-in leaves a
    // fresh id-less blob behind — the device claim must stop B importing it.)
    await page.locator('header').getByRole('button', { name: 'Me', exact: true }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.locator('header').getByRole('link', { name: 'Sign in' })).toBeVisible();
    await signIn(page, uniqueEmail());

    // Give any (incorrect) migration a chance to run — B's OWN progress must
    // stay empty (the at-most-once device claim held), and the re-seeded blob
    // must still be untouched (no ids assigned = no import was attempted).
    await page.waitForTimeout(3_000);
    expect(await serverAttemptCount(page)).toBe(0);
    const blob = await page.evaluate(() => JSON.parse(localStorage.getItem('iblearn_progress') ?? 'null'));
    expect(blob.topicProgress['math:math-yr7-equations'].attempts[0].attemptId).toBeUndefined();
    expect(await page.evaluate(() => localStorage.getItem('octav_anon_claimed'))).toBe('1');
  });

  test('cross-device merge: a second context sees the synced attempt', async ({ page, browser, isMobile }) => {
    test.skip(isMobile, 'Desktop Chrome only');
    const email = uniqueEmail();

    // Device A: record + sync.
    await signIn(page, email);
    await page.goto('/subjects/math/math-yr7-equations/quiz?difficulty=easy');
    await expect(page.getByRole('button').filter({ hasText: /^A\./ }).first()).toBeVisible();
    await completeQuiz(page);
    // Deterministic flush trigger (the manager also flushes on the 30s
    // debounce — dispatching `online` models a connectivity change).
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(() => serverAttemptCount(page), { timeout: 15_000 }).toBeGreaterThan(0);

    // Device B: fresh context, same account — login merge pulls the attempt down.
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    try {
      await signIn(pageB, email);
      await pageB.goto('/progress');

      await expect(async () => {
        const row = pageB.getByRole('link').filter({ hasText: 'Solving Equations' });
        await expect(row).toBeVisible();
        await expect(row.getByText('Not started')).toHaveCount(0);
      }).toPass({ timeout: 30_000 });
    } finally {
      await contextB.close();
    }
  });
});
