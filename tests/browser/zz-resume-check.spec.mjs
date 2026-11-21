// Runs late: it adds synthetic resume checks to the shared fixture workspace.
import { test, expect } from '@playwright/test';
import { emptyState } from '../../src/workbench.mjs';
const headers = {
  'Content-Type': 'application/json',
  Origin: 'http://127.0.0.1:4319',
  'X-Role-Trail': '1',
};
const resume =
  '# Alex Morgan (synthetic)\n\n- Built an accessible component library used by four product teams.';
test('resume check page queues an original resume and shows the agent score', async ({ page }) => {
  const read = async () => (await page.request.get('/api/state')).json();
  // Earlier specs may have replaced the fixture's capabilities, so add one for the profile fill.
  const seeded = await page.request.post('/api/action', {
    headers,
    data: {
      revision: (await read()).revision,
      action: {
        type: 'capability',
        id: 'resume-check-ui',
        claim: 'Built an accessible component library in a synthetic project.',
        tags: ['React'],
        evidence: ['Synthetic evidence. Not a real candidate.'],
        status: 'confirmed',
      },
    },
  });
  expect(seeded.ok(), await seeded.text()).toBe(true);
  await page.goto('/');
  const openCheck = async () => {
    await page.locator('#tools-toggle').click();
    await page.locator('#resume-check').click();
  };
  await openCheck();
  await expect(page).toHaveURL(/view=check/);
  await expect(page.getByRole('heading', { name: 'Resume check', level: 1 })).toBeVisible();
  const queue = page.getByRole('button', { name: 'Queue for agent', exact: true });
  await queue.click();
  await expect(page.locator('#notice')).toContainText('Resume text is required.');
  await page.getByRole('button', { name: 'Use current profile', exact: true }).click();
  await expect(page.locator('#resume-check-title')).toHaveValue('Current profile');
  await expect(page.locator('#resume-check-content')).toHaveValue(/## Confirmed experience\n\n- /);
  const portfolio = (await read()).profile.portfolio;
  if (portfolio)
    expect(await page.locator('#resume-check-content').inputValue()).toContain(portfolio);
  const title = 'Synthetic master resume ' + Date.now();
  await page.locator('#resume-check-title').fill(title);
  await page.locator('#resume-check-content').fill(resume);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Use current profile', exact: true }).click();
  await expect(page.locator('#resume-check-content')).toHaveValue(resume);
  await page.locator('nav [data-page="jobs"]').click();
  await openCheck();
  await expect(page.locator('#resume-check-title')).toHaveValue(title);
  await expect(page.locator('#resume-check-content')).toHaveValue(resume);
  await queue.click();
  const card = page.locator('.resume-check-card', { hasText: title });
  await expect(card).toContainText('Queued for agent');
  await expect(card).toContainText('does not start an AI session');
  await expect(page.locator('#resume-check-content')).toHaveValue('');
  const state = await read();
  const check = state.resumeChecks.find((c) => c.title === title);
  expect(check.status).toBe('queued');
  // Stand in for the agent: build one result from the stored rubric and save it.
  const { createHash } = await import('node:crypto');
  const canonical = (value) =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((k) => [k, canonical(value[k])]),
          )
        : value;
  const sha = (text) => createHash('sha256').update(text).digest('hex');
  const saved = await page.request.post('/api/action', {
    headers,
    data: {
      revision: state.revision,
      action: {
        type: 'resumeCheckResult',
        id: check.id,
        results: [
          {
            rubricHash: sha(JSON.stringify(canonical(check.rubric))),
            resumeHash: sha(check.content),
            checkedAt: new Date().toISOString(),
            summary: 'Synthetic rubric estimate.',
            categories: check.rubric.categories.map((c) => ({
              key: c.key,
              score: 5,
              evidence: ['Built an accessible component library'],
              note: 'Synthetic note.',
              gaps: ['Synthetic gap.'],
            })),
            bonus: [],
            deductions: [],
          },
        ],
      },
    },
  });
  expect(saved.ok(), await saved.text()).toBe(true);
  await page.reload();
  await expect(card).toContainText('20 / 106');
  await expect(card).toContainText('Not a hiring probability');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  page.once('dialog', (dialog) => dialog.accept());
  await card.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(card).toHaveCount(0);
});

test('an empty workspace explains how to enable the queue', async ({ page }) => {
  await page.route('**/api/state', (route) => route.fulfill({ json: emptyState() }));
  await page.goto('/?view=check');
  await expect(page.getByRole('button', { name: 'Queue for agent', exact: true })).toBeDisabled();
  await expect(page.getByText('Create your profile before queuing a resume check.')).toBeVisible();
});
