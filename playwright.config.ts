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
      // Phase B (accounts): auth runs against the real /api/auth/* routes with
      // the in-memory dummy storage + dummy email sender. AUTH_TEST_MODE=1 gives
      // the deterministic default code 123456 and enables _testCode injection
      // (only honored with dummy deps — never with DynamoDB/SES).
      AUTH_STORAGE: 'dummy',
      AUTH_EMAIL: 'dummy',
      AUTH_TEST_MODE: '1',
    },
  },
});
