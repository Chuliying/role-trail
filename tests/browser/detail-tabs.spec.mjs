import { test, expect } from '@playwright/test';
for (const engine of ['chromium', 'webkit']) {
  test(`${engine}: full-screen reader tabs and visible failed actions`, async ({ playwright }) => {
    const browser = await playwright[engine].launch();
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    try {
      await page.goto('http://127.0.0.1:4319');
      await page.locator('.job-title').first().click();
      const dialog = page.locator('#detail');
      const box = await dialog.boundingBox();
      expect(box.x).toBe(0);
      expect(box.y).toBe(0);
      expect(box.width).toBe(390);
      expect(box.height).toBe(844);
      await expect(page.getByRole('tab', { name: 'JD', exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(page.locator('#application-package')).toBeHidden();
      await page.getByRole('tab', { name: 'Preparation', exact: true }).click();
      await expect(page.locator('#job-description')).toBeHidden();
      await expect(page.locator('#application-package')).toBeVisible();
      await expect(page.locator('.package-links')).toHaveCount(0);
      await expect(
        page
          .locator('#detail-footer')
          .getByRole('button', { name: 'Archive', exact: true })
          .locator('svg'),
      ).toHaveCount(1);
      const panels = page.locator('#panel-preparation');
      const sections = await panels
        .locator(':scope > section')
        .evaluateAll((ns) => ns.map((n) => n.id));
      expect(sections).toEqual([
        'application-package',
        'resume-section',
        'interview-section',
        'task-section',
      ]);
      const left = await panels
        .locator(':scope > section')
        .evaluateAll((ns) => ns.map((n) => n.getBoundingClientRect().x));
      expect(new Set(left).size).toBe(1);
      await page.route('**/api/action', async (route) => {
        await new Promise((r) => setTimeout(r, 200));
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Request could not be saved. Please retry.' }),
        });
      });
      const generate = page.getByRole('button', { name: 'Request resume', exact: true });
      await generate.click();
      await expect(generate).toBeDisabled();
      expect(await generate.evaluate((n) => getComputedStyle(n, '::before').animationName)).toBe(
        'busy-spin',
      );
      await expect(dialog.getByRole('status')).toContainText(
        'Request could not be saved. Please retry.',
      );
      await expect(generate).toBeEnabled();
      await page.unroute('**/api/action');
      const before = await (await page.request.get('/api/state')).json();
      await generate.click();
      await expect(
        page.getByRole('button', { name: 'Queued for agent', exact: true }),
      ).toBeDisabled();
      const after = await (await page.request.get('/api/state')).json();
      expect(after.resumes).toEqual(before.resumes);
      expect(after.resumeRequests.filter((r) => r.status === 'queued')).toHaveLength(1);
      await page.reload();
      await page.locator('.job-title').first().click();
      await page.getByRole('tab', { name: 'Preparation', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Queued for agent', exact: true }),
      ).toBeDisabled();
      await page.getByRole('button', { name: 'Cancel request', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Request resume', exact: true })).toBeEnabled();
      await page.screenshot({
        animations: 'disabled',
        path: `test-results/full-reader-${engine}.png`,
      });
      await page.getByRole('tab', { name: 'Fit & checks', exact: true }).click();
      await expect(page.locator('#fit-evidence')).toBeVisible();
      await page.getByRole('tab', { name: 'Fit & checks', exact: true }).press('ArrowLeft');
      await expect(page.getByRole('tab', { name: 'JD', exact: true })).toBeFocused();
      await expect(page.locator('#job-description')).toBeVisible();
    } finally {
      await browser.close();
    }
  });
}
