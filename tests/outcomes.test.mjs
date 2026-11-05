import test from 'node:test';
import assert from 'node:assert/strict';
let api = {};
try {
  api = await import('../web/outcomes.mjs');
} catch (e) {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
}
const at = '2026-11-05T02:00:00Z';
const f = (status, checkedAt) => ({
  status,
  checkedAt,
  source: 'https://example.org/j',
  evidence: 'Synthetic fact',
});
const row = (id, firstSeenAt, score = 8) => ({
  id,
  url: `https://example.org/${id}`,
  company: 'Fixture',
  title: id,
  firstSeenAt,
  score,
  decision: 'review',
  verified: false,
});
test('weekly outcomes count unique newly discovered high-fit roles, not imports, revisits or reposts', () => {
  assert.equal(typeof api.researchOutcomes, 'function');
  const jobs = [
    row('old', '2026-10-01T00:00:00Z'),
    row('new', '2026-10-30T16:10:00Z'),
    row('seed', '2026-11-02T00:00:00Z'),
    row('low', '2026-11-02T00:00:00Z', 4),
  ];
  jobs[1].decision = 'shortlisted';
  const history = [
    { id: 'seed', kind: 'import', finishedAt: '2026-11-02T00:00:00Z', jobs: [jobs[0], jobs[2]] },
    { id: 'a', kind: 'daily', finishedAt: '2026-10-30T16:10:00Z', jobs: [jobs[1]] },
    { id: 'b', kind: 'daily', finishedAt: at, jobs: [jobs[0], jobs[1], jobs[3]] },
  ];
  const out = api.researchOutcomes({ jobs, history, timeZone: 'Asia/Taipei', now: at });
  assert.equal(out.startDate, '2026-10-30');
  assert.equal(out.newHighFit.length, 1);
  assert.equal(out.newHighFit[0].id, 'new');
  assert.equal(out.kept.length, 1);
  assert.equal(out.qualifying.length, 0);
  assert.equal(out.newJobs.length, 2);
});
test('checks resolved from known unknown/stale count once with valid new evidence and retain negative evidence', () => {
  assert.equal(typeof api.researchOutcomes, 'function');
  const j = row('old', '2026-10-01T00:00:00Z');
  const history = [
    {
      id: 'before',
      kind: 'daily',
      finishedAt: '2026-10-28T00:00:00Z',
      jobs: [
        {
          ...j,
          checks: [
            { key: 'remote', ...f('unknown', null) },
            { key: 'language', ...f('confirmed', '2026-08-01T00:00:00Z') },
          ],
        },
      ],
    },
    {
      id: 'a',
      kind: 'daily',
      finishedAt: '2026-11-01T01:00:00Z',
      jobs: [
        {
          ...j,
          checks: [
            { key: 'remote', ...f('confirmed', '2026-11-01T00:00:00Z') },
            { key: 'language', ...f('excluded', '2026-11-01T00:00:00Z') },
          ],
        },
      ],
    },
    {
      id: 'b',
      kind: 'daily',
      finishedAt: at,
      jobs: [
        {
          ...j,
          checks: [
            { key: 'remote', ...f('confirmed', '2026-11-01T00:00:00Z') },
            { key: 'language', ...f('unknown', null) },
          ],
        },
      ],
    },
  ];
  const out = api.researchOutcomes({ jobs: [j], history, timeZone: 'Asia/Taipei', now: at });
  assert.equal(out.resolvedPositive.length, 1);
  assert.equal(out.resolvedNegative.length, 1);
  assert.equal(out.newHighFit.length, 0);
  assert.equal(
    api.researchOutcomes({ jobs: [j], history: null, timeZone: 'UTC', now: at }).historyAvailable,
    false,
  );
});
test('package separates materials, user approval, qualification and submission; stale PDFs cannot count ready', () => {
  assert.equal(typeof api.applicationReadiness, 'function');
  const input = {
    resume: { exists: true, pdf: true, adjustments: true, reviewStatus: 'pending', stale: false },
    preparation: { exists: true, stale: false },
    tasks: [],
    qualification: 'verified',
    submitted: false,
  };
  let p = api.applicationReadiness(input);
  assert.equal(p.materialsReady, true);
  assert.equal(p.readyToApply, false);
  assert.equal(p.stage, 'review');
  p = api.applicationReadiness({ ...input, resume: { ...input.resume, reviewStatus: 'approved' } });
  assert.equal(p.readyToApply, true);
  assert.equal(p.submitted, false);
  p = api.applicationReadiness({
    ...input,
    resume: { ...input.resume, stale: true, reviewStatus: 'approved' },
    qualification: 'unknown',
  });
  assert.equal(p.materialsReady, false);
  assert.equal(p.readyToApply, false);
  assert.ok(p.missing.includes('resume_stale'));
  assert.ok(p.missing.includes('qualification'));
  p = api.applicationReadiness({ ...input, tasks: [{ done: false }] });
  assert.equal(p.materialsReady, false);
  assert.ok(p.missing.includes('tasks'));
});

test('missing saved PDF is not complete even with approved resume content', () => {
  const p = api.applicationReadiness({
    resume: { exists: true, pdf: false, adjustments: true, reviewStatus: 'approved' },
    preparation: { exists: true },
    qualification: 'verified',
  });
  assert.equal(p.materialsReady, false);
  assert.deepEqual(p.missing, ['pdf']);
});

test('legacy history revisit is not a new discovery when earlier snapshots are missing', () => {
  const j = row('legacy', '2026-11-01T00:00:00Z');
  const q = api.researchOutcomes({
    jobs: [j],
    historyComplete: false,
    now: at,
    history: [{ id: 'new', kind: 'daily', finishedAt: at, jobs: [{ ...j, discovered: false }] }],
  });
  assert.equal(q.newHighFit.length, 0);
});
