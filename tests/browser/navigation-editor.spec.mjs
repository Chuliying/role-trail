import { test, expect } from '@playwright/test';

test('dirty editor close and Escape require discard while cancel keeps input', async ({ page }) => {
  await page.goto('/');
  await page.locator('#tools-toggle').click();
  await page.locator('#profile-toggle').click();
  await page.getByRole('button', { name: 'Add capability', exact: true }).click();
  const input = page.locator('#editor textarea');
  await input.fill('{"claim":"Unsaved example"}');
  let prompts = 0;
  page.on('dialog', async (dialog) => {
    prompts++;
    await dialog.dismiss();
  });
  await page.locator('#close-editor').click();
  await expect(page.locator('#editor')).toBeVisible();
  await expect(input).toHaveValue('{"claim":"Unsaved example"}');
  expect(prompts).toBe(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#editor')).toBeVisible();
  expect(prompts).toBe(2);
  page.removeAllListeners('dialog');
  page.once('dialog', (dialog) => dialog.accept());
  await page.keyboard.press('Escape');
  await expect(page.locator('#editor')).not.toBeVisible();
  await page.getByRole('button', { name: 'Add capability', exact: true }).click();
  await page.locator('#close-editor').click();
  await expect(page.locator('#editor')).not.toBeVisible();
});

test('URL restores filters, score direction and view across reload and history', async ({
  page,
}) => {
  await page.goto('/?view=jobs&decision=review&q=Product&fit=7&sort=score&direction=asc');
  await page.locator('#filter-toggle').click();
  await expect(page.getByRole('searchbox')).toHaveValue('Product');
  await expect(page.getByLabel('Minimum fit')).toHaveValue('7');
  await page.keyboard.press('Escape');
  await expect(page.locator('th[aria-sort=ascending]')).toContainText('Fit');
  await expect(page.locator('.job-title')).toHaveCount(1);
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await expect(page).toHaveURL(/view=research/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Research log', exact: true })).toBeVisible();
  await page.goBack();
  await page.locator('#filter-toggle').click();
  await expect(page.getByRole('searchbox')).toHaveValue('Product');
  await expect(page.getByLabel('Minimum fit')).toHaveValue('7');
  await page.keyboard.press('Escape');
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Research log', exact: true })).toBeVisible();
});

test('invalid navigation params normalize and search editing does not create a history entry per letter', async ({
  page,
}) => {
  await page.goto('/?view=invalid&fit=999&sort=oops&direction=evil');
  await page.locator('#filter-toggle').click();
  await expect(page.getByRole('searchbox')).toBeVisible();
  await expect(page.getByLabel('Minimum fit')).toHaveValue('0');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Preparation', exact: true }).click();
  await page.getByRole('button', { name: 'Opportunities', exact: true }).click();
  await page.locator('#filter-toggle').click();
  await page.getByRole('searchbox').fill('Design');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page).toHaveURL(/q=Design/);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Preparation', exact: true })).toBeVisible();
});

test('failed save keeps edits; successful save clears the unsaved guard', async ({ page }) => {
  let fail = true;
  await page.route('**/api/action', async (route) => {
    if (fail) return route.fulfill({ status: 500, json: { error: 'Synthetic save failure' } });
    const response = await route.fetch();
    await route.fulfill({ response });
  });
  await page.goto('/?view=profile');
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  const input = page.locator('#editor textarea');
  const profile = JSON.parse(await input.inputValue());
  profile.name = 'Synthetic edited name';
  await input.fill(JSON.stringify(profile));
  await page.locator('#editor [type=submit]').click();
  await expect(page.locator('#editor-notice')).toContainText('Synthetic save failure');
  await expect(input).toHaveValue(JSON.stringify(profile));
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.locator('#close-editor').click();
  await expect(input).toBeVisible();
  fail = false;
  await page.locator('#editor [type=submit]').click();
  await expect(page.locator('#editor')).not.toBeVisible();
  await expect(page.locator('main')).toContainText('Synthetic edited name');
  const prevented = await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(false);
});

test('browser back respects dirty editor cancellation and acceptance', async ({ page }) => {
  await page.goto('/');
  await page.locator('#tools-toggle').click();
  await page.locator('#profile-toggle').click();
  await page.getByRole('button', { name: 'Add capability', exact: true }).click();
  const input = page.locator('#editor textarea');
  await input.fill('{"claim":"Unfinished"}');
  const prevented = await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(true);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.goBack();
  await expect(page).toHaveURL(/view=profile/);
  await expect(input).toHaveValue('{"claim":"Unfinished"}');
  page.once('dialog', (dialog) => dialog.accept());
  await page.goBack();
  await expect(page.locator('#editor')).not.toBeVisible();
  await page.locator('#filter-toggle').click();
  await expect(page.getByRole('searchbox')).toBeVisible();
});
