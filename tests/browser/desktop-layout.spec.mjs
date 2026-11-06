import { test, expect } from '@playwright/test';

test('desktop shares centered edges and groups search controls without overflow', async ({
  page,
}) => {
  for (const width of [1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.locator('.job-table')).toBeVisible();
    const layout = await page.evaluate(() => {
      const bounds = (s) => document.querySelector(s).getBoundingClientRect().toJSON();
      return {
        main: bounds('main'),
        brand: bounds('.brand'),
        heading: bounds('.page-heading'),
        search: bounds('input[type=search]'),
        filter: bounds('select[aria-label="Minimum fit"]'),
        sort: bounds('select[aria-label="Sort opportunities"]'),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(layout.main.width).toBeLessThanOrEqual(1208);
    expect(Math.abs(layout.main.x - (width - layout.main.width) / 2)).toBeLessThan(2);
    expect(Math.abs(layout.brand.x - layout.heading.x)).toBeLessThan(2);
    expect(Math.abs(layout.search.y - layout.filter.y)).toBeLessThan(2);
    expect(Math.abs(layout.search.y - layout.sort.y)).toBeLessThan(2);
    expect(layout.overflow).toBe(false);
    await expect(page.locator('header #profile-toggle')).toHaveCount(0);
    await page.screenshot({ path: `test-results/desktop-${width}.png`, fullPage: true });
  }
});

test('tools open at their trigger and close with Escape, outside click and selection', async ({
  page,
}) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Tools', exact: true });
  await trigger.click();
  const menu = page.locator('#workspace-tools');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Paste JD', exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Import research', exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Search now', exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Profile', exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.locator('h1').click();
  await expect(menu).toBeHidden();
  await trigger.click();
  await menu.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Capability evidence' })).toBeVisible();
  await expect(menu).toBeHidden();
});

test('score header toggles the visible historical numbers and leaves unknown scores last', async ({
  page,
}) => {
  await page.route('**/api/state', async (route) => {
    const s = await (await route.fetch()).json();
    s.jobs = s.jobs.filter((j) => j.title !== 'Frontend Engineer');
    s.reviews = {};
    s.jobs[0].assessment = { score: 6, stale: true };
    s.jobs[1].assessment = { score: 9, stale: true };
    s.jobs.push({
      ...s.jobs[0],
      id: 'unrated-fixture',
      title: 'Unrated fixture',
      assessment: null,
    });
    await route.fulfill({ json: s });
  });
  await page.goto('/');
  const sorter = page.locator('thead').getByRole('button', { name: /Fit/ });
  await sorter.click();
  await expect(page.locator('th[aria-sort="descending"]')).toContainText('Fit');
  await expect(page.locator('.job-row .job-title').first()).toHaveText('Design Engineer');
  await sorter.click();
  await expect(page.locator('th[aria-sort="ascending"]')).toContainText('Fit');
  await expect(page.locator('.job-row .job-title').first()).toHaveText('Product Engineer');
  await expect(page.locator('.job-row .job-title').last()).toHaveText('Unrated fixture');
  const padding = await sorter.evaluate((n) => getComputedStyle(n).paddingRight);
  expect(parseFloat(padding)).toBeGreaterThanOrEqual(10);
});

test('mobile retains cards and the brand uses the locally served M PLUS U face', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.job-row').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const font = await page.locator('.brand').evaluate((n) => getComputedStyle(n).fontFamily);
  expect(font).toContain('M PLUS U');
  expect(await page.evaluate(() => document.fonts.check('500 22px "M PLUS U"'))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/desktop-review-mobile.png', fullPage: true });
});
