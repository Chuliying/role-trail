import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { emptyState, transition, hash, jdHash } from '../src/workbench.mjs';
import { demoActions } from '../src/demo.mjs';
import { draftAction } from '../src/resume.mjs';
let workflow = {};
try {
  workflow = await import('../src/agent-workflow.mjs');
} catch (e) {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
}
const initial = () => {
  let s = demoActions().reduce(transition, emptyState());
  const jobId = s.jobs[0].id;
  s = transition(s, { type: 'review', jobId, status: 'shortlisted' });
  return s;
};
const prep = (s) => ({
  type: 'preparation',
  jobId: s.jobs[0].id,
  jdHash: jdHash(s.jobs[0]),
  resumeVersion: s.resumes[0].version,
  resumeContentHash: hash(s.resumes[0].content),
  capabilityIds: ['demo-ui'],
  content:
    '## Interview practice\nPossible concern: production scale.\nUse the accessible component example.\n## Questions for the employer\nWhich users need keyboard access?',
});

test('preparation is persisted with an exact resume and confirmed evidence, independent of decisions', () => {
  let s = initial();
  s = transition(s, draftAction(s, s.jobs[0].id));
  s = transition(s, prep(s));
  assert.equal(s.preparations.length, 1);
  assert.equal(s.preparations[0].evidence[0].id, 'demo-ui');
  assert.equal(s.reviews[s.jobs[0].id].status, 'shortlisted');
  assert.equal(s.resumes[0].reviewStatus, 'pending');
  assert.throws(
    () => transition(s, { ...prep(s), resumeContentHash: '0'.repeat(64) }),
    /binding|stale/i,
  );
  assert.throws(
    () => transition(s, { ...prep(s), capabilityIds: ['unknown'] }),
    /capability|evidence/i,
  );
  const kept = structuredClone(s.preparations);
  s = transition(s, { type: 'research', run: { id: 'after-preparation', coverage: [] }, jobs: [] });
  assert.deepEqual(s.preparations, kept);
});

test('a scheduled work packet uses current preferences and reports missing deliverables', () => {
  assert.equal(typeof workflow.workPacket, 'function');
  let s = initial();
  s.profile.platforms = ['official', 'himalayas'];
  const packet = workflow.workPacket(s, 'daily');
  assert.deepEqual(packet.sources, ['official', 'himalayas']);
  assert.equal(packet.mode, 'daily');
  assert.equal(packet.shortlisted.length, 1);
  assert.equal(packet.shortlisted[0].needsResume, true);
  assert.equal(packet.shortlisted[0].needsPreparation, true);
  const result = workflow.checkWork(s, packet, 'missing');
  assert.equal(result.readyForReview, false);
  assert.ok(result.issues.some((x) => x.code === 'run_missing'));
});

test('completion distinguishes partial research from missing writes and preserves personal state', () => {
  let s = initial();
  const packet = workflow.workPacket(s, 'daily');
  s = transition(s, {
    type: 'research',
    run: {
      id: 'daily-fixture',
      kind: 'daily',
      coverage: [
        {
          source: 'manual',
          status: 'blocked',
          query: 'Fixture',
          screened: 0,
          fullJd: 0,
          note: 'Fixture access unavailable',
        },
      ],
    },
    jobs: [],
  });
  s = transition(s, draftAction(s, s.jobs[0].id));
  s = transition(s, prep(s));
  const complete = workflow.checkWork(s, packet, 'daily-fixture');
  assert.equal(complete.readyForReview, true);
  assert.equal(complete.allSourcesSearched, false);
  assert.equal(complete.sourceLimitations.length, 1);
  const changed = transition(s, { type: 'review', jobId: s.jobs[0].id, status: 'applied' });
  assert.ok(
    workflow
      .checkWork(changed, packet, 'daily-fixture')
      .issues.some((x) => x.code === 'personal_state_changed'),
  );
  const outdated = transition(s, {
    type: 'profile',
    profile: { ...s.profile, targetRoles: ['Analyst'] },
  });
  assert.equal(workflow.checkWork(outdated, packet, 'daily-fixture').readyForReview, false);
});

test('workflow CLI reads persisted state and writes a private packet without activating a schedule', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rt-agent-'));
  const cli = new URL('../bin/role-trail.mjs', import.meta.url).pathname;
  const run = (args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  try {
    assert.equal(run(['demo', '--workspace', join(dir, 'workspace')]).status, 0);
    const out = join(dir, 'packet.json');
    const r = run([
      'workflow',
      '--workspace',
      join(dir, 'workspace'),
      '--mode',
      'daily',
      '--output',
      out,
    ]);
    assert.equal(r.status, 0, r.stderr);
    const packet = JSON.parse(await readFile(out, 'utf8'));
    assert.equal(packet.mode, 'daily');
    const state = JSON.parse(run(['state', '--workspace', join(dir, 'workspace')]).stdout);
    assert.equal(state.schedule, null);
    assert.notEqual(
      run([
        'workflow',
        '--workspace',
        join(dir, 'workspace'),
        '--mode',
        'daily',
        '--output',
        new URL('../data/leak.json', import.meta.url).pathname,
      ]).status,
      0,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('personal search notes and required criteria survive setup and shared profile updates', async () => {
  const { validateProfile } = await import('../src/onboarding.mjs');
  const profile = {
    ...initial().profile,
    searchNotes: 'Prefer developer tools; no relocation. Salary discussed case by case.',
    requiredChecks: [{ key: 'product-work', label: 'Builds the requested product type' }],
  };
  const saved = validateProfile(profile);
  assert.equal(saved.searchNotes, profile.searchNotes);
  assert.deepEqual(saved.requiredChecks, profile.requiredChecks);
  const s = transition(initial(), { type: 'profile', profile: saved });
  assert.equal(workflow.workPacket(s).profile.searchNotes, profile.searchNotes);
});
