import { test, expect } from '@playwright/test';

test.afterEach(async ({ request }) => {
  const state = await (await request.get('/api/state')).json();
  const job = state.jobs.find((j) => j.title === 'Design Engineer');
  if (state.reviews[job.id]?.status === 'shortlisted') {
    const reset = await request.post('/api/action', {
      headers: { 'X-Role-Trail': '1' },
      data: {
        revision: state.revision,
        action: { type: 'review', jobId: job.id, status: 'review' },
      },
    });
    expect(reset.ok()).toBeTruthy();
  }
});

test('failed decision save restores the persisted selection', async ({ page }) => {
  await page.goto('/');
  const decision = page.getByLabel('Decision for Design Engineer', { exact: true });
  await expect(decision).toBeVisible();
  const previous = await decision.inputValue();
  await page.route('**/api/action', (route) =>
    route.fulfill({
      status: 409,
      json: { error: 'Workspace changed. Refresh and try again.' },
    }),
  );
  await decision.selectOption(previous === 'shortlisted' ? 'review' : 'shortlisted');
  await expect(page.locator('#notice')).toContainText('Workspace changed');
  await expect(decision).toHaveValue(previous);
  await expect(decision).toBeEnabled();
});

test('failed task save restores the persisted checkbox', async ({ page }) => {
  const state = await (await page.request.get('/api/state')).json();
  const job = state.jobs.find((j) => j.title === 'Design Engineer');
  const saved = await page.request.post('/api/action', {
    headers: { 'X-Role-Trail': '1' },
    data: {
      revision: state.revision,
      action: {
        type: 'task',
        jobId: job.id,
        text: 'Rollback regression fixture',
        done: false,
      },
    },
  });
  expect(saved.ok()).toBeTruthy();
  await page.goto('/');
  await page.getByRole('button', { name: 'Design Engineer', exact: true }).click();
  await page.getByRole('tab', { name: 'Preparation', exact: true }).click();
  await page.route('**/api/action', (route) =>
    route.fulfill({
      status: 500,
      json: { error: 'Could not save task' },
    }),
  );
  const checkbox = page.getByRole('checkbox', { name: 'Rollback regression fixture' });
  // The failed response can roll back before WebKit's check() postcondition runs.
  await checkbox.click();
  await expect(page.locator('#detail-notice')).toContainText('Could not save');
  await expect(checkbox).not.toBeChecked();
  await expect(checkbox).toBeEnabled();
});

test('editor validation error stays inside the active dialog', async ({ page }) => {
  await page.goto('/');
  await page.locator('#tools-toggle').click();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Add capability', exact: true }).click();
  await page.locator('#editor textarea').fill('{ invalid');
  await page.locator('#editor button[type=submit]').click();
  await expect(page.locator('#editor')).toBeVisible();
  await expect(page.locator('#editor [role=alert]')).toBeVisible();
  await expect(page.locator('#editor [role=alert]')).not.toBeEmpty();
});

test('search keeps the composition input mounted until Chinese text is committed', async ({
  page,
}) => {
  await page.goto('/');
  const search = page.getByRole('searchbox');
  await expect(search).toBeVisible();
  await search.evaluate((input) => {
    window.composingInput = input;
    input.focus();
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    input.value = '工程';
    input.dispatchEvent(
      new InputEvent('input', { bubbles: true, isComposing: true, data: '工程' }),
    );
  });
  expect(await page.evaluate(() => window.composingInput.isConnected)).toBe(true);
  await search.evaluate((input) =>
    input.dispatchEvent(
      new CompositionEvent('compositionend', {
        bubbles: true,
        data: '工程',
      }),
    ),
  );
  await expect(page.getByRole('searchbox')).toHaveValue('工程');
  await expect(page.locator('.job-row')).toHaveCount(0);
});

test('an older refresh cannot undo a successful decision save', async ({ page }) => {
  await page.goto('/');
  const decision = page.getByLabel('Decision for Design Engineer', { exact: true });
  await expect(decision).toBeVisible();
  const next = (await decision.inputValue()) === 'shortlisted' ? 'review' : 'shortlisted';
  let release, captured;
  const gate = new Promise((resolve) => (release = resolve));
  const ready = new Promise((resolve) => (captured = resolve));
  await page.route('**/api/state', async (route) => {
    const response = await route.fetch({
      headers: { ...route.request().headers(), 'if-none-match': '' },
    });
    const snapshot = await response.json();
    captured();
    await gate;
    await route.fulfill({ json: snapshot });
  });
  const refresh = page.locator('#tools-toggle');
  await refresh.click();
  await page.locator('#refresh').click();
  await ready;
  await decision.selectOption(next);
  await expect
    .poll(async () => {
      const saved = await (await page.request.get('/api/state')).json();
      return saved.reviews[saved.jobs.find((j) => j.title === 'Design Engineer').id]?.status;
    })
    .toBe(next);
  await page
    .getByRole('button', {
      name: next === 'shortlisted' ? 'Shortlisted' : 'To Review',
      exact: true,
    })
    .click();
  release();
  await expect(refresh).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.getByLabel('Decision for Design Engineer', { exact: true })).toHaveValue(next);
});

for (const engine of ['chromium', 'webkit']) {
  test(`${engine}: decision saving responds immediately without layout shift or one-sided focus`, async ({
    playwright,
  }) => {
    const browser = await playwright[engine].launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      await page.goto('http://127.0.0.1:4319/');
      const select = page.getByLabel('Decision for Design Engineer', { exact: true });
      const previous = await select.inputValue();
      const field = select.locator('..');
      const before = await field.boundingBox();
      let release;
      const gate = new Promise((resolve) => (release = resolve));
      await page.route('**/api/action', async (route) => {
        await gate;
        await route.fulfill({ status: 500, json: { error: 'Save failed fixture' } });
      });
      await select.selectOption('shortlisted');
      await expect(select).toBeDisabled();
      await expect(select).toHaveAttribute('aria-busy', 'true');
      await expect(field.getByRole('status')).toBeVisible();
      const after = await field.boundingBox();
      expect(after.width).toBe(before.width);
      expect(after.height).toBe(before.height);
      expect(
        await field
          .locator('.decision-progress')
          .evaluate((n) => getComputedStyle(n, '::after').animationName),
      ).toBe('decision-spin');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      expect(
        await field
          .locator('.decision-progress')
          .evaluate((n) => getComputedStyle(n, '::after').animationName),
      ).toBe('none');
      await field.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/decision-saving-${engine}.png` });
      release();
      await expect(select).toBeEnabled();
      await expect(select).toHaveValue(previous);
      await expect(field.getByRole('status')).toBeHidden();
      await select.focus();
      await page.keyboard.press('Shift');
      const style = await select.evaluate((n) => ({
        shadow: getComputedStyle(n).boxShadow,
        borders: ['Top', 'Right', 'Bottom', 'Left'].map(
          (side) => getComputedStyle(n)['border' + side + 'Width'],
        ),
      }));
      expect(style.shadow).not.toMatch(/0px -[23]px/);
      expect(new Set(style.borders).size).toBe(1);
    } finally {
      await browser.close();
    }
  });
}
