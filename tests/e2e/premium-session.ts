import type { Page } from '@playwright/test';

// Phase E3 — premium-session mock for e2e. The dummy auth universe has no
// premium-tier injection (tier is admin-granted until E4), so premium coverage
// mocks the /api/auth/me response with Playwright route interception — the
// standing "me() mock" escape hatch. Progress calls get empty successes so the
// sync path stays quiet without a real session cookie (local-first recording
// is unaffected).

export const PREMIUM_ME = {
  user: {
    userId: 'u-premium',
    email: 'premium@example.com',
    displayName: 'Premium User',
    role: 'parent',
    tier: 'premium',
    childProfiles: [{ profileId: 'p1', displayName: 'Me', stage: 'ks3' }],
  },
  entitlements: ['ai-marking', 'ai-marking-unlimited', 'exam-sets-full'],
};

export async function mockPremiumSession(page: Page): Promise<void> {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PREMIUM_ME) })
  );
  await page.route('**/api/progress', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ profiles: {} }) })
  );
  await page.route('**/api/progress/sync', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ synced: 100 }) })
  );
}
