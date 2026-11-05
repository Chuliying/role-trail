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
      const footer = page.locator('#detail-footer');
      await expect(footer.getByRole('link', { name: 'Original job ↗' })).toBeVisible();
      await expect(footer.getByRole('button', { name: 'Archive', exact: true })).toBeVisible();
      await expect(
        page.locator('#detail-body').getByRole('link', { name: 'Original job ↗' }),
      ).toHaveCount(0);
      for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        const before = await footer.boundingBox();
        await page.locator('#detail-body').evaluate((n) => {
          n.scrollTop = n.scrollHeight;
        });
        const after = await footer.boundingBox(),
          dialog = await modal.boundingBox();
        expect(Math.abs(before.y - after.y)).toBeLessThan(1);
        expect(after.y + after.height).toBeLessThanOrEqual(dialog.y + dialog.height);
        await expect(footer.getByRole('button', { name: 'Archive', exact: true })).toBeInViewport();
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('#detail-body').evaluate((n) => {
        n.scrollTop = 0;
      });
      await page.screenshot({ path: `test-results/reader-${engine}.png` });
      const prepare = page
        .getByRole('navigation', { name: 'Opportunity sections' })
        .getByRole('button', { name: 'Preparation', exact: true });
      await prepare.click();
      const bodyTop = (await page.locator('#detail-body').boundingBox()).y;
      const tabsTop = (
        await page.getByRole('navigation', { name: 'Opportunity sections' }).boundingBox()
      ).y;
      expect(tabsTop - bodyTop).toBeLessThanOrEqual(1);
      const shortcuts = page.getByRole('group', { name: 'Preparation shortcuts' });
      await expect(shortcuts.getByRole('button')).toHaveCount(3);
      await expect(shortcuts.locator('svg')).toHaveCount(3);
      await expect(page.locator('#application-package a[href^="https:"]')).toHaveCount(0);
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        const boxes = await shortcuts.getByRole('button').evaluateAll((nodes) =>
          nodes.map((n) => ({
            y: n.getBoundingClientRect().y,
            right: n.getBoundingClientRect().right,
          })),
        );
        expect(
          Math.max(...boxes.map((b) => b.y)) - Math.min(...boxes.map((b) => b.y)),
        ).toBeLessThan(1);
        expect(Math.max(...boxes.map((b) => b.right))).toBeLessThan(width);
      }
      await page.screenshot({ path: `test-results/package-${engine}.png` });
      for (const [label, destination] of [
        ['Resume', 'Tailored resume'],
        ['Interview', 'Interview preparation'],
        ['Tasks', 'Preparation'],
      ]) {
        await prepare.click();
        await shortcuts.getByRole('button', { name: label, exact: true }).click();
        await expect(
          page.locator('#detail-body').getByRole('heading', { name: destination, exact: true }),
        ).toBeInViewport();
      }
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
