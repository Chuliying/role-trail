import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { demoActions } from '../../src/demo.mjs';
import { emptyState, transition } from '../../src/workbench.mjs';

for (const kind of ['decision', 'task']) {
  test(`${kind} ignores duplicate same-task changes and reenables after failure`, async ({
    page,
  }) => {
    const state = demoActions().reduce(transition, emptyState());
    state.tasks = [{ id: 'synthetic-task', text: 'Synthetic task', done: false }];
    await page.route('**/api/state', (r) => r.fulfill({ json: state }));
    let writes = 0;
    await page.route('**/api/action', async (r) => {
      writes++;
      await new Promise((resolve) => setTimeout(resolve, 200));
      await r.fulfill({ status: 409, json: { error: 'Synthetic failure' } });
    });
    await page.goto(kind === 'task' ? '/?view=tasks' : '/');
    const input = page
      .locator(kind === 'task' ? 'input[type=checkbox]' : '.job-row select')
      .first();
    await expect(input).toBeVisible();
    await input.evaluate((node, kind) => {
      if (kind === 'decision') {
        node.value = 'shortlisted';
        node.dispatchEvent(new Event('change', { bubbles: true }));
        node.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    }, kind);
    await expect(page.locator('#notice')).toContainText('Synthetic failure');
    await expect(input).toBeEnabled();
    expect(writes).toBe(1);
    if (kind === 'decision') await input.selectOption('shortlisted');
    else await input.click();
    await expect(input).toBeEnabled();
    expect(writes).toBe(2);
  });
}

test('preparation shows an unresolved state while binding hashes are pending', async ({ page }) => {
  const state = demoActions().reduce(transition, emptyState()),
    job = state.jobs[0];
  const hash = (text) => createHash('sha256').update(text).digest('hex');
  const jdHash = hash(JSON.stringify([job.company, job.title, job.description]));
  state.resumes = [
    {
      jobId: job.id,
      version: 1,
      jdHash,
      content: 'Synthetic resume',
      adjustments: ['Synthetic adjustment'],
      capabilityIds: [],
      bindingKind: 'legacy',
      reviewStatus: 'pending',
    },
  ];
  state.preparations = [
    {
      jobId: job.id,
      version: 1,
      jdHash,
      resumeVersion: 1,
      resumeContentHash: hash('Synthetic resume'),
      bindingKind: 'legacy',
      content: 'Synthetic interview',
      evidence: [],
    },
  ];
  await page.route('**/api/state', (r) => r.fulfill({ json: state }));
  await page.goto('/');
  await expect(page.locator('.job-row').first()).toBeVisible();
  await page.evaluate(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    const gate = new Promise((resolve) => {
      window.releaseBindingHashes = resolve;
    });
    crypto.subtle.digest = async (...args) => {
      await gate;
      return digest(...args);
    };
  });
  await page.locator('.job-title').first().click();
  await page.getByRole('tab', { name: 'Preparation', exact: true }).click();
  await expect(page.locator('#interview-section .meta')).toContainText('Checking');
  await expect(page.locator('#interview-section .meta')).not.toContainText('stale');
  await expect(page.locator('#application-package')).not.toContainText(
    'Update interview preparation',
  );
  await expect(page.locator('#application-package .status-grid dd').first()).toHaveText(
    'Checking…',
  );
  await expect(page.locator('#application-package')).not.toContainText(
    'Ready for your final check',
  );
  await page.evaluate(() => window.releaseBindingHashes());
  await expect(page.locator('#interview-section .meta')).toContainText('ready for review');
});

test('native editor close preserves dirty input when discard is canceled', async ({ page }) => {
  await page.goto('/?view=profile');
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  const editor = page.locator('#editor');
  const input = editor.locator('textarea');
  await input.fill('{"name":"Unsaved synthetic edit"}');
  let prompts = 0;
  page.on('dialog', (dialog) => {
    prompts++;
    return dialog.dismiss();
  });
  await editor.evaluate((dialog) => dialog.close());
  await expect(editor).toBeVisible();
  await expect(input).toHaveValue('{"name":"Unsaved synthetic edit"}');
  await expect(input).toBeFocused();
  expect(prompts).toBe(1);
  await editor.evaluate((dialog) => {
    dialog.dispatchEvent(new Event('cancel', { cancelable: false }));
    dialog.close();
  });
  await expect(editor).toBeVisible();
  await expect(input).toHaveValue('{"name":"Unsaved synthetic edit"}');
  await expect(input).toBeFocused();
  expect(prompts).toBe(2);
});
