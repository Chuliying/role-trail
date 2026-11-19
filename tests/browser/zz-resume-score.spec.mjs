// Runs last: it adds a synthetic resume draft and score to the shared fixture workspace.
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const sha = (text) => createHash('sha256').update(text).digest('hex');
const rubric = JSON.parse(
  await readFile(new URL('../../examples/rubric.json', import.meta.url), 'utf8'),
);
const headers = {
  'Content-Type': 'application/json',
  Origin: 'http://127.0.0.1:4319',
  'X-Role-Trail': '1',
};
test('a saved rubric score shows totals, range, evidence and its limits', async ({ page }) => {
  const read = async () => (await page.request.get('/api/state')).json();
  const send = async (action) => {
    const response = await page.request.post('/api/action', {
      headers,
      data: { revision: (await read()).revision, action },
    });
    expect(response.ok(), await response.text()).toBe(true);
  };
  // Earlier specs replace or archive fixture rows, so this spec creates its own.
  const title = 'Rubric Score Engineer';
  await send({
    type: 'research',
    run: {
      id: 'rubric-score-ui-' + Date.now(),
      kind: 'demo',
      coverage: [
        {
          source: 'manual',
          status: 'partial',
          query: 'Synthetic rubric score fixture',
          screened: 1,
          fullJd: 1,
          note: 'Synthetic.',
        },
      ],
    },
    jobs: [
      {
        company: 'Scorecard Works (demo)',
        title,
        url: 'https://example.com/jobs/rubric-score',
        source: 'manual',
        descriptionKind: 'full',
        description: 'Synthetic role for the rubric score view.',
      },
    ],
  });
  await send({
    type: 'capability',
    id: 'rubric-score-ui',
    claim: 'Built an accessible component library in a synthetic project.',
    tags: ['React'],
    evidence: ['Synthetic evidence. Not a real candidate.'],
    status: 'confirmed',
  });
  let s = await read();
  const job = s.jobs.find((j) => j.title === title);
  if (!s.resumes.some((r) => r.jobId === job.id))
    await send({
      type: 'resume',
      jobId: job.id,
      content:
        '# Alex Morgan (synthetic)\n\n- Built an accessible component library and tested keyboard navigation.',
      capabilityIds: ['rubric-score-ui'],
      adjustments: ['Synthetic adjustment.'],
      jdHash: sha(JSON.stringify([job.company, job.title, job.description])),
    });
  s = await read();
  const resume = s.resumes
    .filter((r) => r.jobId === job.id)
    .sort((a, b) => b.version - a.version)[0];
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
  const run = async (clarity) => ({
    rubricHash: sha(JSON.stringify(canonical(rubric))),
    resumeHash: sha(resume.content),
    checkedAt: new Date().toISOString(),
    summary: 'Synthetic rubric estimate.',
    categories: rubric.categories.map((c) => ({
      key: c.key,
      score: c.key === 'clarity' ? clarity : 10,
      evidence: ['Built an accessible component library'],
      note: 'Synthetic note.',
      gaps: ['Synthetic gap.'],
    })),
    bonus: [],
    deductions: [],
  });
  await send({
    type: 'resumeScore',
    jobId: job.id,
    version: resume.version,
    rubric,
    results: [await run(4), await run(9), await run(12)],
  });
  await page.goto('/');
  await page.locator('.job-title', { hasText: title }).first().click();
  await page.getByRole('tab', { name: 'Preparation', exact: true }).click();
  const score = page.locator('#rubric-score');
  await expect(score).toContainText('39 / 106 (34–42)');
  await expect(score).toContainText('Scoring runs: 3');
  await expect(score).toContainText('Not a hiring probability');
  await score.locator('summary').click();
  await expect(score).toContainText('Clarity and verifiability · 9 / 15 (4–12)');
  await expect(score).toContainText('Built an accessible component library');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
