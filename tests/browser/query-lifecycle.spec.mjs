import { test, expect } from '@playwright/test';
import { demoActions } from '../../src/demo.mjs';
import { emptyState, transition } from '../../src/workbench.mjs';

test('workspace reads stay shared and focus does not silently refetch', async ({ page }) => {
  const state = demoActions().reduce(transition, emptyState());
  let reads = 0;
  await page.route('**/api/state', (route) => {
    reads++;
    return route.fulfill({ json: state });
  });
  await page.goto('/');
  await expect(page.locator('.job-row').first()).toBeVisible();
  for (const name of ['Preparation', 'Research', 'Opportunities']) {
    await page.getByRole('button', { name, exact: true }).click();
  }
  await page.evaluate(async () => {
    // TanStack listens on window, and the workspace query is stale immediately.
    let visibility = 'hidden';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });
    window.dispatchEvent(new Event('visibilitychange'));
    visibility = 'visible';
    window.dispatchEvent(new Event('visibilitychange'));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await expect(page.locator('.job-row').first()).toBeVisible();
  expect(reads).toBe(1);
});

test('mutation pending disables competing write controls and a failed POST is not retried', async ({
  page,
}) => {
  const state = demoActions().reduce(transition, emptyState());
  await page.route('**/api/state', (route) => route.fulfill({ json: state }));
  let finish;
  const gate = new Promise((resolve) => {
    finish = resolve;
  });
  let writes = 0;
  await page.route('**/api/action', async (route) => {
    writes++;
    await gate;
    await route.fulfill({ status: 503, json: { error: 'Synthetic service failure' } });
  });
  await page.goto('/');
  await page.locator('.job-title').first().click();
  await page.getByRole('tab', { name: 'Preparation', exact: true }).click();
  const request = page.getByRole('button', { name: 'Request resume', exact: true });
  const archive = page
    .locator('#detail-footer')
    .getByRole('button', { name: 'Archive', exact: true });
  await request.click();
  await expect(request).toBeDisabled();
  await expect(archive).toBeDisabled();
  finish();
  await expect(page.locator('#detail-notice')).toContainText('Synthetic service failure');
  await expect(request).toBeEnabled();
  await expect(archive).toBeEnabled();
  expect(writes).toBe(1);
});

test('closing the research reader cancels its in-flight query', async ({ page }) => {
  const state = demoActions().reduce(transition, emptyState());
  state.runs = [
    {
      id: 'abort-reader',
      kind: 'manual',
      note: 'Synthetic archive',
      coverage: [],
      archiveHash: 'synthetic',
    },
  ];
  await page.route('**/api/state', (route) => route.fulfill({ json: state }));
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/api/research?run=*', async (route) => {
    await gate;
    await route.fulfill({ json: { run: state.runs[0], jobs: [] } }).catch(() => {});
  });
  await page.goto('/?view=research');
  const requested = page.waitForRequest((request) => request.url().includes('/api/research?'));
  await page.getByRole('button', { name: 'View full research', exact: true }).click();
  await requested;
  await expect(page.locator('.reader-skeleton')).toBeVisible();
  const canceled = page.waitForEvent('requestfailed', {
    predicate: (request) => request.url().includes('/api/research?'),
  });
  await page.getByRole('button', { name: 'Close research', exact: true }).click();
  await canceled;
  release();
  await expect(page.locator('.research-reader')).toHaveCount(0);
});

test('an in-flight write disables collection from Research and the tools menu', async ({
  page,
}) => {
  const state = demoActions().reduce(transition, emptyState());
  await page.route('**/api/state', (route) => route.fulfill({ json: state }));
  let finish;
  const gate = new Promise((resolve) => {
    finish = resolve;
  });
  await page.route('**/api/action', async (route) => {
    await gate;
    await route.fulfill({ status: 409, json: { error: 'Synthetic revision conflict' } });
  });
  let collections = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/api/collect')) collections++;
  });
  await page.goto('/');
  await page.locator('.job-row select').first().selectOption('shortlisted');
  await expect(page.locator('.job-row select').first()).toBeDisabled();
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Search now', exact: true })).toBeDisabled();
  await page.locator('#tools-toggle').click();
  await expect(page.locator('#collect')).toBeDisabled();
  await page.locator('#collect').evaluate((button) => button.click());
  expect(collections).toBe(0);
  finish();
  await expect(page.locator('#notice')).toContainText('Synthetic revision conflict');
  await expect(page.locator('#collect')).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Search now', exact: true })).toBeEnabled();
});

test('login remains pending through its authenticated refresh without persisting the key', async ({
  page,
}) => {
  const state = demoActions().reduce(transition, emptyState());
  let authenticated = false,
    release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/api/state', async (route) => {
    if (!authenticated)
      return route.fulfill({ status: 401, json: { error: 'Authentication required' } });
    await gate;
    await route.fulfill({ json: state });
  });
  let logins = 0;
  await page.route('**/api/login', (route) => {
    logins++;
    authenticated = true;
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto('/');
  await page.getByLabel('Access key').fill('synthetic-login-key');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled();
  await expect(page.locator('.job-row')).toHaveCount(0);
  release();
  await expect(page.locator('.job-row').first()).toBeVisible();
  await expect(page.locator('#access-key')).toHaveCount(0);
  expect(logins).toBe(1);
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain('synthetic-login-key');
});
