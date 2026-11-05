import { test, expect } from '@playwright/test';

for (const engine of ['chromium', 'webkit']) {
  test(`${engine}: mobile roles have separate surfaces, icon actions and a centered JD reader`, async ({
    playwright,
  }) => {
    const browser = await playwright[engine].launch();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    try {
      await page.goto('http://127.0.0.1:4319');
      const rows = page.locator('.job-row');
      await expect(rows.first()).toBeVisible();
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        const a = await rows.nth(0).boundingBox(),
          b = await rows.nth(1).boundingBox();
        expect.soft(b.y - a.y - a.height).toBeGreaterThanOrEqual(12);
        expect
          .soft(await rows.first().evaluate((n) => getComputedStyle(n).backgroundColor))
          .not.toBe('rgba(0, 0, 0, 0)');
        const source = rows.first().getByRole('link', { name: 'Source ↗' });
        expect.soft((await source.textContent()).trim()).toBe('');
        await expect.soft(source.locator('svg')).toHaveCount(1);
        await expect.soft(rows.first().locator('.mobile-dates')).not.toContainText('Searched');
        expect
          .soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
          .toBe(true);
      }
      await page.screenshot({ path: `test-results/cards-${engine}.png` });
      await rows.first().locator('.job-title').click();
      const modal = page.locator('#detail');
      await expect(modal).toBeVisible();
      const box = await modal.boundingBox();
      expect.soft(Math.abs(box.x - (390 - box.x - box.width))).toBeLessThanOrEqual(2);
      expect.soft(box.x).toBeGreaterThanOrEqual(10);
      await expect.soft(page.locator('#close-detail svg')).toHaveCount(1);
      await expect.soft(page.locator('#detail-title')).toBeFocused();
      const jd = await page.locator('#job-description').boundingBox();
      const pack = await page.locator('#application-package').boundingBox();
      expect.soft(jd.y).toBeLessThan(pack.y);
      await page.screenshot({ path: `test-results/reader-${engine}.png` });
      await page.getByRole('button', { name: 'Close opportunity' }).click();
      await page.evaluate(() => {
        window.previousClient = true;
      });
      await page.getByRole('button', { name: 'Refresh', exact: true }).click();
      await expect.poll(() => page.evaluate(() => window.previousClient)).toBeUndefined();
    } finally {
      await context.close();
      await browser.close();
    }
  });
}
