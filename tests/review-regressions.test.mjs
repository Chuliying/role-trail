import test from 'node:test';
import assert from 'node:assert/strict';
import * as w from '../src/workbench.mjs';
import { demoActions } from '../src/demo.mjs';
import { draftAction } from '../src/resume.mjs';
const demo = () => demoActions().reduce(w.transition, w.emptyState());
const research = (j, id) => ({ type: 'research', run: { id, coverage: [] }, jobs: [j] });

test('changed JD invalidates a score but preserves its historical rationale and personal decision', () => {
  let s = demo();
  const { assessment, ...j } = s.jobs[0];
  s = w.transition(s, { type: 'review', jobId: j.id, status: 'shortlisted' });
  s = w.transition(s, research({ ...j, description: 'Embedded firmware in C.' }, 'changed'));
  assert.equal(s.jobs[0].assessment.stale, true);
  assert.equal(s.jobs[0].assessment.reason, assessment.reason);
  assert.equal(s.reviews[j.id].status, 'shortlisted');
});

test('profile and capability changes invalidate fit; unchanged observations keep it current', () => {
  const s = demo();
  const { assessment, ...j } = s.jobs[0];
  assert.equal(w.transition(s, research(j, 'same')).jobs[0].assessment.stale, false);
  assert.equal(
    w.transition(s, { type: 'profile', profile: { ...s.profile, targetRoles: ['Embedded'] } })
      .jobs[0].assessment.stale,
    true,
  );
  const { updatedAt, ...c } = s.capabilities[0];
  assert.equal(
    w.transition(s, { type: 'capability', ...c, status: 'rejected' }).jobs[0].assessment.stale,
    true,
  );
});

test('verified eligibility requires recent positive evidence; expired negatives stay archived', () => {
  const j = demo().jobs[0];
  const day = 86400000,
    at = Date.now(),
    stamp = (age) => new Date(at - age * day).toISOString();
  j.availability = { status: 'open', source: j.url, evidence: 'Open', checkedAt: stamp(0) };
  j.checks = [
    {
      key: 'remote',
      label: 'Remote',
      status: 'confirmed',
      source: j.url,
      evidence: 'Worldwide',
      checkedAt: stamp(0),
    },
  ];
  assert.equal(w.jobStatus(j), 'verified');
  j.availability.checkedAt = stamp(8);
  assert.equal(w.jobStatus(j), 'needs_review');
  j.availability.checkedAt = stamp(0);
  j.checks[0].checkedAt = stamp(31);
  assert.equal(w.jobStatus(j), 'needs_review');
  j.checks[0].checkedAt = stamp(-1);
  assert.equal(w.jobStatus(j), 'needs_review');
  j.checks[0].status = 'excluded';
  j.checks[0].checkedAt = stamp(400);
  assert.equal(w.jobStatus(j), 'archived');
});

test('Applied records survive Passed, archive, research, export validation and legacy updates', () => {
  let s = demo(),
    id = s.jobs[0].id;
  s = w.transition(s, { type: 'review', jobId: id, status: 'applied' });
  assert.equal(s.submissions?.length, 1);
  const record = structuredClone(s.submissions[0]);
  for (const status of ['passed', 'shortlisted', 'applied'])
    s = w.transition(s, { type: 'review', jobId: id, status });
  s = w.transition(s, { type: 'archive', jobId: id, archived: true });
  s = w.transition(s, { type: 'research', run: { id: 'empty', coverage: [] }, jobs: [] });
  assert.deepEqual(w.validateState(JSON.parse(JSON.stringify(s))).submissions, [record]);
  delete s.submissions;
  s = w.transition(s, { type: 'review', jobId: id, status: 'passed' });
  assert.equal(s.submissions[0].source, 'legacy');
  assert.throws(() => w.validateState({ ...s, submissions: [{ ...record, jobId: 'absent' }] }));
});

test('draft generation skips current pending or approved versions; revisions and stale sources regenerate', () => {
  let s = demo(),
    id = s.jobs[0].id;
  s = w.transition(s, draftAction(s, id));
  assert.equal(draftAction(s, id), null);
  s = w.transition(s, { type: 'resumeReview', jobId: id, version: 1, status: 'approved' });
  assert.equal(draftAction(s, id), null);
  s = w.transition(s, { type: 'resumeReview', jobId: id, version: 1, status: 'changes_requested' });
  s = w.transition(s, draftAction(s, id));
  assert.equal(s.resumes.at(-1).version, 2);
  s = w.transition(s, { type: 'profile', profile: { ...s.profile, name: 'Updated Synthetic' } });
  assert.equal(draftAction(s, id).type, 'resume');
});

test('same research payload retries are idempotent; run ID reuse with different content rejects', () => {
  const original = demoActions().find((a) => a.type === 'research');
  let s = w.transition(w.emptyState(), original);
  s = w.transition(s, { type: 'review', jobId: s.jobs[0].id, status: 'shortlisted' });
  const retried = w.transition(s, structuredClone(original));
  assert.deepEqual(retried, s);
  const different = structuredClone(original);
  different.jobs[0].description += ' Changed';
  assert.throws(() => w.transition(s, different), /run ID/i);
  const reordered = {
    jobs: original.jobs.map((j) => Object.fromEntries(Object.entries(j).reverse())),
    run: original.run,
    type: 'research',
  };
  assert.deepEqual(w.transition(s, reordered), s);
});

test('a late assessment cannot revive a score based on superseded input', () => {
  const actions = demoActions();
  const pending = actions.at(-1);
  let s = actions.reduce(w.transition, w.emptyState());
  const { assessment, ...j } = s.jobs[0];
  s = w.transition(s, research({ ...j, description: 'Embedded firmware' }, 'late-jd'));
  assert.throws(() => w.transition(s, pending), /binding|stale/i);
  s = actions.reduce(w.transition, w.emptyState());
  s = w.transition(s, { type: 'profile', profile: { ...s.profile, targetRoles: ['Embedded'] } });
  assert.throws(() => w.transition(s, pending), /binding|stale/i);
  s = actions.reduce(w.transition, w.emptyState());
  const { updatedAt, ...claim } = s.capabilities[0];
  s = w.transition(s, { type: 'capability', ...claim, status: 'rejected' });
  assert.throws(() => w.transition(s, pending), /binding|stale/i);
});

test('JSON object key ordering does not invalidate assessment or resume bindings', () => {
  let s = demo();
  const id = s.jobs[0].id;
  s = w.transition(s, draftAction(s, id));
  const reordered = (x) =>
    Array.isArray(x)
      ? x.map(reordered)
      : x && typeof x === 'object'
        ? Object.fromEntries(
            Object.entries(x)
              .reverse()
              .map(([k, v]) => [k, reordered(v)]),
          )
        : x;
  const roundtrip = reordered(s);
  assert.deepEqual(
    w.assessmentBinding(s, s.jobs[0]),
    w.assessmentBinding(roundtrip, roundtrip.jobs[0]),
  );
  assert.equal(w.validateState(roundtrip).jobs[0].assessment.stale, false);
  assert.equal(w.resumeStale(roundtrip, roundtrip.resumes[0]), false);
  assert.equal(draftAction(roundtrip, id), null);
});
