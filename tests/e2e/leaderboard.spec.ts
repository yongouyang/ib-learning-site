import { test, expect, type Browser, type Page } from '@playwright/test';
import { handleForProfile } from '../../src/lib/leaderboard/handles';

// Phase D6 — the /leaderboard client page (docs/leaderboard-plan.md §7).
// Runs on ALL three device projects (the CI matrix). Dummy OTP login (code
// 123456); competitors are seeded through real API calls in separate browser
// contexts. Determinism: the main flow runs on the stage:igcse board (set via
// the account API) so the ks3 traffic of other specs/tests can never shift
// its ranks; no exact week-label assertions (week-boundary safe); replays
// award zero, so every sync uses a fresh attemptId.

function uniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

let attemptCounter = 0;

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send sign-in code' }).click();
  await expect(page.getByText(/Enter the 6-digit code/)).toBeVisible();
  await page.getByLabel('6-digit code').fill('123456');
  await page.getByRole('button', { name: 'Verify code' }).click();
  await expect(page).toHaveURL('/');
}

interface SeedProfile {
  profileId: string;
  displayName: string;
  stage: string;
}

function quizAttemptEvent(profileId: string, correctCount: number, totalCount: number) {
  attemptCounter += 1;
  return {
    type: 'quizAttempt',
    profileId,
    attemptId: `lb-d6-${attemptCounter}-${Math.random().toString(36).slice(2)}`,
    topicId: 'math-yr7-algebra-1',
    subjectId: 'math',
    topicTitle: 'Algebra',
    subjectTitle: 'Math',
    correctCount,
    totalCount,
    date: new Date().toISOString(),
  };
}

const CLIENT_META = { totalStars: 0, currentStreakDays: 0, lastStudyDate: null };

/**
 * Create a competitor account in its own browser context, opt it in and sync
 * one quiz attempt (10 XP per correct answer). Returns its deterministic
 * handle for assertions.
 */
async function seedCompetitor(
  browser: Browser,
  correctCount: number,
  totalCount = 10,
  stage: 'ks3' | 'igcse' = 'ks3'
): Promise<string> {
  const ctx = await browser.newContext();
  try {
    const email = uniqueEmail();
    const req = ctx.request;
    await req.post('/api/auth/request-otp', { data: { email } });
    const verify = await req.post('/api/auth/verify-otp', { data: { email, otp: '123456' } });
    expect(verify.status()).toBe(200);
    const { user } = await verify.json();
    const profile = user.childProfiles[0] as SeedProfile;

    const optIn = await req.post('/api/auth/account', {
      data: { childProfiles: [{ ...profile, stage, leaderboardOptIn: true }] },
    });
    expect(optIn.status()).toBe(200);

    const sync = await req.post('/api/progress/sync', {
      data: { events: [quizAttemptEvent(profile.profileId, correctCount, totalCount)], clientMeta: CLIENT_META },
    });
    expect(sync.status()).toBe(200);
    return handleForProfile(profile.profileId);
  } finally {
    await ctx.close();
  }
}

/** The signed-in page's first child profile (via the real me() route). */
async function myProfile(page: Page): Promise<SeedProfile> {
  return page.evaluate(async () => {
    const res = await fetch('/api/auth/me');
    const body = (await res.json()) as { user: { childProfiles: SeedProfile[] } };
    return body.user.childProfiles[0];
  });
}

/** Sync one quiz attempt for the signed-in page's session. */
async function syncQuiz(page: Page, profileId: string, correctCount: number, totalCount = 10): Promise<void> {
  const status = await page.evaluate(
    async ({ event, clientMeta }) => {
      const res = await fetch('/api/progress/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [event], clientMeta }),
      });
      return res.status;
    },
    { event: quizAttemptEvent(profileId, correctCount, totalCount), clientMeta: CLIENT_META }
  );
  expect(status).toBe(200);
}

