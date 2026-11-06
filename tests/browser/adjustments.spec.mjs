import { test, expect } from '@playwright/test';
import { demoActions } from '../../src/demo.mjs';
import { transition, emptyState } from '../../src/workbench.mjs';

test('filters are one control, apply drafts and discard canceled changes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('searchbox')).not.toBeVisible();
  await page.locator('#filter-toggle').click();
  await page.getByRole('searchbox').fill('Design');
  await page.getByLabel('Minimum fit').selectOption('7');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page).toHaveURL(/q=Design/);
  await expect(page.locator('.job-title')).toHaveCount(1);
  await page.locator('#filter-toggle').click();
  await page.getByRole('searchbox').fill('discard');
  await page.keyboard.press('Escape');
  await page.locator('#filter-toggle').click();
  await expect(page.getByRole('searchbox')).toHaveValue('Design');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page).not.toHaveURL(/q=/);
});

test('mobile filters fit the viewport and source hover stays still', async ({ page }) => {
  await page.goto('/');
  const source = page.locator('.source-link').first();
  await source.hover();
  await expect(source.locator('svg')).toHaveCSS('transform', 'none');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#filter-toggle').click();
  await page
    .locator('#list-filters')
    .evaluate((n) => Promise.all(n.getAnimations().map((a) => a.finished.catch(() => {}))));
  const rect = await page.locator('#list-filters').boundingBox();
  expect(rect.x).toBe(0);
  expect(rect.width).toBe(390);
  expect(Math.round(rect.y + rect.height)).toBe(844);
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeInViewport();
  await page.screenshot({ animations: 'disabled', path: 'test-results/adjustments-mobile.png' });
});

test('Passed unifies archive without mutating reviews and old URLs remain valid', async ({
  page,
}) => {
  const state = demoActions().reduce(transition, emptyState());
  state.reviews = {};
  state.jobs[0].availability = {
    status: 'closed',
    source: state.jobs[0].url,
    evidence: 'Closed',
    checkedAt: new Date().toISOString(),
  };
  state.reviews[state.jobs[1].id] = { status: 'passed' };
  await page.route('**/api/state', (r) => r.fulfill({ json: state }));
  let writes = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST') writes++;
  });
  await page.goto('/?decision=archive');
  await expect(page).toHaveURL(/decision=passed/);
  await expect(page.locator('.job-row')).toHaveCount(3);
  expect(await page.locator('.facts').allTextContents()).not.toContain('Archived');
  expect(writes).toBe(0);
});

test('brand icons are served and the Chinese fit heading stays on one line', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('role-trail.language', 'zh-TW'));
  await page.reload();
  for (const [path, type] of [
    ['/favicon.ico', 'image/x-icon'],
    ['/favicon-32.png', 'image/png'],
    ['/apple-touch-icon.png', 'image/png'],
  ]) {
    const response = await page.request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain(type);
    expect((await response.body()).length).toBeGreaterThan(100);
  }
  const fit = page.locator('th .sort-control').nth(1);
  await expect(fit).toContainText('契合度');
  await expect(fit).toHaveCSS('white-space', 'nowrap');
});
