import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
let api = {};
try {
  api = await import('../src/workbench.mjs');
} catch (e) {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
}
const job = {
  company: 'Synthetic Labs',
  title: 'Data Engineer',
  url: 'https://example.org/jobs/data',
  source: 'manual',
  description: 'Build reliable data products. Python and SQL experience required.',
  descriptionKind: 'full',
};
test('atomic research imports preserve personal state, reject conflicts and retain closure evidence', async () => {
  assert.equal(typeof api.LocalStore, 'function');
  const dir = await mkdtemp(join(tmpdir(), 'rt-store-'));
  try {
    const db = new api.LocalStore(dir);
    let s = await db.read();
    assert.equal(s.revision, 0);
    s = await db.update(0, {
      type: 'research',
      run: {
        id: 'r1',
        coverage: [
          {
            source: 'manual',
            status: 'searched',
            query: 'data',
            screened: 1,
            fullJd: 1,
            note: 'Synthetic test',
          },
        ],
      },
      jobs: [job],
    });
    const id = s.jobs[0].id;
    s = await db.update(s.revision, { type: 'review', jobId: id, status: 'shortlisted' });
    s = await db.update(s.revision, {
      type: 'task',
      jobId: id,
      text: 'Prepare project example',
      done: false,
    });
    await assert.rejects(
      db.update(0, { type: 'review', jobId: id, status: 'applied' }),
      /conflict/i,
    );
    s = await db.update(s.revision, {
      type: 'research',
      run: { id: 'r2', coverage: [] },
      jobs: [
        {
          ...job,
          availability: {
            status: 'closed',
            source: job.url,
            evidence: 'Closed on source',
            checkedAt: '2026-11-05T00:00:00Z',
          },
        },
      ],
    });
    s = await db.update(s.revision, {
      type: 'research',
      run: { id: 'r3', coverage: [] },
      jobs: [job],
    });
    assert.equal(s.jobs[0].availability.status, 'closed');
    assert.equal(s.reviews[id].status, 'shortlisted');
    assert.equal(s.tasks.length, 1);
    const before = await db.read();
    await assert.rejects(
      db.update(s.revision, {
        type: 'research',
        run: { id: 'bad', coverage: [] },
        jobs: [{ ...job, url: 'javascript:alert(1)' }],
      }),
    );
    assert.deepEqual(await db.read(), before);
    const race = await Promise.allSettled([
      db.update(s.revision, { type: 'review', jobId: id, status: 'applied' }),
      db.update(s.revision, { type: 'review', jobId: id, status: 'passed' }),
    ]);
    assert.equal(race.filter((x) => x.status === 'fulfilled').length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('research cannot import personal decisions; backup validation and resume binding are strict', () => {
  assert.equal(typeof api.transition, 'function');
  const s = api.emptyState();
  assert.throws(
    () =>
      api.transition(s, {
        type: 'research',
        run: { id: 'r', coverage: [] },
        jobs: [{ ...job, review: { status: 'applied' } }],
      }),
    /field|review/i,
  );
  let next = api.transition(s, { type: 'research', run: { id: 'r', coverage: [] }, jobs: [job] });
  const id = next.jobs[0].id;
  next = api.transition(next, { type: 'archive', jobId: id, archived: true });
  assert.equal(next.reviews[id].archived, true);
  next = api.transition(next, {
    type: 'assessment',
    binding: api.assessmentBinding(next, next.jobs[0]),
    jobId: id,
    score: 8,
    reason: 'Python evidence matches responsibilities',
    evidence: ['git:example'],
    gaps: ['SQL scale'],
    checkedAt: new Date().toISOString(),
  });
  assert.equal(next.reviews[id].status, 'review');
  assert.throws(
    () =>
      api.transition(next, {
        type: 'research',
        run: { id: 'r', coverage: [] },
        jobs: [{ ...job, title: 'Different role' }],
      }),
    /run/i,
  );
  assert.throws(() => api.validateState({ schemaVersion: 99 }));
});
test('an old observation or a new excerpt cannot erase a stored full JD', () => {
  const { transition, emptyState } = api;
  let s = transition(emptyState(), {
    type: 'research',
    run: { id: 'full', coverage: [] },
    jobs: [
      {
        company: 'Example',
        title: 'Role',
        url: 'https://example.com/full',
        source: 'official',
        description: 'Full verified content',
        descriptionKind: 'full',
        searchedAt: '2026-01-02T10:00:00Z',
      },
    ],
  });
  s = transition(s, {
    type: 'research',
    run: { id: 'older', coverage: [] },
    jobs: [
      {
        company: 'Example',
        title: 'Old title',
        url: 'https://example.com/full',
        source: 'official',
        description: 'Old content',
        descriptionKind: 'full',
        searchedAt: '2026-01-01T10:00:00Z',
      },
    ],
  });
  assert.equal(s.jobs[0].description, 'Full verified content');
  s = transition(s, {
    type: 'research',
    run: { id: 'excerpt', coverage: [] },
    jobs: [
      {
        company: 'Example',
        title: 'Role',
        url: 'https://example.com/full',
        source: 'search',
        description: 'Short excerpt',
        descriptionKind: 'excerpt',
        searchedAt: '2026-01-03T10:00:00Z',
      },
    ],
  });
  assert.equal(s.jobs[0].description, 'Full verified content');
  assert.equal(s.jobs[0].descriptionKind, 'full');
});

test('tracking parameters do not create duplicate jobs', () => {
  const a = api.normalizeJob({ ...job, url: 'https://example.com/job?utm_source=board&id=42' });
  const b = api.normalizeJob({ ...job, url: 'https://example.com/job?id=42&utm_medium=email' });
  assert.equal(a.id, b.id);
});

test('research snapshot deduplicates canonical URL aliases and records actual discovery', () => {
  let s = api.emptyState();
  s = api.transition(s, {
    type: 'research',
    run: { id: 'aliases', coverage: [] },
    jobs: [
      { ...job, url: job.url + '?utm_source=a' },
      { ...job, url: job.url + '?utm_source=b' },
    ],
  });
  assert.equal(s.jobs.length, 1);
  assert.equal(s.runs[0].observations.length, 1);
  assert.equal(s.runs[0].observations[0].discovered, true);
  s = api.transition(s, { type: 'research', run: { id: 'again', coverage: [] }, jobs: [job] });
  assert.equal(s.runs[1].observations[0].discovered, false);
});
