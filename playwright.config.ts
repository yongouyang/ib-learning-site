import { execSync } from 'child_process';
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

// Resolve an available port once and cache it in an environment variable so the
// main Playwright process and any worker processes all use the same port.
function resolvePort(): number {
  const cached = process.env.PLAYWRIGHT_PORT;
  if (cached) {
    const parsed = parseInt(cached, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  const portScript = path.join(__dirname, 'scripts', 'find-port.cjs');
  const portOutput = execSync(`node "${portScript}"`, {
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  })
    .toString()
    .trim();
  const port = parseInt(portOutput, 10);
  if (Number.isNaN(port)) {
    throw new Error(`Failed to resolve an available port. Script output: "${portOutput}"`);
  }
  process.env.PLAYWRIGHT_PORT = String(port);
  return port;
}

const port = resolvePort();
const baseURL = `http://localhost:${port}`;

console.log(`[playwright] Using baseURL: ${baseURL}`);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'iPhone SE',
      use: { ...devices['iPhone SE'], defaultBrowserType: 'chromium' },
    },
    {
      name: 'iPad Pro',
      use: { ...devices['iPad Pro 11'], defaultBrowserType: 'chromium' },
    },
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // E2E_STATIC=1 serves the static export (out/) + the real /api/feedback
    // handler via scripts/serve-static.ts — a local stand-in for the S3 +
    // CloudFront + Lambda topology. Pattern:
    //   npm run test:e2e:static   (build:static + E2E_STATIC=1 E2E_PROD=1)
    command: process.env.E2E_STATIC
      ? `npx tsx scripts/serve-static.ts --port ${port}`
      : process.env.E2E_PROD
        ? `npm start -- --port ${port}`
        : `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: process.env.E2E_PROD ? 120000 : 60000,
    env: {
      // Phase 5: e2e runs against the real /api/feedback route with the Dummy
      // provider — zero tokens, deterministic defaults, and test-mode injection
      // (_testResponse) for per-case control (see docs/phase-5-implementation-plan.md).
      FEEDBACK_PROVIDER: 'dummy',
      FEEDBACK_TEST_MODE: '1',
      // Phase E2: the AI-mark quota/session wiring runs against the shared
      // in-memory dummy universe (default anyway — pinned for hermeticity), so
      // dummy-OTP sessions resolve for /api/feedback and the _testAiMarkUsed /
      // _testTier injections are honored.
      FEEDBACK_STORAGE: 'dummy',
      // Phase B (accounts): auth runs against the real /api/auth/* routes with
      // the in-memory dummy storage + dummy email sender. AUTH_TEST_MODE=1 gives
      // the deterministic default code 123456 and enables _testCode injection
      // (only honored with dummy deps — never with DynamoDB/SES).
      AUTH_STORAGE: 'dummy',
      AUTH_EMAIL: 'dummy',
      AUTH_TEST_MODE: '1',
      // Phase A (analytics): analytics runs against the in-memory dummy storage
      // (shared universe with auth, so the dummy-OTP session resolves for
      // /summary); the admin allowlist makes admin@example.com authorized.
      // PROGRESS_STORAGE is pinned explicitly for hermeticity (progress deps
      // default to dummy anyway — same shared universe).
      ANALYTICS_STORAGE: 'dummy',
      // Multiple allowlisted admin emails so parallel tests that sign in as an
      // admin never collide on one email's dummy-OTP code.
      ANALYTICS_ADMIN_EMAILS: 'admin@example.com,admin2@example.com,admin3@example.com,admin4@example.com,admin5@example.com',
      PROGRESS_STORAGE: 'dummy',
      // Feature 2 (admin CRUD dashboard): runs against the in-memory admin
      // dummy (seeded octav-* tables) with the same admin allowlist as the
      // analytics dashboard.
      ADMIN_STORAGE: 'dummy',
      // Feature 3 (Contact Us): runs against the in-memory contact dummy —
      // the shared universe, so dummy-OTP sessions resolve and the per-IP
      // rate limit is real (contact.spec.ts is serial for this reason).
      CONTACT_STORAGE: 'dummy',
    },
  },
});
