import { test, expect } from '@playwright/test';

test('a same-task double click sends one resume request', async ({ page }) => {
  await page.goto('/');
  await page.locator('.job-title').first().click();
  await page.getByRole('tab', { name: 'Preparation', exact: true }).click();
  let writes = 0;
  await page.route('**/api/action', async (route) => {
    writes++;
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({ status: 400, json: { error: 'Synthetic failure; retry allowed.' } });
  });
  const request = page.getByRole('button', { name: 'Request resume', exact: true });
  await request.evaluate((button) => {
    button.click();
    button.click();
  });
  await expect(page.locator('#detail [role="status"]')).toContainText('Synthetic failure');
  await expect(request).toBeEnabled();
  expect(writes).toBe(1);
  await request.click();
  await expect(request).toBeEnabled();
  expect(writes).toBe(2);
});
