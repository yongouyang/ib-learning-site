import { test, expect, type Page } from '@playwright/test';

// Feature 2 (admin CRUD dashboard) e2e — supportability-features-plan.md. The
// webServer runs with ADMIN_STORAGE=dummy (seeded octav-* tables) and
// ANALYTICS_ADMIN_EMAILS=admin@example.com — see playwright.config.ts. Real
// routes, in-memory storage. CRUD tests use unique keys so parallel workers /
// a shared dummy singleton never collide.

function uniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

// Distinct allowlisted admin emails (see playwright.config.ts) so parallel
// tests that sign in as an admin never collide on one email's dummy-OTP code.
const ADMIN = ['admin@example.com', 'admin2@example.com', 'admin3@example.com', 'admin4@example.com', 'admin5@example.com'];

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send sign-in code' }).click();
  await expect(page.getByText(/Enter the 6-digit code/)).toBeVisible();
  await page.getByLabel('6-digit code').fill('123456');
  await page.getByRole('button', { name: 'Verify code' }).click();
  await expect(page).toHaveURL('/');
}

/** POST to the admin API using the authenticated browser context. */
async function adminApi(page: Page, body: Record<string, unknown>) {
  const res = await page.request.post('/api/admin/dynamodb', { data: body });
  return { status: res.status(), body: (await res.json()) as Record<string, unknown> };
}

test.describe('admin dynamodb dashboard', () => {
  test('logged out shows the sign-in prompt', async ({ page }) => {
    await page.goto('/admin/dynamodb');
    await expect(page.getByText('Sign in to use the admin console.')).toBeVisible();
  });

  test('non-admin gets not authorized', async ({ page }) => {
    await signIn(page, uniqueEmail()); // not in the allowlist
    await page.goto('/admin/dynamodb');
    await expect(page.getByText(/have access to this console/)).toBeVisible();
  });

  test('admin sees the dashboard with the octav-* table dropdown', async ({ page }) => {
    await signIn(page, ADMIN[0]);
    await page.goto('/admin/dynamodb');
    await expect(page.getByRole('heading', { name: 'DynamoDB' })).toBeVisible();
    const tableSelect = page.locator('#admin-table');
    await expect(tableSelect).toBeVisible();
    // listTables loads asynchronously after mount — wait for the first octav-*
    // option before reading the full list. (toBeVisible() is unreliable on
    // <option> elements, so poll the count instead.)
    await expect.poll(() => tableSelect.locator('option[value^="octav-"]').count()).toBeGreaterThan(0);
    const options = await tableSelect.locator('option').allTextContents();
    expect(options.some((t) => t.startsWith('octav-'))).toBe(true);
  });

  test('admin can scan a table and see its items in the result table', async ({ page }) => {
    await signIn(page, ADMIN[1]);
    await page.goto('/admin/dynamodb');
    await page.locator('#admin-table').selectOption({ label: 'octav-users' });
    await page.getByRole('button', { name: 'Run scan' }).click();
    await expect(page.getByText('Result')).toBeVisible();
    await expect(page.getByText('user-1')).toBeVisible();
  });

  test('admin sees the Admin console entry on the account page', async ({ page }) => {
    await signIn(page, ADMIN[4]);
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: 'Admin console' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'DynamoDB' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Analytics' })).toBeVisible();
  });

  test('non-admin does not see the Admin console entry', async ({ page }) => {
    await signIn(page, uniqueEmail()); // not in the allowlist
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: 'Admin console' })).toHaveCount(0);
  });
});

test.describe('admin CRUD API (authenticated)', () => {
  test('full CRUD lifecycle on a unique key', async ({ page }) => {
    await signIn(page, ADMIN[2]);
    const id = `e2e-${Date.now()}`;

    // listTables
    const tables = await adminApi(page, { operation: 'listTables' });
    expect(tables.status).toBe(200);
    const names = (tables.body.result as string[]);
    expect(names).toContain('octav-users');
    expect(names.every((n) => n.startsWith('octav-'))).toBe(true);

    // scan (seeded)
    const scan = await adminApi(page, { operation: 'scan', table: 'octav-users', limit: 5 });
    expect(scan.status).toBe(200);
    expect((scan.body.result as { items: unknown[] }).items.length).toBeGreaterThan(0);

    // put (create)
    const put = await adminApi(page, {
      operation: 'put',
      table: 'octav-users',
      item: { id, email: `${id}@example.com`, tier: 'free' },
    });
    expect(put.status).toBe(200);
    expect(put.body.result).toEqual({ success: true });

    // get (read back)
    const get = await adminApi(page, { operation: 'get', table: 'octav-users', key: { id } });
    expect(get.status).toBe(200);
    expect((get.body.result as { item: { id: string } }).item.id).toBe(id);

    // update
    const update = await adminApi(page, {
      operation: 'update',
      table: 'octav-users',
      key: { id },
      expression: 'SET tier = :t',
      expressionValues: { ':t': 'premium' },
    });
    expect(update.status).toBe(200);
    const get2 = await adminApi(page, { operation: 'get', table: 'octav-users', key: { id } });
    expect((get2.body.result as { item: { tier: string } }).item.tier).toBe('premium');

    // delete (clean up)
    const del = await adminApi(page, { operation: 'delete', table: 'octav-users', key: { id } });
    expect(del.status).toBe(200);
    const get3 = await adminApi(page, { operation: 'get', table: 'octav-users', key: { id } });
    expect((get3.body.result as { item: null }).item).toBeNull();
  });

  test('non-admin API call is rejected with 403', async ({ page }) => {
    await signIn(page, uniqueEmail());
    const res = await page.request.post('/api/admin/dynamodb', {
      data: { operation: 'listTables' },
    });
    expect(res.status()).toBe(403);
  });

  test('rejects a non-octav table name with 400', async ({ page }) => {
    await signIn(page, ADMIN[3]);
    const res = await page.request.post('/api/admin/dynamodb', {
      data: { operation: 'scan', table: 'internal-secrets' },
    });
    expect(res.status()).toBe(400);
  });
});
