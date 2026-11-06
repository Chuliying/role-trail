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
      await expect(rows.locator('.remote-symbol,.unrated')).toHaveCount(0);
      await expect(rows.first().locator('.mobile-dates')).not.toContainText(/\d{2}:\d{2}/);
      await expect(rows.first().locator('.time-mark').last()).toHaveAttribute(
        'title',
        /\d{2}:\d{2}/,
      );
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
      await page.screenshot({ animations: 'disabled', path: `test-results/cards-${engine}.png` });
      await rows.first().locator('.job-title').click();
      const modal = page.locator('#detail');
      await expect(modal).toBeVisible();
      const box = await modal.boundingBox();
      expect.soft(Math.abs(box.x - (390 - box.x - box.width))).toBeLessThanOrEqual(2);
      expect.soft(box.x).toBe(0);
      await expect.soft(page.locator('#close-detail svg')).toHaveCount(1);
      await expect.soft(page.locator('#detail-title')).toBeFocused();
      await expect(page.locator('#job-description')).toBeVisible();
      await expect(page.locator('#application-package')).toBeHidden();
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
      await page.screenshot({ animations: 'disabled', path: `test-results/reader-${engine}.png` });
      await page.getByRole('tab', { name: 'Preparation', exact: true }).click();
      await expect(page.locator('#application-package')).toBeVisible();
      await expect(page.locator('.package-links')).toHaveCount(0);
      await page.screenshot({ animations: 'disabled', path: `test-results/package-${engine}.png` });
      await page.getByRole('button', { name: 'Close opportunity' }).click();
      await page.evaluate(() => {
        window.previousClient = true;
      });
      await page.locator('#tools-toggle').click();
      await page.getByRole('button', { name: 'Refresh', exact: true }).click();
      await expect(page.locator('#tools-toggle')).not.toHaveAttribute('aria-busy', 'true');
      expect(await page.evaluate(() => window.previousClient)).toBe(true);
      await expect(rows.first()).toBeVisible();
      // Page transitions are intentional; typing and state refreshes must not replay them.
      for (const reduced of [false, true]) {
        await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
        const animations = await page.evaluate(() => {
          document.querySelector('nav [data-page="tasks"]').click();
          return document.querySelector('#main').getAnimations().length;
        });
        expect(animations).toBe(reduced ? 0 : 1);
        await page.getByRole('button', { name: 'Opportunities', exact: true }).click();
        await page.locator('#main').evaluate(async (n) => {
          await Promise.all(n.getAnimations().map((a) => a.finished.catch(() => {})));
        });
        await page.locator('#filter-toggle').click();
        await page.locator('input[type="search"]').fill('Engineer');
        expect(await page.locator('#main').evaluate((n) => n.getAnimations().length)).toBe(0);
        await page.locator('input[type="search"]').fill('');
        await page.getByRole('button', { name: 'Apply', exact: true }).click();
        await rows.first().locator('.job-title').click();
        expect(await modal.evaluate((n) => getComputedStyle(n).animationName)).toBe(
          reduced ? 'none' : 'reader-enter',
        );
        await page.getByRole('button', { name: 'Close opportunity' }).click();
      }
    } finally {
      await context.close();
      await browser.close();
    }
  });
}
