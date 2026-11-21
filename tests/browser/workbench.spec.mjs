import { assessmentBinding } from '../../src/workbench.mjs';
import { test, expect } from '@playwright/test';
test('review, shortlist, task, tailored resume and archive survive reload', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Product Engineer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Job description', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Preparation', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'New preparation task' })
    .fill('Prepare accessible UI example');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/action') && r.request().method() === 'POST'),
    page.getByRole('checkbox', { name: 'Prepare accessible UI example' }).check(),
  ]);
  // Simulated host-agent save; the website now queues work rather than generating text.
  await expect
    .poll(async () => {
      const s = await (await page.request.get('/api/state')).json();
      return s.tasks.find((t) => t.text === 'Prepare accessible UI example')?.done;
    })
    .toBe(true);
  const snapshot = await (await page.request.get('/api/state')).json();
  const target = snapshot.jobs.find((j) => j.title === 'Product Engineer');
  const drafted = await page.request.post('/api/draft', {
    headers: { 'X-Role-Trail': '1' },
    data: { revision: snapshot.revision, jobId: target.id },
  });
  expect(drafted.ok(), await drafted.text()).toBeTruthy();
  await page.reload();
  await page.getByRole('button', { name: 'Product Engineer', exact: true }).click();
  await page.getByRole('tab', { name: 'Preparation', exact: true }).click();
  await expect(page.getByText('Version 1 · pending')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What changed for this role' })).toBeVisible();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByText('Version 1 · approved')).toBeVisible();
  await page.getByRole('button', { name: 'Request resume', exact: true }).click();
  await expect(page.getByText('Version 1 · approved')).toBeVisible();
  await page.getByRole('button', { name: 'Close opportunity' }).click();
  await page.getByLabel('Decision for Product Engineer').selectOption('shortlisted');
  await page.getByRole('button', { name: 'Shortlisted', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Product Engineer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Preparation', exact: true }).click();
  await page.getByRole('button', { name: 'Request shortlisted resumes', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('0 resume request(s) queued');
  await page.reload();
  await page.getByRole('button', { name: 'Opportunities', exact: true }).click();
  await page.getByRole('button', { name: 'Shortlisted', exact: true }).click();
  await page.getByRole('button', { name: 'Product Engineer', exact: true }).click();
  await page.getByRole('tab', { name: 'Preparation', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Prepare accessible UI example' })).toBeChecked();
  await page
    .locator('#detail-footer')
    .getByRole('button', { name: 'Archive', exact: true })
    .click();
  await page.getByRole('button', { name: 'Close opportunity' }).click();
  await page.getByRole('button', { name: 'Passed', exact: true }).click();
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
  await page.getByRole('tab', { name: 'Preparation', exact: true }).click();
  expect(
    await page.evaluate(
      () => document.querySelector('dialog[open]').scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: 'test-results/mobile-detail.png' });
  await page.getByRole('button', { name: 'Close opportunity' }).click();
  await page.locator('#tools-toggle').click();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Capability evidence' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('JD input is rendered as text and default ordering uses search recency', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
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
  await page.getByRole('button', { name: 'Opportunities', exact: true }).click();
  await page.getByRole('button', { name: 'Shortlisted', exact: true }).click();
  const row = page.locator('tbody tr').filter({ hasText: 'Regression role' });
  await expect(row.getByRole('button', { name: /Previous fit/ })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const previous = row.getByRole('button', { name: /Previous fit/ });
  expect((await previous.boundingBox()).height).toBe(44);
  expect((await previous.locator('.score').boundingBox()).height).toBeCloseTo(25.6, 1);
  expect(await previous.locator('.score').evaluate((n) => getComputedStyle(n).borderRadius)).toBe(
    '50%',
  );
  await expect(previous).toHaveText('9');
  await expect(previous.locator('svg')).toHaveCount(0);
  await row.screenshot({ path: 'test-results/compact-stale-score.png' });
  await previous.click();
  await expect(page.locator('.score-explanation:popover-open')).toContainText('React match');
  await page.getByRole('button', { name: 'View assessment', exact: true }).click();
  await expect(page.locator('#fit-evidence')).toContainText('Stale assessment');
  await page.getByRole('button', { name: 'Close opportunity' }).click();
  await expect(row.getByLabel('Remote policy verified')).toHaveCount(0);
  await expect(row.getByRole('button', { name: 'Application recorded' })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Resume v1 · stale' })).toBeVisible();
  await row.getByRole('button', { name: 'Resume v1 · stale' }).click();
  await expect(
    page.getByRole('heading', { name: 'Tailored resume', exact: true }),
  ).toBeInViewport();
  await page.getByRole('button', { name: 'Close opportunity' }).click();
  await row.getByRole('button', { name: 'Application recorded' }).click();
  await expect(
    page.getByRole('heading', { name: 'Application package', exact: true }),
  ).toBeInViewport();
  await page.getByRole('button', { name: 'Close opportunity' }).click();
  await page.getByRole('button', { name: 'Regression role', exact: true }).click();
  await page.getByRole('tab', { name: 'Fit & checks', exact: true }).click();
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
  await page.getByRole('button', { name: 'Opportunities', exact: true }).click();
  await page.getByRole('button', { name: 'Shortlisted', exact: true }).click();
  await page.getByRole('button', { name: 'Practice fixture', exact: true }).click();
  await page.getByRole('tab', { name: 'Preparation', exact: true }).click();
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
  await page.getByRole('button', { name: 'Opportunities', exact: true }).click();
  await page.getByRole('button', { name: 'Shortlisted', exact: true }).click();
  await page.getByRole('button', { name: 'Practice fixture', exact: true }).click();
  await page.getByRole('tab', { name: 'Preparation', exact: true }).click();
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
  await page.getByRole('tab', { name: 'Preparation', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Application package', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.package-overview')).toContainText('No application recorded.');
  await expect(page.locator('.package-overview')).toContainText('Create a tailored resume');
  await page.getByRole('textbox', { name: 'New preparation task' }).scrollIntoViewIfNeeded();
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

test('converted installation keeps approved PDF access, shared todos and historical fit on mobile', async ({
  page,
}) => {
  const { legacyFixture } = await import('../fixtures/legacy.mjs');
  const { convertLegacy } = await import('../../src/legacy-migration.mjs');
  const converted = convertLegacy(legacyFixture(), {});
  const before = await (await page.request.get('/api/state')).json();
  const saved = await page.request.post('/api/restore', {
    headers: { 'X-Role-Trail': '1' },
    data: { revision: before.revision, state: converted.state },
  });
  expect(saved.ok()).toBeTruthy();
  let state = await saved.json();
  const r = state.resumes[0],
    pdf = converted.artifacts.find((x) => x.hash === r.pdfHash).bytes;
  const attached = await page.request.post('/api/pdf', {
    headers: { 'X-Role-Trail': '1' },
    data: {
      revision: state.revision,
      input: { jobId: r.jobId, version: r.version, filename: r.pdfFilename },
      pdf: pdf.toString('base64'),
    },
  });
  expect(attached.ok()).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Shortlisted', exact: false }).first().click();
  await page.getByRole('button', { name: 'a', exact: true }).click();
  await page.getByRole('tab', { name: 'Preparation', exact: true }).click();
  await expect(page.getByText('Version 1 · approved', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open saved PDF ↗' }).first()).toBeVisible();
  const download = await page.request.get('/api/resume?job=' + r.jobId + '&version=1&format=pdf');
  expect(download.headers()['content-type']).toBe('application/pdf');
  expect(await download.body()).toEqual(pdf);
  const [taskSave] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/action') && r.request().method() === 'POST'),
    page.getByRole('checkbox', { name: /Practice/ }).check(),
  ]);
  expect(taskSave.ok()).toBeTruthy();
  state = await (await page.request.get('/api/state')).json();
  expect(state.tasks).toHaveLength(1);
  expect(state.tasks[0].jobIds).toHaveLength(2);
  expect(state.tasks[0].done).toBe(true);
  expect(state.resumes[0].reviewStatus).toBe('approved');
  expect(state.submissions).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('Traditional Chinese mobile keeps the compact original workspace shell', async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: 'zh-TW',
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  try {
    const initial = await (await page.request.get('/api/state')).json();
    const seeded = await page.request.post('/api/action', {
      headers: { Origin: 'http://127.0.0.1:4319', 'X-Role-Trail': '1' },
      data: {
        revision: initial.revision,
        action: {
          type: 'research',
          run: { id: 'zh-shell-fixture', coverage: [] },
          jobs: [
            {
              company: 'Example Studio',
              title: 'Frontend Product Engineer',
              url: 'https://example.test/zh-shell',
              source: 'official',
              description: '## Responsibilities\n- Build accessible product interfaces',
              descriptionKind: 'full',
              searchedAt: new Date().toISOString(),
            },
          ],
        },
      },
    });
    expect(seeded.status()).toBe(200);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '職缺清單', exact: true })).toBeVisible();
    await expect(page.locator('header .brand')).toHaveText('ROLE TRAIL');
    await expect(page.locator('nav button')).toHaveCount(3);
    await expect(page.locator('.tabs button')).toHaveCount(4);
    await expect(page.getByRole('button', { name: '貼上 JD', exact: true })).not.toBeVisible();
    const card = page.locator('tbody tr').first();
    await expect(card).toBeVisible();
    expect((await card.boundingBox()).y).toBeLessThan(460);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByLabel('最低契合分數')).not.toBeVisible();
    await page.getByRole('button', { name: '篩選', exact: true }).click();
    await expect(page.getByLabel('最低契合分數')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '工作區工具', exact: true }).click();
    await expect(page.getByRole('button', { name: '貼上 JD', exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/zh-mobile-tools.png' });
    await page.getByRole('button', { name: '工作區工具', exact: true }).click();
    await page.screenshot({ path: 'test-results/zh-mobile-jobs.png' });
  } finally {
    await context.close();
  }
});
test('touch cards avoid sticky hover, redundant totals and long-text overflow', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'en-US',
  });
  const page = await context.newPage();
  try {
    let state = await (await page.request.get('/api/state')).json();
    const headers = { 'X-Role-Trail': '1', Origin: 'http://127.0.0.1:4319' };
    const imported = await page.request.post('/api/action', {
      headers,
      data: {
        revision: state.revision,
        action: {
          type: 'research',
          run: {
            id: 'mobile-overflow-fixture',
            kind: 'daily',
            note: 'Research summary ' + 'SyntheticCompany/'.repeat(45),
            coverage: [
              {
                source: 'official',
                status: 'partial',
                query: 'https://example.test/?query=' + 'long'.repeat(100),
                screened: 1,
                fullJd: 1,
                note: 'Synthetic source',
              },
            ],
          },
          jobs: [
            {
              company: 'Example Studio',
              title: 'Senior Frontend Development Engineer',
              url: 'https://example.test/mobile-spacing',
              source: 'official',
              availability: {
                status: 'open',
                source: 'https://example.test/mobile-spacing',
                evidence: 'Synthetic opening',
                checkedAt: new Date().toISOString(),
              },
              checks: ['frontend', 'ai'].map((key) => ({
                key,
                label: key,
                status: 'confirmed',
                source: 'https://example.test/mobile-spacing',
                evidence: 'Synthetic responsibility',
                checkedAt: new Date().toISOString(),
              })),
              description: 'Synthetic frontend role',
              descriptionKind: 'full',
              searchedAt: new Date().toISOString(),
            },
          ],
        },
      },
    });
    expect(imported.ok()).toBeTruthy();
    state = await imported.json();
    const job = state.jobs.find((j) => j.url === 'https://example.test/mobile-spacing');
    state.tasks.push({
      id: 'spacing-task',
      jobId: job.id,
      text: 'Prepare an evidence-backed example',
      done: false,
      acceptance: 'ExplainValidationAndOwnership'.repeat(12),
      dependsOn: [],
    });
    const restored = await page.request.post('/api/restore', {
      headers,
      data: { revision: state.revision, state },
    });
    expect(restored.ok()).toBeTruthy();
    await page.goto('/');
    expect.soft(await page.locator('.page-heading p').count()).toBe(0);
    const archive = page.getByRole('button', { name: 'Filters', exact: true });
    await expect.soft(archive.locator('svg')).toHaveCount(1);
    expect.soft((await archive.textContent()).trim()).toBe('');
    const title = page.getByRole('button', { name: job.title, exact: true });
    await title.hover();
    expect
      .soft(await title.evaluate((n) => getComputedStyle(n).backgroundColor))
      .toBe('rgba(0, 0, 0, 0)');
    const jobRow = page.locator('.job-row').filter({ has: title });
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await jobRow.locator('.company').evaluate((node) => {
        node.textContent = 'Example Studio / International Product Team';
      });
      const company = await jobRow.locator('.company').boundingBox();
      const score = await jobRow.locator('td').nth(1).boundingBox();
      const role = await title.boundingBox();
      expect(company.x + company.width).toBeLessThanOrEqual(score.x);
      expect(role.y).toBeGreaterThanOrEqual(company.y + company.height);
      const facts = await jobRow.locator('.facts').boundingBox();
      const dates = await jobRow.locator('.mobile-dates').boundingBox();
      expect(facts.x + facts.width).toBeLessThanOrEqual(dates.x);
      expect(dates.y).toBeLessThan(facts.y + facts.height);
      await expect(jobRow.locator('.rt-verification')).toHaveCount(3);
      await expect(jobRow.locator('.mobile-dates')).not.toContainText('Unknown');
      await expect(jobRow).not.toContainText('No resume');
      const decision = await jobRow.locator('select').boundingBox();
      const source = await jobRow.getByRole('link', { name: 'Source ↗' }).boundingBox();
      expect(Math.abs(decision.y - source.y)).toBeLessThan(1);
      expect(Math.abs(decision.height - source.height)).toBeLessThan(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.screenshot({ path: 'test-results/touch-clean-jobs.png' });
    await page.getByRole('button', { name: 'Preparation', exact: true }).click();
    const card = page
      .locator('.card')
      .filter({ has: page.getByRole('button', { name: job.title, exact: true }) });
    const todo = card.locator('.todo'),
      open = card.getByRole('button', { name: 'Open preparation', exact: true });
    expect
      .soft(await todo.locator('small').evaluate((n) => getComputedStyle(n).display))
      .toBe('block');
    const a = await todo.boundingBox(),
      b = await open.boundingBox();
    expect.soft(b.y - a.y - a.height).toBeGreaterThanOrEqual(16);
    expect
      .soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/touch-preparation-spacing.png' });
    await page.getByRole('button', { name: 'Research', exact: true }).click();
    const research = page.locator('.research-card').filter({ hasText: 'SyntheticCompany/' });
    // The whole run summary needs wrapping, not only per-source coverage text.
    expect
      .soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    const bundle = page.getByRole('button', { name: 'View full research', exact: true }).first();
    const parent = bundle.locator('..');
    const c = await bundle.boundingBox(),
      d = await parent.locator('.coverage').boundingBox();
    expect.soft(d.y - c.y - c.height).toBeGreaterThanOrEqual(20);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await research.screenshot({ path: 'test-results/touch-research-wrap.png' });
  } finally {
    await context.close();
  }
});

test('workspace hierarchy keeps details optional and shared task labels independent', async ({
  page,
}) => {
  const headers = { Origin: 'http://127.0.0.1:4319', 'X-Role-Trail': '1' };
  let state = await (await page.request.get('/api/state')).json();
  const result = await page.request.post('/api/action', {
    headers,
    data: {
      revision: state.revision,
      action: {
        type: 'research',
        run: {
          id: 'layout-audit',
          note: 'Full research context '.repeat(30),
          coverage: [
            {
              source: 'Layout source',
              status: 'partial',
              screened: 12,
              fullJd: 2,
              query: 'https://example.test/?q=' + 'long/'.repeat(60),
              note: 'Actual limits remain readable.',
            },
          ],
        },
        jobs: [1, 2].map((i) => ({
          company: 'Layout Studio',
          title: 'Interface Engineer ' + i,
          url: 'https://example.test/layout-' + i,
          source: 'official',
          descriptionKind: 'full',
          description: '## Responsibilities\n- Build accessible interfaces',
          searchedAt: new Date().toISOString(),
        })),
      },
    },
  });
  expect(result.ok()).toBe(true);
  state = await result.json();
  const ids = state.jobs.filter((j) => j.company === 'Layout Studio').map((j) => j.id);
  const { demoActions } = await import('../../src/demo.mjs');
  state.profile = demoActions().find((action) => action.type === 'profile').profile;
  state.tasks.push({
    id: 'layout-shared',
    jobId: ids[0],
    jobIds: ids,
    text: 'Prepare an interface example',
    done: false,
    acceptance: 'Show keyboard navigation and test evidence.',
    dependsOn: [],
  });
  expect(
    (
      await page.request.post('/api/restore', {
        headers,
        data: { revision: state.revision, state },
      })
    ).ok(),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Preparation', exact: true }).click();
  const cards = page.locator('.preparation-card').filter({ hasText: 'Layout Studio' });
  const first = cards.first();
  const checkbox = first.getByRole('checkbox', {
    name: 'Prepare an interface example',
    exact: true,
  });
  await expect(
    first.getByText('Show keyboard navigation and test evidence.', { exact: true }),
  ).not.toBeVisible();
  await first.getByText('Task details', { exact: true }).click();
  await expect(checkbox).not.toBeChecked();
  await expect(
    first.getByText('Show keyboard navigation and test evidence.', { exact: true }),
  ).toBeVisible();
  const second = cards.nth(1);
  await second.locator('label').filter({ hasText: 'Prepare an interface example' }).click();
  await expect(
    cards.first().getByRole('checkbox', { name: 'Prepare an interface example', exact: true }),
  ).toBeChecked();
  await expect(
    cards.nth(1).getByRole('checkbox', { name: 'Prepare an interface example', exact: true }),
  ).toBeChecked();
  await first.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/audit-preparation-mobile.png' });
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  const run = page.locator('.research-card').filter({ hasText: 'Full research context' });
  const notes = run.locator('.research-note');
  await expect(notes).not.toBeVisible();
  await run.getByText('Run notes', { exact: true }).click();
  await expect(notes).toBeVisible();
  await run.getByText('Search details', { exact: true }).click();
  await expect(run.getByText('Actual limits remain readable.', { exact: true })).toBeVisible();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await run.getByText('Run notes', { exact: true }).click();
  await run.getByText('Search details', { exact: true }).click();
  await run.screenshot({ path: 'test-results/audit-research-mobile.png' });
  await page.getByRole('button', { name: 'Opportunities', exact: true }).click();
  await page.getByRole('button', { name: 'Interface Engineer 1', exact: true }).click();
  const modal = await page.locator('#detail').boundingBox();
  expect(modal.x).toBe(0);
  await expect(page.locator('#detail-title')).toBeFocused();
  await expect(page.locator('#job-description')).toBeVisible();
  await expect(page.locator('#application-package')).toBeHidden();
  await page.getByRole('tab', { name: 'Preparation', exact: true }).click();
  await expect(page.locator('#application-package')).toBeVisible();
  await expect(page.locator('#job-description')).toBeHidden();
  await page.getByRole('tab', { name: 'JD', exact: true }).click();
  await page.screenshot({ path: 'test-results/audit-detail-mobile.png' });
  await page.getByRole('button', { name: 'Close opportunity', exact: true }).click();
  await page.locator('#tools-toggle').click();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await expect(page.locator('.profile-fields')).toContainText('Alex Morgan');
  await page.screenshot({ path: 'test-results/audit-profile-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/audit-profile-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: 'Opportunities', exact: true }).click();
  await page.screenshot({ path: 'test-results/audit-jobs-desktop.png' });
});

test('JD retains semantic heading hierarchy and numbered nested lists without executing markup', async ({
  page,
}) => {
  const state = await (await page.request.get('/api/state')).json();
  const result = await page.request.post('/api/action', {
    headers: { Origin: 'http://127.0.0.1:4319', 'X-Role-Trail': '1' },
    data: {
      revision: state.revision,
      action: {
        type: 'research',
        run: { id: 'semantic-jd', coverage: [] },
        jobs: [
          {
            company: 'Semantic Studio',
            title: 'Structured JD fixture',
            url: 'https://example.test/semantic',
            source: 'official',
            descriptionKind: 'full',
            description:
              '## Responsibilities\n\nBuild **accessible** interfaces with [evidence](https://example.test/evidence).\n\n### Delivery\n\n3. Read requirements\n   - Check evidence\n4. Ship safely\n\n## Requirements\n\n- React\n- TypeScript\n\n<script>window.jdExecuted=true</script>\n\n[unsafe](javascript:alert(1))\n\n![tracker](https://example.test/tracker.png)',
          },
        ],
      },
    },
  });
  expect(result.ok()).toBe(true);
  await page.goto('/');
  await page.getByRole('button', { name: 'Structured JD fixture', exact: true }).click();
  const jd = page.locator('#job-description .jd');
  await expect(jd.locator('h3').first()).toHaveText('Responsibilities');
  await expect(jd.locator('h4')).toHaveText('Delivery');
  await expect(jd.locator('ol')).toHaveAttribute('start', '3');
  await expect(jd.locator('ol > li')).toHaveCount(2);
  await expect(jd.locator('ol > li > ul > li')).toHaveText('Check evidence');
  await expect(jd.locator('strong')).toHaveText('accessible');
  await expect(jd.getByRole('link', { name: 'evidence' })).toHaveAttribute(
    'href',
    'https://example.test/evidence',
  );
  expect(await jd.locator('script,img,iframe,a[href^="javascript:"]').count()).toBe(0);
  expect(await page.evaluate(() => window.jdExecuted)).toBeUndefined();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#detail').screenshot({ path: 'test-results/semantic-jd-mobile.png' });
});
