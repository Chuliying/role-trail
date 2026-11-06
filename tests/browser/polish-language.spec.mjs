import { test, expect } from '@playwright/test';
import { demoActions } from '../../src/demo.mjs';
import { transition, emptyState } from '../../src/workbench.mjs';
const fresh = () => demoActions().reduce(transition, emptyState());
async function seed(page, state = fresh()) {
  await page.route('**/api/state', (r) => r.fulfill({ json: state }));
}
test('desktop navigation centers independently; filters and table share a compact aligned grid', async ({
  page,
}) => {
  const state = fresh();
  state.jobs[0].checks = [
    {
      key: 'frontend',
      status: 'confirmed',
      source: state.jobs[0].url,
      evidence: 'Synthetic interface responsibilities.',
      checkedAt: new Date().toISOString(),
    },
  ];
  await seed(page, state);
  for (const width of [1000, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('.job-row').first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.evaluate(() => {
      const rect = (s) => document.querySelector(s).getBoundingClientRect();
      const nav = rect('header nav'),
        filters = rect('.workbench-filters'),
        heading = rect('.page-heading'),
        cell = document.querySelector('td');
      const label = document.querySelector('.tabs button');
      const range = document.createRange();
      range.selectNodeContents(label.firstChild);
      const name = range.getBoundingClientRect(),
        countNode = label.querySelector('.tab-count'),
        countRange = document.createRange();
      countRange.selectNodeContents(countNode);
      const count = countRange.getBoundingClientRect();
      return {
        center: nav.x + nav.width / 2,
        filterWidth: filters.width,
        right: filters.right - heading.right,
        padding: getComputedStyle(cell).paddingLeft,
        gap: count.x - name.right,
        icon: rect('.rt-verification svg').x - rect('.job-title').x,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(Math.abs(geometry.center - width / 2)).toBeLessThan(1);
    expect(geometry.filterWidth).toBeLessThanOrEqual(760);
    expect(Math.abs(geometry.right)).toBeLessThan(1);
    expect(geometry.padding).toBe('20px');
    expect(geometry.gap).toBeCloseTo(8, 0);
    expect(Math.abs(geometry.icon)).toBeLessThan(1);
    expect(geometry.overflow).toBe(false);
  }
  await page.evaluate(() => window.scrollTo(0, 500));
  expect((await page.locator('header').boundingBox()).y).toBe(0);
  await page.locator('#tools-toggle').click();
  const spacing = await page
    .locator('.menu-separator')
    .first()
    .evaluate((n) => ({
      top: getComputedStyle(n).marginTop,
      bottom: getComputedStyle(n).marginBottom,
    }));
  expect(spacing).toEqual({ top: '8px', bottom: '8px' });
  await page.screenshot({ path: 'test-results/polished-desktop.png', fullPage: true });
});
test('score explains fresh and historical evidence by hover, click, keyboard and mobile tap', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const state = fresh();
  const product = state.jobs.find((j) => j.title === 'Product Engineer');
  product.assessment.stale = true;
  await seed(page, state);
  await page.goto('/');
  const trigger = page.getByRole('button', { name: /Previous fit/ });
  await trigger.hover();
  const tip = page.locator('.score-explanation:popover-open');
  await expect(tip).toContainText(product.assessment.reason);
  await expect(tip).toContainText(product.assessment.evidence[0]);
  await trigger.click();
  await page.mouse.move(1, 1);
  await expect(tip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tip).toHaveCount(0);
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(tip).toBeVisible();
  await page.keyboard.press('Escape');
  await context.close();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const p = await mobile.newPage();
  await seed(p);
  await p.goto('/');
  const score = p.locator('.score-trigger').first();
  await expect(score).toBeVisible();
  expect((await score.locator('.score').boundingBox()).width).toBeCloseTo(25.6, 1);
  expect((await score.boundingBox()).width).toBe(44);
  await score.tap();
  const panel = p.locator('.score-explanation:popover-open');
  await expect(panel).toBeVisible();
  const r = await panel.boundingBox();
  expect(r.x).toBeGreaterThanOrEqual(12);
  expect(r.x + r.width).toBeLessThanOrEqual(378);
  await p.screenshot({ path: 'test-results/score-evidence-mobile.png' });
  await mobile.close();
});
test('English and Traditional Chinese packs switch persistently without translating source content', async ({
  page,
}) => {
  await seed(page);
  await page.goto('/?sort=score');
  await page.locator('#tools-toggle').click();
  await page.getByRole('button', { name: '繁體中文', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
  await expect(page.getByRole('button', { name: '想投遞', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Product Engineer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'About the role', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '準備事項', exact: true }).click();
  await expect(page.getByRole('heading', { name: '職缺專屬履歷', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '建立履歷製作任務', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '關閉職缺', exact: true }).click();
  await page.locator('#tools-toggle').click();
  await page.getByRole('button', { name: '設定', exact: true }).click();
  await expect(page.getByRole('heading', { name: '每日排程', exact: true })).toBeVisible();
  await expect(page.locator('main')).toContainText('Alex Morgan (synthetic)');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
  await page.locator('#tools-toggle').click();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Daily schedule', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/sort=score/);
});

test('failed task save restores that task, not the first task in the workspace', async ({
  page,
}) => {
  const state = fresh();
  state.tasks = [
    { id: 'first-fixture', text: 'First fixture task', done: false },
    { id: 'second-fixture', text: 'Second fixture task', done: true },
  ];
  await seed(page, state);
  await page.route('**/api/action', (route) =>
    route.fulfill({ status: 500, json: { error: 'Save failed fixture' } }),
  );
  await page.goto('/?view=tasks');
  const second = page.getByRole('checkbox', { name: 'Second fixture task' });
  await second.uncheck();
  await expect(second).toBeEnabled();
  await expect(second).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'First fixture task' })).not.toBeChecked();
});

test('WebKit: score evidence supports mobile tap and locale selection', async ({ playwright }) => {
  const browser = await playwright.webkit.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    await seed(page);
    await page.goto('http://127.0.0.1:4319/');
    await page.locator('.score-trigger').first().tap();
    await expect(page.locator('.score-explanation:popover-open')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.score-explanation:popover-open')).toHaveCount(0);
    await page.locator('#tools-toggle').tap();
    await page.getByRole('button', { name: '繁體中文', exact: true }).tap();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
    await expect(page.getByRole('button', { name: '想投遞', exact: true })).toBeVisible();
  } finally {
    await browser.close();
  }
});
