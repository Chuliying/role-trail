import { test, expect } from '@playwright/test';
for (const engine of ['chromium', 'webkit']) {
  test(`${engine}: research opens readable history with download, empty and retry states`, async ({
    playwright,
  }) => {
    const browser = await playwright[engine].launch();
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    try {
      await page.goto('http://127.0.0.1:4319');
      const s = await (await page.request.get('/api/state')).json();
      const posted = await page.request.post('/api/action', {
        headers: { 'X-Role-Trail': '1' },
        data: {
          revision: s.revision,
          action: {
            type: 'research',
            run: {
              id: 'reader-' + engine,
              finishedAt: new Date().toISOString(),
              note: 'Saved historical search',
              coverage: [
                {
                  source: 'fixture',
                  status: 'partial',
                  screened: 1,
                  fullJd: 1,
                  query: 'AI frontend',
                  note: 'Original scope',
                },
              ],
            },
            jobs: [
              {
                company: 'Historical Co',
                title: 'Snapshot engineer',
                url: 'https://example.test/history-' + engine,
                source: 'fixture',
                descriptionKind: 'full',
                description:
                  '## Historical responsibilities\n- Build accessible AI interfaces.\n\n<script>window.bad=true</script>',
              },
            ],
          },
        },
      });
      expect(posted.ok()).toBeTruthy();
      await page.reload();
      await page.getByRole('button', { name: 'Research', exact: true }).click();
      const open = page.getByRole('button', { name: 'View full research', exact: true }).first();
      let releaseHistory;
      const historyGate = new Promise((resolve) => (releaseHistory = resolve));
      await page.route('**/api/research?run=*', async (route) => {
        await historyGate;
        await route.continue();
      });
      await open.click();
      const dialog = page.getByRole('dialog', { name: 'Full research record', exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('.reader-skeleton')).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Close research' })).toBeEnabled();
      expect((await dialog.boundingBox()).width).toBe(390);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      expect(
        await dialog
          .locator('.skeleton-line')
          .first()
          .evaluate((n) => getComputedStyle(n).animationName),
      ).toBe('none');
      await page.screenshot({ path: `test-results/research-loading-${engine}.png` });
      releaseHistory();
      await expect(dialog.locator('.reader-skeleton')).toHaveCount(0);
      await page.unroute('**/api/research?run=*');
      await expect(dialog.getByText('Saved historical search', { exact: true })).toBeVisible();
      await dialog.locator('summary').filter({ hasText: 'Snapshot engineer' }).click();
      await expect(
        dialog.getByRole('heading', { name: 'Historical responsibilities' }),
      ).toBeVisible();
      expect(await page.evaluate(() => window.bad)).toBeUndefined();
      await page.screenshot({
        path: `test-results/research-reader-${engine}.png`,
        animations: 'disabled',
      });
      expect((await dialog.boundingBox()).width).toBe(390);
      expect(await dialog.evaluate((n) => n.scrollWidth <= n.clientWidth)).toBeTruthy();
      const download = page.waitForEvent('download');
      await dialog.getByRole('link', { name: 'Download JSON' }).click();
      expect((await download).suggestedFilename()).toMatch(/^research-.*\.json$/);
      await dialog.getByRole('button', { name: 'Close research' }).click();
      await expect(open).toBeFocused();
      await page.route('**/api/research?run=*', (r) =>
        r.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Research archive not found' }),
        }),
      );
      await open.click();
      await expect(dialog.getByRole('alert')).toContainText('Research archive not found');
      await page.unroute('**/api/research?run=*');
      await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
      await expect(dialog.getByText('Saved historical search', { exact: true })).toBeVisible();
      await dialog.getByRole('button', { name: 'Close research' }).click();
      await page.route('**/api/research?run=*', (r) =>
        r.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            run: { id: 'empty', coverage: [], note: 'No matches this time' },
            jobs: [],
          }),
        }),
      );
      await open.click();
      await expect(
        dialog.getByText('No jobs were saved in this run.', { exact: true }),
      ).toBeVisible();
      await expect(dialog.getByText('No matches this time', { exact: true })).toBeVisible();
      await page.screenshot({
        path: `test-results/research-empty-${engine}.png`,
        animations: 'disabled',
      });
    } finally {
      await browser.close();
    }
  });
}
