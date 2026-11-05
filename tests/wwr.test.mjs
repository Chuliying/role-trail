import test from 'node:test';
import assert from 'node:assert/strict';
import { collect } from '../src/collect.mjs';
import { validateFeeds } from '../src/onboarding.mjs';
import { demoActions } from '../src/demo.mjs';
const item = (id = 'fixture-role') =>
  `<item><title><![CDATA[Example & Co: Frontend Engineer]]></title><link>https://weworkremotely.com/remote-jobs/${id}</link><region>Anywhere in the World</region><pubDate>Thu, 05 Nov 2026 12:00:00 GMT</pubDate><description>&lt;h2&gt;Responsibilities&lt;/h2&gt;&lt;ul&gt;&lt;li&gt;Build AI interfaces&lt;/li&gt;&lt;/ul&gt;</description></item>`;
const rss = (content) =>
  `<?xml version="1.0"?><rss version="2.0"><channel>${content}</channel></rss>`;
const profile = {
  ...demoActions()[0].profile,
  platforms: ['we-work-remotely'],
  feeds: ['front-end-programming', 'full-stack-programming', 'product'].map((category) => ({
    type: 'we-work-remotely',
    category,
  })),
};
test('WWR category feeds retain attributed structured excerpts and unverified dates/eligibility, deduplicated across categories', async () => {
  assert.deepEqual(validateFeeds(profile.feeds), profile.feeds);
  const urls = [];
  const result = await collect(profile, {
    fetchText: async (url) => {
      urls.push(url);
      return rss(item());
    },
  });
  assert.deepEqual(
    urls,
    profile.feeds.map((f) => `https://weworkremotely.com/categories/remote-${f.category}-jobs.rss`),
  );
  assert.equal(result.jobs.length, 1);
  const j = result.jobs[0];
  assert.equal(j.company, 'Example & Co');
  assert.equal(j.title, 'Frontend Engineer');
  assert.match(j.description, /## Responsibilities/);
  assert.match(j.description, /-\s+Build AI interfaces/);
  assert.equal(j.descriptionKind, 'excerpt');
  assert.equal(j.sourceURL, j.url);
  assert.equal(j.posting.kind, 'unknown');
  assert.equal(j.availability.status, 'unknown');
  assert.ok(j.checks.every((c) => c.status === 'unknown'));
  assert.equal(result.run.coverage.length, 3);
  assert.ok(
    result.run.coverage.every((c) => c.screened === 1 && c.fullJd === 0 && /RSS/.test(c.note)),
  );
});
test('WWR caps rows, records failures, and rejects unsupported category or non-RSS payloads', async () => {
  assert.throws(() => validateFeeds([{ type: 'we-work-remotely', category: '../../private' }]));
  const one = { ...profile, feeds: [profile.feeds[0]] };
  let b = await collect(one, {
    fetchText: async () => rss(Array.from({ length: 110 }, (_, i) => item('role-' + i)).join('')),
  });
  assert.equal(b.jobs.length, 100);
  for (const text of [
    '<html>Login</html>',
    '<rss><channel><item>',
    '<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + rss(item()),
  ]) {
    b = await collect(one, { fetchText: async () => text });
    assert.equal(b.run.coverage[0].status, 'blocked');
    assert.equal(b.jobs.length, 0);
  }
  b = await collect(profile, {
    fetchText: async (url) => {
      if (url.includes('full-stack')) throw Error('offline');
      return rss(item());
    },
  });
  assert.equal(b.jobs.length, 1);
  assert.equal(b.run.coverage[1].status, 'blocked');
  b = await collect(one, { fetchText: async () => rss('') });
  assert.equal(b.run.coverage[0].status, 'empty');
});

test('changing source routing alone preserves assessment freshness and resume review; substantive preferences still invalidate', async () => {
  const { emptyState, transition, assessmentBinding, resumeStale } = await import(
    '../src/workbench.mjs'
  );
  const { draftAction } = await import('../src/resume.mjs');
  let s = demoActions().reduce(transition, emptyState());
  const job = s.jobs[0];
  s = transition(s, draftAction(s, job.id));
  const before = structuredClone(s);
  s = transition(s, {
    type: 'profile',
    profile: { ...s.profile, platforms: profile.platforms, feeds: profile.feeds },
  });
  assert.equal(s.jobs[0].assessment.stale, before.jobs[0].assessment.stale);
  assert.deepEqual(s.jobs[0].assessment.binding, assessmentBinding(s, s.jobs[0]));
  assert.equal(resumeStale(s, s.resumes[0]), false);
  assert.equal(s.resumes[0].reviewStatus, before.resumes[0].reviewStatus);
  assert.equal(s.resumes[0].content, before.resumes[0].content);
  assert.equal(s.jobs[0].assessment.checkedAt, before.jobs[0].assessment.checkedAt);
  assert.deepEqual(s.reviews, before.reviews);
  const old = structuredClone(before);
  old.jobs[0].assessment.stale = true;
  old.resumes[0].profileHash = '0'.repeat(64);
  const changed = transition(old, {
    type: 'profile',
    profile: { ...old.profile, platforms: profile.platforms, feeds: profile.feeds },
  });
  assert.equal(changed.jobs[0].assessment.stale, true);
  assert.equal(resumeStale(changed, changed.resumes[0]), true);
  s = transition(s, { type: 'profile', profile: { ...s.profile, location: 'Different Country' } });
  assert.equal(s.jobs[0].assessment.stale, true);
  assert.equal(resumeStale(s, s.resumes[0]), true);
});
