import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { demoActions } from '../../src/demo.mjs';
import { transition, emptyState } from '../../src/workbench.mjs';
const file = new URL('../fixtures/ui-layout.json', import.meta.url);
test('shared components preserve the reviewed mobile and desktop geometry', async ({ page }) => {
  const state = demoActions().reduce(transition, emptyState());
  await page.route('**/api/state', (route) => route.fulfill({ json: state }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const result = {};
  const capture = async (selectors) =>
    page.evaluate(
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
