import { test, expect } from '@playwright/test';

// Phase 7 Session 2: PWA behaviour. The service worker only runs in
// production builds (registration is prod-gated), so this whole spec is
// skipped unless running under the prod-build pattern:
//   npm run build && E2E_PROD=1 npx playwright test tests/e2e/pwa.spec.ts --project='Desktop Chrome'
test.skip(!process.env.E2E_PROD, 'Service worker requires a production build (E2E_PROD=1)');

async function waitForServiceWorker(page: import('@playwright/test').Page) {
  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.state === 'activated';
  });
}

test.describe('PWA (production build)', () => {
  test('manifest is served and linked; icons resolve', async ({ page, request }) => {
    const manifest = await request.get('/manifest.webmanifest');
    expect(manifest.ok()).toBeTruthy();
    const body = await manifest.json();
    expect(body.name).toBe('IBLearn');

    for (const icon of ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png']) {
      const res = await request.get(icon);
      expect(res.ok(), `${icon} should resolve`).toBeTruthy();
    }

    await page.goto('/');
    await expect(page.locator('head link[rel="manifest"]')).toHaveAttribute(
      'href',
      '/manifest.webmanifest',
    );
  });

  test('service worker registers, activates and controls the page', async ({ page }) => {
    await page.goto('/');
    await waitForServiceWorker(page);

    // After a reload the page is controlled by the active worker.
    await page.reload();
    const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
    expect(controlled).toBe(true);
  });

  test('a visited page works fully offline', async ({ page, context }) => {
    await page.goto('/');
    await waitForServiceWorker(page);
    // Reload once while controlled so all static chunks for this route are in
    // the SW cache (the very first load bypasses the not-yet-active worker).
    await page.reload();
    await expect(page.getByRole('heading', { name: 'IBLearn' })).toBeVisible();

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'IBLearn' })).toBeVisible();

    // The /offline fallback for *unvisited* routes is covered by unit tests
    // (tests/unit/pwa-sw.test.ts): Chromium's offline emulation does not apply
    // to fetches made BY the service worker, so the SW would still reach the
    // network here and the scenario can't be exercised in a browser.
  });

  test('offline hides the Mark with AI button on a paper page', async ({ page, context }) => {
    await page.goto('/papers/math-y7/math-y7-set-1');
    await waitForServiceWorker(page);
    await page.reload();

    const reachMarkStage = async () => {
      await page.getByLabel(/Your answer/i).fill('I added the columns and got 933.');
      await page.getByRole('button', { name: /Check answer/i }).click();
      await expect(page.getByText('Model answer')).toBeVisible();
    };

    // Online with the e2e dummy provider configured: the button is there.
    await reachMarkStage();
    await expect(page.getByRole('button', { name: /Mark with AI/i })).toBeVisible();

    // Offline: the SW is network-only for /api/**, the configured-check fails
    // and the button disappears — everything else keeps working.
    await context.setOffline(true);
    await page.reload();
    await reachMarkStage();
    await expect(page.getByRole('button', { name: /Mark with AI/i })).toHaveCount(0);
  });

  test('install button appears when installation is offered', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Mobile projects report an iOS UA, which uses the manual-instructions variant');

    // In a prod build with an active SW the app is genuinely installable, so
    // Chromium may fire a real beforeinstallprompt at any time — asserting
    // "hidden before the event" is not stable here (that state is covered by
    // tests/unit/pwa-install-app-button.test.tsx instead).
    await page.goto('/progress');
    await page.evaluate(() => {
      window.dispatchEvent(new Event('beforeinstallprompt'));
    });
    await expect(page.getByRole('button', { name: /install app/i })).toBeVisible();
  });
});
