import { test, expect, type Page } from '@playwright/test';

// Phase D5 (docs/leaderboard-plan.md §4.3/§7 — DoD: opt in → handle shown →
// appears on board). The webServer runs with AUTH_STORAGE/PROGRESS_STORAGE=
// dummy + AUTH_TEST_MODE=1 (playwright.config.ts), so the real /api/auth/*,
// /api/progress/sync and /api/leaderboard routes all share the in-memory
// universe: the D4 award hook awards XP for opted-in profiles and the D5
// account handler erases rows on opt-out. Desktop Chrome only.

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

/** The session's first child profile id (via the real me() route). */
async function myProfileId(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const res = await fetch('/api/auth/me');
    const body = (await res.json()) as { user: { childProfiles: { profileId: string }[] } };
    return body.user.childProfiles[0].profileId;
  });
}

/** POST one quizAttempt (7/10 by default → 70 XP, no perfection bonus). */
async function syncQuizAttempt(page: Page, profileId: string, attemptId: string): Promise<number> {
  return page.evaluate(
    async ({ profileId, attemptId }) => {
      const res = await fetch('/api/progress/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: [
            {
              type: 'quizAttempt',
              profileId,
              attemptId,
              topicId: 'math-yr7-algebra-1',
              subjectId: 'math',
              topicTitle: 'Algebra',
              subjectTitle: 'Math',
              correctCount: 7,
              totalCount: 10,
              date: new Date().toISOString(),
            },
          ],
          clientMeta: { totalStars: 0, currentStreakDays: 0, lastStudyDate: null },
        }),
      });
      return res.status;
    },
    { profileId, attemptId }
  );
}

interface BoardResponse {
  profile: { profileId: string; optedIn: boolean } | null;
  self: { rank: number; handle: string; xp: number } | null;
  top: { rank: number; handle: string; xp: number; isSelf: boolean }[];
}

/** GET /api/leaderboard for the session's profile (stage:ks3 default board). */
async function fetchBoard(page: Page, profileId: string): Promise<BoardResponse> {
  return page.evaluate(async (profileId) => {
    const res = await fetch(`/api/leaderboard?profileId=${encodeURIComponent(profileId)}`);
    return (await res.json()) as BoardResponse;
  }, profileId);
}

test.describe('leaderboard opt-in (D5)', () => {
  test('opt in → handle shown → appears on board; opt-out erases the row', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop Chrome only');
    await signIn(page, uniqueEmail());
    const profileId = await myProfileId(page);

    // Sync BEFORE opting in: progress is recorded but no leaderboard row.
    expect(await syncQuizAttempt(page, profileId, 'lb-e2e-a1')).toBe(200);
    let board = await fetchBoard(page, profileId);
    expect(board.profile?.optedIn).toBe(false);
    expect(board.self).toBeNull();

    // Opt in via the account page — the deterministic handle preview is shown.
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible();
    const preview = page.getByText(/You'll appear as/);
    await expect(preview).toBeVisible();
    const handle = (await preview.textContent())!.replace("You'll appear as", '').trim();
    expect(handle).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);

    await page.getByRole('button', { name: /Join leaderboard/ }).click();
    await expect(page.getByText(/Appearing as/)).toContainText(handle);

    // A NEW attempt (replays award zero — D4) lands on the board at 70 XP.
    expect(await syncQuizAttempt(page, profileId, 'lb-e2e-a2')).toBe(200);
    board = await fetchBoard(page, profileId);
    expect(board.profile?.optedIn).toBe(true);
    expect(board.self).not.toBeNull();
    expect(board.self!.handle).toBe(handle);
    expect(board.self!.xp).toBe(70); // 10 × 7 correct, no bonus
    expect(board.top.some((r) => r.handle === handle && r.isSelf)).toBe(true);

    // Leaving deletes the current-week row immediately (plan §7).
    await page.getByRole('button', { name: /Leave leaderboard/ }).click();
    await expect(page.getByText(/You'll appear as/)).toBeVisible();
    board = await fetchBoard(page, profileId);
    expect(board.profile?.optedIn).toBe(false);
    expect(board.self).toBeNull();
  });

  test('change handle once via the UI; the second change is locked', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop Chrome only');
    await signIn(page, uniqueEmail());

    await page.goto('/account');
    await page.getByRole('button', { name: /Join leaderboard/ }).click();
    await expect(page.getByText(/Appearing as/)).toBeVisible();

    // Client-side validation fires before any request.
    await page.getByRole('button', { name: /Change leaderboard handle/ }).click();
    const input = page.getByLabel(/New leaderboard handle/);
    await input.fill('007');
    await page.getByRole('button', { name: 'Save handle' }).click();
    await expect(page.getByText(/letters, spaces, hyphens or apostrophes/)).toBeVisible();

    // The one allowed custom change.
    await input.fill('Custom Condor');
    await page.getByRole('button', { name: 'Save handle' }).click();
    await expect(page.getByText(/Appearing as/)).toContainText('Custom Condor');

    // The control is gone afterwards; the note explains the lock.
    await expect(page.getByRole('button', { name: /Change leaderboard handle/ })).toHaveCount(0);
    await expect(page.getByText(/locked in/)).toBeVisible();
  });
});
