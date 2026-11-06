import { test, expect } from '@playwright/test';
for (const engine of ['chromium', 'webkit']) {
  test(`${engine}: loading is scoped, stable and respects reduced motion`, async ({
    playwright,
  }) => {
    const browser = await playwright[engine].launch();
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    try {
      let release;
      const gate = new Promise((r) => (release = r));
      await page.route('**/api/state', async (route) => {
        await gate;
        await route.continue();
      });
      let releaseScript;
      const scriptGate = new Promise((resolve) => (releaseScript = resolve));
      await page.route('**/app.js?*', async (route) => {
        await scriptGate;
        await route.continue();
      });
      await page.goto('http://127.0.0.1:4319', { waitUntil: 'commit' });
      // Exercise first HTML paint, before the module or its imports can run.
      await expect(page.locator('.workspace-skeleton')).toBeVisible();
      await expect(page.locator('#main > .loading')).toHaveCount(0);
      await page.evaluate(
        () => (window.initialSkeleton = document.querySelector('.workspace-skeleton')),
      );
      releaseScript();
      await expect(page.locator('#tools-toggle')).toBeDisabled();
      expect(
        await page.evaluate(
          () => window.initialSkeleton === document.querySelector('.workspace-skeleton'),
        ),
      ).toBe(true);

      await expect(page.locator('.workspace-skeleton')).toBeVisible();
      await expect(page.locator('#main')).toHaveAttribute('aria-busy', 'true');
      const shimmer = page.locator('.skeleton-title').first();
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      expect(await shimmer.evaluate((n) => getComputedStyle(n, '::after').animationName)).toBe(
        'skeleton-sweep',
      );
      const firstTransform = await shimmer.evaluate(
        (n) => getComputedStyle(n, '::after').transform,
      );
      await expect
        .poll(() => shimmer.evaluate((n) => getComputedStyle(n, '::after').transform))
        .not.toBe(firstTransform);
      await expect
        .poll(() => page.locator('.skeleton-shapes').evaluate((n) => getComputedStyle(n).opacity))
        .toBe('1');
      await page.screenshot({ path: `test-results/shimmer-${engine}.png` });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      expect(await shimmer.evaluate((n) => getComputedStyle(n, '::after').animationName)).toBe(
        'none',
      );
      expect(await shimmer.evaluate((n) => getComputedStyle(n, '::after').display)).toBe('none');
      expect(
        await page
          .locator('.skeleton-line')
          .first()
          .evaluate((n) => getComputedStyle(n).animationName),
      ).toBe('none');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBeTruthy();
      await page.screenshot({ path: `test-results/loading-${engine}.png` });
      release();
      await expect(page.locator('.workspace-skeleton')).toHaveCount(0);
      await page.unroute('**/api/state');
      const title = page.getByRole('button', { name: 'Product Engineer', exact: true });
      await expect(title).toBeVisible();
      const marker = await page.evaluate(() => (window.loadingTestMarker = Math.random()));
      let finish;
      const refreshGate = new Promise((r) => (finish = r));
      await page.route('**/api/state', async (route) => {
        await refreshGate;
        await route.continue();
      });
      const refresh = page.getByRole('button', { name: 'Refresh', exact: true });
      const width = (await refresh.boundingBox()).width;
      await refresh.click();
      await expect(refresh).toHaveAttribute('aria-busy', 'true');
      await expect(title).toBeVisible();
      expect((await refresh.boundingBox()).width).toBe(width);
      expect(await page.evaluate(() => window.loadingTestMarker)).toBe(marker);
      finish();
      await expect(refresh).not.toHaveAttribute('aria-busy', 'true');
      await page.unroute('**/api/state');
      await page.route('**/api/state', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: '{"error":"Offline test"}',
        }),
      );
      await refresh.click();
      await expect(page.locator('#notice')).toContainText('Offline test');
      await expect(title).toBeVisible();
      await expect(refresh).toBeEnabled();
      await page.unroute('**/api/state');
      await page.route('http://127.0.0.1:4319/', async (route) => {
        if (route.request().resourceType() === 'document') return route.continue();
        await route.fulfill({
          contentType: 'text/html',
          body: '<script src="/app.js?v=new-release" type="module"></script>',
        });
      });
      await refresh.click();
      await expect.poll(() => page.evaluate(() => window.loadingTestMarker)).toBeUndefined();
      await expect(
        page.getByRole('button', { name: 'Product Engineer', exact: true }),
      ).toBeVisible();
    } finally {
      await browser.close();
    }
  });
}