test.describe('leaderboard page (D6)', () => {
  test('logged out: public teaser shows the top board and the join CTA', async ({ page, browser }) => {
    // 500 XP (the daily cap) keeps the row in the top 3 no matter what other
    // specs seed into the shared ks3 board.
    const handle = await seedCompetitor(browser, 50, 50);

    await page.goto('/leaderboard');
    await expect(page.getByRole('heading', { level: 1, name: 'Leaderboard' })).toHaveCount(1);
    await expect(page.getByRole('heading', { name: "This week's KS3 leaderboard" })).toBeVisible();
    // .first(): a generated handle can theoretically collide across profiles.
    // The teaser fetch can lag on a busy shared dev server — 15s.
    await expect(page.getByText(handle).first()).toBeVisible({ timeout: 15_000 });

    const cta = page.getByRole('link', { name: 'Create a free account to join' });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/login?next=%2Fleaderboard');
  });
  test('logged in, not opted in: value-prop card + read-only board; join inline → self row after a sync', async ({
    page,
    browser,
  }) => {
    await signIn(page, uniqueEmail());
    const me = await myProfile(page);
    // The whole flow runs on the igcse board — isolated from ks3 traffic (the
    // board scope follows the profile's stage).
    const restage = await page.evaluate(async (p) => {
      const res = await fetch('/api/auth/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childProfiles: [{ ...p, stage: 'igcse' }] }),
      });
      return res.status;
    }, me);
    expect(restage).toBe(200);
    const myHandle = handleForProfile(me.profileId);

    // Three competitors at 90/80/70 XP (re-seed on the rare handle collision
    // with the test user's own deterministic handle).
    for (const correct of [9, 8, 7]) {
      let handle = await seedCompetitor(browser, correct, 10, 'igcse');
      while (handle === myHandle) handle = await seedCompetitor(browser, correct, 10, 'igcse');
    }

    await page.goto('/leaderboard');

    // The board fetch can lag behind the page render on a busy dev server
    // (12 tests across 3 devices share it) — wait out the loading state once.
    const podium = page.getByRole('list', { name: 'Top three' });
    await expect(podium.locator('li').first()).toBeVisible({ timeout: 15_000 });

    // Not opted in: value-prop card + the board is visible read-only (and the
    // caller has no row on it).
    await expect(page.getByRole('heading', { name: 'Join the leaderboard' })).toBeVisible();
    await expect(page.getByText('See how you compare this week. Anonymous handle, opt out any time.')).toBeVisible();
    await expect(podium.locator('li')).toHaveCount(3);
    // No board ROW for the caller (the join card's handle preview is a span,
    // not a row).
    await expect(page.locator('li', { hasText: myHandle })).toHaveCount(0);

    // Join inline (the D5 updateAccount path).
    await page.getByRole('button', { name: 'Join leaderboard' }).click();
    await expect(page.getByRole('heading', { name: 'Join the leaderboard' })).toHaveCount(0);
    await expect(page.getByText("You haven't earned XP this week — do a quiz to join the board.")).toBeVisible();

    // Earn 50 XP (5/10 — no perfection bonus), then re-view.
    await syncQuiz(page, me.profileId, 5, 10);
    await page.reload();

    // Derive the rank expectation from the live board (a reused local dev
    // server may carry rows from earlier runs — ranks shift, XP doesn't).
    const board = await page.evaluate(async (pid) => {
      const res = await fetch(`/api/leaderboard?profileId=${encodeURIComponent(pid)}`);
      return (await res.json()) as {
        self: { rank: number; handle: string; xp: number } | null;
        neighbourhood: { rank: number; handle: string; isSelf: boolean }[];
      };
    }, me.profileId);
    expect(board.self).not.toBeNull();
    expect(board.self!.xp).toBe(50);
    expect(board.self!.handle).toBe(myHandle);

    // Opted-in board: footer, highlighted self row, and the neighbourhood
    // window rendered exactly as the API returned it (15s: the page's own
    // board fetch can lag behind the direct API read on a busy dev server).
    await expect(page.getByText(`You: #${board.self!.rank} · 50 XP this week`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/last week:/)).toHaveCount(0); // no prev-week self row
    const selfRow = page.locator('li', { hasText: '(you)' }); // the sr-only self marker
    await expect(selfRow).toHaveCount(1);
    await expect(selfRow).toHaveClass(/bg-blue-50/);
    const aroundYou = page.getByRole('region', { name: 'Around you' });
    await expect(aroundYou).toBeVisible();
    expect(await aroundYou.locator('li').count()).toBe(board.neighbourhood.length);
  });

  test('the Last week toggle shows an empty prev board honestly', async ({ page }) => {
    await signIn(page, uniqueEmail());
    await page.goto('/leaderboard');

    const thisWeek = page.getByRole('button', { name: 'This week' });
    const lastWeek = page.getByRole('button', { name: 'Last week' });
    await expect(thisWeek).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(/Resets .+ your time/)).toBeVisible({ timeout: 15_000 });

    // Nothing is ever written to a finished week in these tests.
    await lastWeek.click();
    await expect(lastWeek).toHaveAttribute('aria-pressed', 'true');
    await expect(thisWeek).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText('No board recorded for last week.')).toBeVisible();
    await expect(page.getByText(/Resets .+ your time/)).toHaveCount(0);

    await thisWeek.click();
    await expect(page.getByText(/Resets .+ your time/)).toBeVisible();
  });

  test('multi-profile accounts get a profile switcher that drives the board context', async ({ page }) => {
    await signIn(page, uniqueEmail());
    const me = await myProfile(page);

    // Add a second child profile through the account API.
    const alexId = await page.evaluate(async (p) => {
      const alex = { profileId: `p-${Math.random().toString(36).slice(2, 10)}`, displayName: 'Alex', stage: 'ks3' };
      const res = await fetch('/api/auth/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childProfiles: [p, alex] }),
      });
      if (res.status !== 200) return null;
      return alex.profileId;
    }, me);
    expect(alexId).toBeTruthy();

    await page.goto('/leaderboard');
    // Scope to the switcher group — the desktop header also has a "Me" button.
    const switcher = page.getByRole('group', { name: 'Profile' });
    const meChip = switcher.getByRole('button', { name: 'Me', exact: true });
    const alexChip = switcher.getByRole('button', { name: 'Alex', exact: true });
    await expect(meChip).toBeVisible();
    await expect(alexChip).toBeVisible();
    await expect(meChip).toHaveAttribute('aria-pressed', 'true');

    // Switching swaps the join card's handle preview (per-profile opt-in).
    await alexChip.click();
    await expect(alexChip).toHaveAttribute('aria-pressed', 'true');
    await expect(meChip).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText(handleForProfile(alexId!))).toBeVisible();
  });
});
