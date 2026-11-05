import { test, expect } from '@playwright/test';
test('review, shortlist, task, tailored resume and archive survive reload', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Product Engineer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Job description', exact: true })).toBeVisible();
  await page
    .getByRole('textbox', { name: 'New preparation task' })
    .fill('Prepare accessible UI example');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Prepare accessible UI example' }).check();
  await page.getByRole('button', { name: 'Generate draft', exact: true }).click();
  await expect(page.getByText('Version 1 · pending')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What changed for this role' })).toBeVisible();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByText('Version 1 · approved')).toBeVisible();
  await page.getByRole('button', { name: 'Close opportunity' }).click();
  await page.getByLabel('Decision for Product Engineer').selectOption('shortlisted');
  await page.getByRole('button', { name: 'Shortlisted', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Product Engineer', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Shortlisted', exact: true }).click();
  await page.getByRole('button', { name: 'Product Engineer', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Prepare accessible UI example' })).toBeChecked();
  await page.locator('#detail-body').getByRole('button', { name: 'Archive', exact: true }).click();
  await page.getByRole('button', { name: 'Close opportunity' }).click();
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Product Engineer', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('mobile research wraps long URLs; detail and profile fit viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const state = await (await page.request.get('/api/state')).json();
  const imported = await page.request.post('/api/action', {
    headers: { Origin: 'http://127.0.0.1:4319', 'X-Role-Trail': '1' },
    data: {
      revision: state.revision,
      action: {
        type: 'research',
        run: {
          id: 'long-coverage',
          coverage: [
            {
              source: 'Example source',
              status: 'partial',
              query: 'Long URL fixture',
              screened: 2,
              fullJd: 1,
              note: 'https://example.com/?query=' + '%E6%9C%AC'.repeat(200),
            },
          ],
        },
        jobs: [],
      },
    },
  });
  expect(imported.status()).toBe(200);
  await page.reload();
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/mobile-research.png', fullPage: true });
  await page.getByRole('button', { name: 'Opportunities', exact: true }).click();
  await page.getByRole('button', { name: 'Design Engineer', exact: true }).click();
  expect(
    await page.evaluate(
      () => document.querySelector('dialog[open]').scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: 'test-results/mobile-detail.png' });
  await page.getByRole('button', { name: 'Close opportunity' }).click();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Capability evidence' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('JD input is rendered as text and default ordering uses search recency', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Paste JD', exact: true }).click();
  await page.getByLabel('Company', { exact: true }).fill('Fresh synthetic');
  await page.getByLabel('Role title', { exact: true }).fill('Latest role');
  await page.getByLabel('Original HTTPS URL').fill('https://example.com/new');
  await page
    .getByLabel('Original job description')
    .fill('## Responsibilities\n- Build interfaces\n<script>window.pwned=true</script>');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('tbody tr').first()).toContainText('Latest role');
  await page.getByRole('button', { name: 'Latest role', exact: true }).click();
  await expect(page.getByText('<script>window.pwned=true</script>', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.pwned)).toBeUndefined();
});
