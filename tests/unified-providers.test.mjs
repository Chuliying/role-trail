import test from 'node:test';
import assert from 'node:assert/strict';
import { collect } from '../src/collect.mjs';
import { demoActions } from '../src/demo.mjs';
test('shared collector uses Taiwan provider output only for explicitly configured region and leaves qualifications unknown', async () => {
  const profile = {
    ...demoActions()[0].profile,
    feeds: [{ type: 'indeed', query: 'UI', country: 'TW', location: 'Taipei' }],
    platforms: ['indeed'],
  };
  let calls = 0;
  const bundle = await collect(profile, {
    taiwan: async () => {
      calls++;
      return {
        attempts: [{ status: 'partial' }],
        candidates: [
          {
            company: 'Fixture',
            title: 'UI',
            url: 'https://tw.indeed.com/viewjob?jk=fixture',
            descriptionText: 'Build interfaces.',
            fetchStatus: 'description_fetched',
            location: 'Taipei',
          },
        ],
      };
    },
  });
  assert.equal(calls, 1);
  assert.equal(bundle.jobs.length, 1);
  assert.equal(bundle.jobs[0].availability.status, 'unknown');
  assert.ok(bundle.jobs[0].checks.every((c) => c.status === 'unknown'));
  const other = await collect(
    { ...profile, feeds: [{ ...profile.feeds[0], country: 'US' }] },
    {
      taiwan: async () => {
        throw Error('must not run');
      },
    },
  );
  assert.equal(other.run.coverage[0].status, 'blocked');
});
test('Job-Frog expands company groups with bounded pages rather than reporting the group list as full JDs', async () => {
  const profile = {
    ...demoActions()[0].profile,
    feeds: [{ type: 'job-frog', query: 'React' }],
    platforms: ['job-frog'],
  };
  const seen = [];
  const payload =
    '1f:' +
    JSON.stringify([
      '$',
      null,
      null,
      { companies: [{ company: 'Fixture', job_count: 1 }], total: 1 },
    ]) +
    '\n';
  const bundle = await collect(profile, {
    fetchText: async (u) => {
      seen.push(u);
      return '<script>self.__next_f.push(' + JSON.stringify([1, payload]) + ')</script>';
    },
    fetchJSON: async (u) => {
      seen.push(u);
      return {
        data: [
          {
            title: 'UI',
            company: 'Fixture',
            website_link: 'https://example.test/job',
            summary_zh_hq: 'Product UI',
          },
        ],
        meta: { hasMore: false, appliedFilters: { companyExact: 'Fixture', q: 'React' } },
      };
    },
  });
  assert.equal(seen.length, 2);
  assert.equal(bundle.jobs.length, 1);
  assert.equal(bundle.jobs[0].descriptionKind, 'summary');
  assert.equal(bundle.run.coverage[0].fullJd, 0);
  assert.equal(bundle.run.coverage[0].status, 'partial');
});
