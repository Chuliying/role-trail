import { assessmentBinding } from '../../src/workbench.mjs';
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
  await page.getByRole('button', { name: 'Generate draft', exact: true }).click();
  await expect(page.getByText('Version 1 · approved')).toBeVisible();
  await page.getByRole('button', { name: 'Close opportunity' }).click();
  await page.getByLabel('Decision for Product Engineer').selectOption('shortlisted');
  await page.getByRole('button', { name: 'Shortlisted', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Product Engineer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Preparation', exact: true }).click();
  await page.getByRole('button', { name: 'Draft all shortlisted', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('0 draft(s) generated');
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

test('stale scores, old verification and application history are represented honestly', async ({
  page,
}) => {
  await page.goto('/');
  let s = await (await page.request.get('/api/state')).json();
  const mutate = async (action) => {
    const response = await page.request.post('/api/action', {
      headers: { Origin: 'http://127.0.0.1:4319', 'X-Role-Trail': '1' },
      data: { revision: s.revision, action },
    });
    expect(response.status()).toBe(200);
    s = await response.json();
  };
  const url = 'https://example.com/jobs/review-regression';
  const old = new Date(Date.now() - 40 * 86400000).toISOString();
  const job = {
    company: 'Review fixture',
    title: 'Regression role',
    url,
    source: 'manual',
    descriptionKind: 'full',
    description: 'React UI',
    availability: { status: 'open', source: url, evidence: 'Old source', checkedAt: old },
    checks: [
      {
        key: 'remote',
        label: 'Remote policy',
        status: 'confirmed',
        source: url,
        evidence: 'Old remote source',
        checkedAt: old,
      },
    ],
  };
  await mutate({ type: 'research', run: { id: 'review-ui-1', coverage: [] }, jobs: [job] });
  const id = s.jobs.find((j) => j.url === url).id;
  await mutate({
    type: 'assessment',
    binding: assessmentBinding(
      s,
      s.jobs.find((j) => j.id === id),
    ),
    jobId: id,
    score: 9,
    reason: 'React match',
    evidence: ['Synthetic claim'],
    gaps: [],
    checkedAt: new Date().toISOString(),
  });
  for (const status of ['applied', 'passed', 'shortlisted'])
    await mutate({ type: 'review', jobId: id, status });
  const draft = await page.request.post('/api/draft', {
    headers: { Origin: 'http://127.0.0.1:4319', 'X-Role-Trail': '1' },
    data: { revision: s.revision, jobId: id },
  });
  expect(draft.status()).toBe(200);
  s = await draft.json();
  await mutate({ type: 'resumeReview', jobId: id, version: 1, status: 'approved' });
  await mutate({
    type: 'research',
    run: { id: 'review-ui-2', coverage: [] },
    jobs: [{ ...job, description: 'Embedded firmware' }],
  });
  await page.reload();
  await page.getByRole('button', { name: 'Shortlisted', exact: true }).click();
  const row = page.locator('tbody tr').filter({ hasText: 'Regression role' });
  await expect(row.getByText('Reassess', { exact: true })).toBeVisible();
  await expect(row.getByLabel('Remote policy verified')).toHaveCount(0);
  await expect(row).toContainText('Application recorded');
  await expect(row).toContainText('Resume v1 · stale');
  await page.getByRole('button', { name: 'Regression role', exact: true }).click();
  await expect(
    page.getByText('Stale assessment — reassess before using this score.'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Remote policy · stale' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit assessment', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Evidence-backed assessment' });
  const revised = JSON.parse(await editor.inputValue());
  revised.score = 3;
  revised.reason = 'Reassessed changed firmware role';
  await editor.fill(JSON.stringify(revised));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.locator('#detail-body').getByText('Reassessed changed firmware role', { exact: true }),
  ).toBeVisible();
  const saved = await (await page.request.get('/api/state')).json();
  expect(saved.jobs.find((j) => j.id === id).assessment.stale).toBe(false);
});

test('agent preparation appears in the workspace and shows stale after a new resume version', async ({
  page,
}) => {
  await page.goto('/');
  let s = await (await page.request.get('/api/state')).json();
  const headers = { Origin: 'http://127.0.0.1:4319', 'X-Role-Trail': '1' };
  const source = {
    company: 'Preparation fixture',
    title: 'Practice fixture',
    url: 'https://example.com/jobs/practice-fixture',
    source: 'manual',
    description: 'Build React interfaces',
    descriptionKind: 'full',
  };
  let response = await page.request.post('/api/action', {
    headers,
    data: {
      revision: s.revision,
      action: { type: 'research', run: { id: 'practice-ui', coverage: [] }, jobs: [source] },
    },
  });
  expect(response.status()).toBe(200);
  s = await response.json();
  const job = s.jobs.find((j) => j.url === source.url);
  response = await page.request.post('/api/action', {
    headers,
    data: {
      revision: s.revision,
      action: { type: 'review', jobId: job.id, status: 'shortlisted' },
    },
  });
  expect(response.status()).toBe(200);
  s = await response.json();
  response = await page.request.post('/api/draft', {
    headers,
    data: { revision: s.revision, jobId: job.id },
  });
  expect(response.status()).toBe(200);
  s = await response.json();
  const resume = s.resumes.filter((r) => r.jobId === job.id).at(-1);
  const { hash, jdHash } = await import('../../src/workbench.mjs');
  response = await page.request.post('/api/action', {
    headers,
    data: {
      revision: s.revision,
      action: {
        type: 'preparation',
        jobId: job.id,
        jdHash: jdHash(job),
        resumeVersion: resume.version,
        resumeContentHash: hash(resume.content),
        capabilityIds: ['demo-ui'],
        content:
          '## Possible interview concern\nExplain the UI reliability tradeoff.\n## Ask the employer\nHow do you review accessibility?',
      },
    },
  });
  expect(response.status()).toBe(200);
  s = await response.json();
  await page.reload();
  await page.getByRole('button', { name: 'Shortlisted', exact: true }).click();
  await page.getByRole('button', { name: 'Practice fixture', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Interview preparation', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Preparation v1 · ready for review', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Explain the UI reliability tradeoff.', { exact: true }),
  ).toBeVisible();
  response = await page.request.post('/api/action', {
    headers,
    data: {
      revision: s.revision,
      action: {
        type: 'resume',
        jobId: job.id,
        jdHash: jdHash(job),
        content: resume.content + '\nRevised wording.',
        capabilityIds: resume.capabilityIds,
        adjustments: resume.adjustments,
      },
    },
  });
  expect(response.status()).toBe(200);
  await page.reload();
  await page.getByRole('button', { name: 'Shortlisted', exact: true }).click();
  await page.getByRole('button', { name: 'Practice fixture', exact: true }).click();
  await expect(page.getByText('Preparation v1 · stale', { exact: true })).toBeVisible();
});

test('outcomes and application package show missing work without claiming application', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Seven-day outcomes' })).toBeVisible();
  await expect(page.getByText('New high-fit roles ·', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Opportunities', exact: true }).click();
  await page.getByRole('button', { name: 'Design Engineer', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Application package', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.package-overview')).toContainText('No application recorded.');
  await expect(page.locator('.package-overview')).toContainText('Create a tailored resume');
  await page
    .locator('.package-overview')
    .getByRole('button', { name: 'Tasks', exact: true })
    .click();
  await expect(page.getByRole('textbox', { name: 'New preparation task' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('shared verification icons expose sourced custom checks by keyboard and touch', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  const state = await (await page.request.get('/api/state')).json(),
    now = new Date().toISOString();
  const f = (key, label) => ({
    key,
    label,
    status: 'confirmed',
    checkedAt: now,
    source: 'https://example.org/evidence',
    evidence: 'Synthetic verification evidence',
  });
  const response = await page.request.post('/api/action', {
    headers: { Origin: 'http://127.0.0.1:4319', 'X-Role-Trail': '1' },
    data: {
      revision: state.revision,
      action: {
        type: 'research',
        run: { id: 'icon-fixture', coverage: [] },
        jobs: [
          {
            company: 'Icon fixture',
            title: 'Icon role',
            url: 'https://example.org/icons',
            source: 'manual',
            description: 'Synthetic job',
            descriptionKind: 'full',
            availability: {
              status: 'open',
              source: 'https://example.org/evidence',
              evidence: 'Recruiting',
              checkedAt: now,
            },
            checks: [
              f('frontend', 'Frontend responsibility'),
              f('language', 'English working language'),
              f('healthcare', 'Healthcare domain'),
              { ...f('salary', 'Compensation'), status: 'unknown' },
            ],
          },
        ],
      },
    },
  });
  expect(response.status()).toBe(200);
  await page.reload();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const frontend = page.locator('[data-verify-key="frontend"]').first();
    await expect(frontend.locator('svg')).toBeVisible();
    await expect(page.locator('[data-verify-key="healthcare"]')).toContainText('Healthcare domain');
    await expect(page.locator('[data-verify-key="salary"]')).toHaveCount(0);
    await frontend.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#verification-evidence')).toBeFocused();
    await expect(page.locator('#verification-evidence')).toContainText(
      'Synthetic verification evidence',
    );
    await page.getByRole('button', { name: 'Close opportunity' }).click();
    await page.locator('[data-verify-key="healthcare"]').click();
    await expect(page.locator('#verification-evidence')).toBeFocused();
    await page.getByRole('button', { name: 'Close opportunity' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const box = await frontend.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  const touch = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const mobile = await touch.newPage();
  await mobile.goto('http://127.0.0.1:4319/');
  await mobile.locator('[data-verify-key="healthcare"]').tap();
  await expect(mobile.locator('#verification-evidence')).toBeFocused();
  await touch.close();
});
