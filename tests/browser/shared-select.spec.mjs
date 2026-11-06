import { test, expect } from '@playwright/test';
import { demoActions } from '../../src/demo.mjs';
import { transition, emptyState } from '../../src/workbench.mjs';
const fresh = () => demoActions().reduce(transition, emptyState());
const seed = (page) => page.route('**/api/state', (route) => route.fulfill({ json: fresh() }));
for (const engine of ['chromium', 'webkit']) {
  test(`${engine}: shared selects keep arrow inset and desktop tabs meet the table`, async ({
    playwright,
  }) => {
    const browser = await playwright[engine].launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    try {
      await seed(page);
      await page.goto('http://127.0.0.1:4319');
      const tabs = page.locator('.tabs'),
        table = page.locator('.table-wrap');
      const a = await tabs.boundingBox(),
        b = await table.boundingBox();
      expect(Math.abs(b.y - a.y - a.height)).toBeLessThanOrEqual(1);
      const icon = await page.locator('#filter-toggle').boundingBox();
      expect(icon.y).toBeGreaterThanOrEqual(a.y);
      await page.locator('#filter-toggle').click();
      for (const select of await page.locator('select').all()) {
        await expect(select).toHaveClass(/select-control/);
        const css = await select.evaluate((n) => {
          const s = getComputedStyle(n);
          return {
            appearance: s.appearance,
            right: s.paddingRight,
            position: s.backgroundPosition,
          };
        });
        expect(css.appearance).toBe('none');
        expect(parseFloat(css.right)).toBeGreaterThanOrEqual(40);
        expect(css.position).toContain('16px');
      }
      await page.getByLabel('Minimum fit').selectOption('7');
      await page.getByRole('button', { name: 'Apply', exact: true }).click();
      await expect(page).toHaveURL(/fit=7/);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('#filter-toggle').click();
      await page.screenshot({
        path: `test-results/shared-select-${engine}.png`,
        animations: 'disabled',
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    } finally {
      await browser.close();
    }
  });
}
test('unrated roles expose an explanation without assigning zero', async ({ page }) => {
  await page.route('**/api/state', async (r) => {
    const s = fresh();
    delete s.jobs[0].assessment;
    await r.fulfill({ json: s });
  });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Not assessed; Show assessment' }).first();
  await expect(trigger).toHaveText('—');
  await trigger.click();
  await expect(page.locator('.score-explanation:popover-open')).toContainText('not a zero score');
});

for (const engine of ['chromium', 'webkit']) {
  test(`${engine}: mobile score, dates and source icon share the content edge`, async ({
    playwright,
  }) => {
    const browser = await playwright[engine].launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      const state = fresh(),
        job = state.jobs[0];
      const evidence = {
        source: job.url,
        evidence: 'Synthetic layout fixture.',
        checkedAt: new Date().toISOString(),
      };
      job.posting = { kind: 'posted', date: '2026-09-24' };
      job.title = 'Senior Frontend Engineer (Remote)';
      job.availability = { ...evidence, status: 'open' };
      job.checks = ['frontend', 'ai'].map((key) => ({ ...evidence, key, status: 'confirmed' }));
      await page.route('**/api/state', (route) => route.fulfill({ json: state }));
      await page.goto('http://127.0.0.1:4319');
      for (const width of [320, 390, 720]) {
        await page.setViewportSize({ width, height: 844 });
        const row = page.locator('.job-row').first();
        const select = row.locator('select');
        await select.focus();
        const control = await select.evaluate((node) => {
          const style = getComputedStyle(node);
          return {
            left: parseFloat(style.paddingLeft),
            background: style.backgroundColor,
            outline: style.outlineStyle,
            shadow: style.boxShadow,
          };
        });
        expect(control.left).toBeGreaterThanOrEqual(16);
        expect(control.background).not.toBe('rgba(0, 0, 0, 0)');
        expect(control.outline).toBe('none');
        expect(control.shadow).toBe('none');
        const edge = await row.locator('.job-title').boundingBox();
        for (const selector of ['.score', '.mobile-dates', '.source-link svg']) {
          const box = await row.locator(selector).boundingBox();
          expect(Math.abs(box.x + box.width - edge.x - edge.width), selector).toBeLessThanOrEqual(
            1,
          );
        }
        for (const selector of ['.score-trigger', '.source-link']) {
          const box = await row.locator(selector).boundingBox();
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: `test-results/aligned-card-${engine}.png` });
    } finally {
      await browser.close();
    }
  });
}
