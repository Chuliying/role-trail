import { test, expect } from '@playwright/test';
import { demoActions } from '../../src/demo.mjs';
import { transition, emptyState } from '../../src/workbench.mjs';
for (const language of ['en', 'zh-TW']) {
  test(`${language}: shortlisted labels remain readable beside resume and source actions`, async ({
    page,
  }) => {
    const state = demoActions().reduce(transition, emptyState());
    const job = state.jobs[0];
    state.reviews[job.id] = { status: 'shortlisted' };
    state.submissions = [{ jobId: job.id }];
    state.resumes.push({
      jobId: job.id,
      version: 1,
      content: 'Synthetic resume',
      adjustments: [],
      capabilityIds: [],
      reviewStatus: 'pending',
      jdHash: 'synthetic',
      bindingKind: 'legacy',
    });
    await page.addInitScript((lang) => localStorage.setItem('role-trail.language', lang), language);
    await page.route('**/api/state', (r) => r.fulfill({ json: state }));
    for (const width of [320, 390, 720, 769, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/?decision=shortlisted');
      const select = page.locator('.job-row select').first();
      await expect(select).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const fit = await select.evaluate((node) => {
        const s = getComputedStyle(node),
          c = document.createElement('canvas').getContext('2d');
        c.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
        return {
          available: node.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight),
          required: c.measureText(node.selectedOptions[0].text).width,
        };
      });
      expect(fit.available).toBeGreaterThanOrEqual(fit.required);
      if ([390, 769, 1280].includes(width))
        await page.screenshot({
          animations: 'disabled',
          path: `test-results/shortlisted-${language}-${width}.png`,
        });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  });
}
