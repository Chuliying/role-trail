import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, transition } from '../src/workbench.mjs';
let resume = {},
  collector = {},
  schedule = {};
try {
  resume = await import('../src/resume.mjs');
} catch {}
try {
  collector = await import('../src/collect.mjs');
} catch {}
try {
  schedule = await import('../src/schedule.mjs');
} catch {}
export const profile = {
  name: 'Alex Example',
  targetRoles: ['Product Engineer'],
  location: 'Example City',
  remotePolicy: 'Worldwide',
  timezone: 'UTC',
  languages: ['English'],
  ownershipPolicy: 'None',
  platforms: ['greenhouse', 'manual'],
  feeds: [{ type: 'greenhouse', board: 'example' }],
};
test('tailoring uses confirmed claims only, records adjustments, invalidates approval after JD changes', () => {
  assert.equal(typeof resume.draftAction, 'function');
  let s = transition(emptyState(), { type: 'profile', profile });
  s = transition(s, {
    type: 'research',
    run: { id: 'one', coverage: [] },
    jobs: [
      {
        company: 'Example',
        title: 'Engineer',
        url: 'https://example.com/job',
        source: 'official',
        description: 'React accessibility',
      },
    ],
  });
  const job = s.jobs[0];
  s = transition(s, {
    type: 'capability',
    claim: 'Built an accessible React interface.',
    tags: ['React'],
    evidence: ['synthetic:sha:file'],
    status: 'confirmed',
  });
  s = transition(s, {
    type: 'capability',
    claim: 'Managed 900 people.',
    tags: [],
    evidence: ['unconfirmed'],
    status: 'proposed',
  });
  s = transition(s, resume.draftAction(s, job.id));
  assert.match(s.resumes[0].content, /accessible React/);
  assert.doesNotMatch(s.resumes[0].content, /900/);
  assert.ok(s.resumes[0].adjustments.length);
  s = transition(s, { type: 'resumeReview', jobId: job.id, version: 1, status: 'approved' });
  s = transition(s, {
    type: 'research',
    run: { id: 'two', coverage: [] },
    jobs: [
      {
        company: 'Example',
        title: 'Engineer',
        url: job.url,
        source: 'official',
        description: 'Changed requirement',
      },
    ],
  });
  assert.throws(
    () => transition(s, { type: 'resumeReview', jobId: job.id, version: 1, status: 'approved' }),
    /stale/i,
  );
  assert.doesNotMatch(resume.resumeHTML({ content: '<script>alert(1)</script>' }), /<script>/);
});
test('collectors retain truthful coverage and distinguish updates from original posting', async () => {
  assert.equal(typeof collector.collect, 'function');
  const requested = [];
  const fetchJSON = async (url) => {
    requested.push(url);
    return {
      jobs: [
        {
          id: 1,
          title: 'Product Engineer',
          absolute_url: 'https://example.com/jobs/1',
          updated_at: '2026-01-01',
          location: { name: 'Anywhere' },
          content: '<h2>Responsibilities</h2><p>Build interfaces</p>',
        },
      ],
    };
  };
  const b = await collector.collect(profile, { fetchJSON });
  assert.equal(b.jobs.length, 1);
  assert.equal(b.jobs[0].posting.kind, 'updated');
  assert.equal(b.jobs[0].checks[0].status, 'unknown');
  assert.equal(b.run.coverage.length, 2);
  assert.equal(b.run.coverage[0].fullJd, 1);
  assert.equal(b.run.coverage[1].status, 'not_run');
  assert.match(requested[0], /^https:\/\/boards-api.greenhouse.io\//);
  const failed = await collector.collect(profile, {
    fetchJSON: async () => {
      throw Error('secret should never leak');
    },
  });
  assert.equal(failed.run.coverage[0].status, 'blocked');
  assert.doesNotMatch(JSON.stringify(failed), /secret should/);
});
test('daily schedule honors timezone, pause, and one run per local date', () => {
  assert.equal(typeof schedule.due, 'function');
  const s = { status: 'active', time: '09:00', timezone: 'Asia/Tokyo', lastDate: null };
  assert.equal(schedule.due(s, new Date('2026-01-01T23:59:00Z')), null);
  assert.equal(schedule.due(s, new Date('2026-01-02T00:01:00Z')), '2026-01-02');
  assert.equal(
    schedule.due({ ...s, lastDate: '2026-01-02' }, new Date('2026-01-02T04:00:00Z')),
    null,
  );
  assert.equal(schedule.due({ ...s, status: 'paused' }, new Date('2026-01-02T04:00:00Z')), null);
});
test('changing confirmed capability evidence makes an approved resume stale', () => {
  let s = transition(emptyState(), { type: 'profile', profile });
  s = transition(s, {
    type: 'research',
    run: { id: 'r', coverage: [] },
    jobs: [
      {
        company: 'Example',
        title: 'Role',
        url: 'https://example.com/role',
        source: 'manual',
        description: 'Build React',
      },
    ],
  });
  s = transition(s, {
    type: 'capability',
    id: 'claim',
    claim: 'Built React screens.',
    tags: ['React'],
    evidence: ['synthetic evidence'],
    status: 'confirmed',
  });
  const id = s.jobs[0].id;
  s = transition(s, resume.draftAction(s, id));
  s = transition(s, {
    type: 'capability',
    id: 'claim',
    claim: 'Built React screens.',
    tags: ['React'],
    evidence: ['Attribution now disputed'],
    status: 'rejected',
  });
  assert.throws(
    () => transition(s, { type: 'resumeReview', jobId: id, version: 1, status: 'approved' }),
    /stale/i,
  );
});
test('optional Google Jobs uses one bounded request and does not treat snippets as official verification', async () => {
  let requests = 0;
  const p = {
    ...profile,
    platforms: ['google-jobs'],
    feeds: [{ type: 'google-jobs', query: 'data engineer', location: 'London' }],
  };
  const b = await collector.collect(p, {
    env: { SERPAPI_API_KEY: 'example-not-a-real-token' },
    fetchJSON: async (url) => {
      requests++;
      assert.equal(new URL(url).searchParams.get('engine'), 'google_jobs');
      return {
        search_metadata: { status: 'Success' },
        jobs_results: [
          {
            company_name: 'Synthetic',
            title: 'Data Engineer',
            description: 'Summary only',
            location: 'London',
            detected_extensions: { posted_at: '2 days ago' },
            apply_options: [{ link: 'https://example.com/data' }],
          },
        ],
      };
    },
  });
  assert.equal(requests, 1);
  assert.equal(b.jobs[0].descriptionKind, 'excerpt');
  assert.equal(b.jobs[0].availability.status, 'unknown');
  assert.equal(b.run.coverage[0].fullJd, 0);
  assert.doesNotMatch(JSON.stringify(b), /example-not-a-real-token/);
});
test('collection time budget records unexecuted sources instead of calling them searched', async () => {
  let clock = 0,
    calls = 0;
  const p = {
    ...profile,
    platforms: ['greenhouse', 'lever'],
    feeds: [
      { type: 'greenhouse', board: 'example' },
      { type: 'lever', company: 'example' },
    ],
  };
  const b = await collector.collect(p, {
    clock: () => clock,
    fetchJSON: async () => {
      calls++;
      clock = 200000;
      return { jobs: [] };
    },
  });
  assert.equal(calls, 1);
  assert.equal(b.run.coverage[1].status, 'not_run');
  assert.match(b.run.coverage[1].note, /budget/);
});
