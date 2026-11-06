import { test, expect } from '@playwright/test';
for (const engine of ['chromium', 'webkit']) {
  test(`${engine}: filter sheet shares chrome, animates both directions and honors reduced motion`, async ({
    playwright,
  }) => {
    const browser = await playwright[engine].launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      await page.goto('http://127.0.0.1:4319');
      await page.locator('#filter-toggle').click();
      const panel = page.locator('#list-filters');
      await expect(panel.locator('.dialog-bar')).toBeVisible();
      await expect(page.locator('#list-filters-title')).toBeFocused();
      expect(await panel.evaluate((n) => getComputedStyle(n).animationName)).toBe(
        'filter-sheet-enter',
      );
      await panel.evaluate((n) =>
        Promise.all(n.getAnimations().map((a) => a.finished.catch(() => {}))),
      );
      const layout = await panel.evaluate((n) => {
        const r = (s) => n.querySelector(s).getBoundingClientRect();
        return {
          title: r('h2').left,
          field: r('input').left,
          footer:
            r('.filter-panel-actions').left +
            parseFloat(getComputedStyle(n.querySelector('.filter-panel-actions')).paddingLeft),
          closeShadow: getComputedStyle(n.querySelector('.dialog-bar button')).boxShadow,
        };
      });
      expect(layout.title).toBe(layout.field);
      expect(layout.footer).toBe(layout.field);
      expect(layout.closeShadow).toBe('none');
      await page.keyboard.press('Tab');
      // Native WebKit may tab directly to the text field, depending on full keyboard access.
      await expect(panel.locator(':focus')).toHaveCount(1);
      expect(await panel.locator(':focus').evaluate((n) => getComputedStyle(n).boxShadow)).not.toBe(
        'none',
      );
      await page.locator('#list-filters-title').focus();
      await page.screenshot({ path: `test-results/filter-refined-${engine}.png` });
      await page.getByRole('searchbox').fill('discard');
      await panel.getByRole('button', { name: 'Close', exact: true }).evaluate((n) => n.click());
      await expect(panel).toHaveAttribute('data-closing', 'true');
      await expect(panel).toHaveCount(0);
      await expect(page.locator('#filter-toggle')).toBeFocused();
      await page.locator('#filter-toggle').click();
      await expect(page.getByRole('searchbox')).toHaveValue('');
      await page.getByRole('searchbox').fill('Design');
      await panel.getByRole('button', { name: 'Apply', exact: true }).click();
      await expect(panel).toHaveCount(0);
      await expect(page).toHaveURL(/q=Design/);
      await expect(page.locator('#filter-toggle')).toBeFocused();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.locator('#filter-toggle').click();
      expect(await panel.evaluate((n) => getComputedStyle(n).animationName)).toBe('none');
      await page.setViewportSize({ width: 320, height: 400 });
      await expect(panel.getByRole('button', { name: 'Apply', exact: true })).toBeInViewport();
      expect(await panel.evaluate((n) => n.getBoundingClientRect().height)).toBeLessThanOrEqual(
        360,
      );
      const bounds = await panel.evaluate((n) => ({
        bottom: n.getBoundingClientRect().bottom,
        footer: n.querySelector('.filter-panel-actions').getBoundingClientRect().bottom,
      }));
      expect(bounds.footer).toBeLessThanOrEqual(bounds.bottom);
      await panel.evaluate((n) => n.dispatchEvent(new Event('cancel', { cancelable: true })));
      await expect(panel).toHaveCount(0);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.locator('#filter-toggle').click();
      expect(await panel.evaluate((n) => getComputedStyle(n).animationName)).toBe(
        'filter-popover-enter',
      );
    } finally {
      await browser.close();
    }
  });
}
