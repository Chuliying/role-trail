import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { demoActions } from '../../src/demo.mjs';
import { transition, emptyState } from '../../src/workbench.mjs';
const file = new URL('../fixtures/ui-layout.json', import.meta.url);
// Font metrics and ch units vary across OS/browser builds. Check their real
// containment below; keep exact snapshots for fixed geometry and design tokens.
const contentWidths = new Set(['.brand', '.job-title', 'nav', '.jd']);
test('shared components preserve the reviewed mobile and desktop geometry', async ({ page }) => {
  const state = demoActions().reduce(transition, emptyState());
  await page.route('**/api/state', (route) => route.fulfill({ json: state }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const result = {};
  const capture = async (selectors) => {
    for (const selector of selectors.filter((s) => contentWidths.has(s))) {
      const geometry = await page
        .locator(selector)
        .first()
        .evaluate((node) => {
          const box = node.getBoundingClientRect();
          let parent = node.parentElement;
          while (getComputedStyle(parent).display === 'contents') parent = parent.parentElement;
          const style = getComputedStyle(parent);
          const own = getComputedStyle(node);
          const available =
            own.position === 'fixed'
              ? innerWidth
              : parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
          const range = document.createRange();
          range.selectNodeContents(node);
          const content = range.getBoundingClientRect();
          return {
            width: box.width,
            available,
            overflow: node.scrollWidth > node.clientWidth + 1,
            contentLeft: content.left - box.left,
            contentRight: box.right - content.right,
            readingWidth: Math.min(available, parseFloat(own.maxWidth)),
          };
        });
      expect(geometry.width, `${selector} has visible width`).toBeGreaterThan(0);
      expect(geometry.width, `${selector} fits its parent`).toBeLessThanOrEqual(
        geometry.available + 1,
      );
      expect(geometry.overflow, `${selector} does not clip content`).toBe(false);
      expect(geometry.contentLeft, `${selector} text fits left edge`).toBeGreaterThanOrEqual(-1);
      expect(geometry.contentRight, `${selector} text fits right edge`).toBeGreaterThanOrEqual(-1);
      if (selector === '.jd')
        expect(
          Math.abs(geometry.width - geometry.readingWidth),
          'JD follows its font-relative reading measure',
        ).toBeLessThan(1);
    }
    const styles = await page.evaluate(
      (selectors) =>
        Object.fromEntries(
          selectors.map((selector) => {
            const node = document.querySelector(selector),
              s = getComputedStyle(node);
            return [
              selector,
              Object.fromEntries(
                [
                  'display',
                  'width',
                  'height',
                  'padding',
                  'margin',
                  'gap',
                  'fontSize',
                  'fontFamily',
                  'lineHeight',
                  'borderWidth',
                  'borderRadius',
                  'backgroundColor',
                  'color',
                ].map((key) => [key, s[key]]),
              ),
            ];
          }),
        ),
      selectors,
    );
    for (const selector of selectors.filter((s) => contentWidths.has(s)))
      styles[selector].width = 'content-constrained';
    return styles;
  };
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.locator('.job-row').first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    result[width] = await capture([
      'header',
      'main',
      '.brand',
      '.tabs',
      '#filter-toggle',
      '.job-row',
      '.job-title',
      '.row-actions',
      '.decision-field select',
      'nav',
    ]);
    await page.getByRole('button', { name: 'Product Engineer', exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    result[width].dialog = await capture([
      '#detail',
      '.dialog-bar',
      '#detail-tabs',
      '#detail-footer',
      '.jd',
    ]);
  }
  if (process.env.RECORD_LAYOUT === '1')
    await writeFile(file, JSON.stringify(result, null, 2) + '\n');
  else expect(result).toEqual(JSON.parse(await readFile(file, 'utf8')));
});
