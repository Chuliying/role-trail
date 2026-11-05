import test from 'node:test';
import assert from 'node:assert/strict';
import { hash } from '../src/workbench.mjs';
import { artifactHash } from '../src/artifacts.mjs';
let migration = {};
try {
  migration = await import('../src/legacy-migration.mjs');
} catch (e) {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
}
import { legacyFixture } from './fixtures/legacy.mjs';
test('legacy conversion preserves IDs, shared tasks, decisions, submission and every PDF version without inventing verification', () => {
  assert.equal(typeof migration.convertLegacy, 'function', 'one-time converter required');
  const input = legacyFixture(),
    out = migration.convertLegacy(input, { profile: null });
  const a = out.state.jobs[0],
    b = out.state.jobs[1];
  assert.equal(out.state.jobs.length, 2);
  assert.equal(out.state.reviews[a.id].status, 'shortlisted');
  assert.equal(out.state.reviews[b.id].status, 'passed');
  assert.equal(out.state.submissions[0].jobId, b.id);
  assert.equal(out.state.tasks.length, 1);
  assert.deepEqual(out.state.tasks[0].jobIds, [a.id, b.id]);
  assert.equal(out.state.tasks[0].status, 'in_progress');
  assert.equal(out.state.tasks[0].done, false);
  assert.equal(out.state.resumes[0].reviewStatus, 'approved');
  assert.ok(out.artifacts.some((x) => x.hash === input.tables.job_board_resumes[0].pdf_hash));
  assert.equal(a.availability.checkedAt, null);
  assert.equal(a.assessment.stale, true);
  assert.equal(out.report.unmappedReferences.length, 0);
  const duplicate = legacyFixture();
  duplicate.tables.job_board_state[0].board.jobs[1].url =
    duplicate.tables.job_board_state[0].board.jobs[0].url;
  assert.throws(() => migration.convertLegacy(duplicate, { profile: null }), /collision/i);
  const corrupt = legacyFixture();
  corrupt.tables.job_board_resumes[0].pdf_hash = 'f'.repeat(64);
  assert.throws(() => migration.convertLegacy(corrupt, { profile: null }), /PDF hash/i);
});
test('factual exclusion does not become a personal Passed decision', () => {
  const snapshot = legacyFixture();
  snapshot.tables.job_board_reviews = [];
  snapshot.tables.job_board_state[0].tracker.jobs = [];
  snapshot.tables.job_board_state[0].tracker.prep_tasks = [];
  snapshot.tables.job_board_state[0].board.jobs[0].availability = {
    status: 'closed',
    source: 'https://example.test/a',
    evidence: 'Closed',
    checkedAt: '2026-11-01',
  };
  const result = migration.convertLegacy(snapshot, {}),
    id = result.state.migration.idMap.a;
  assert.equal(result.state.reviews[id].status, 'review');
  assert.equal(result.state.jobs.find((j) => j.id === id).availability.status, 'closed');
});
test('portable backup includes every migration artifact, not only visible PDFs and runs', async () => {
  const { mkdtemp, mkdir, writeFile, readdir, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { run } = await import('../src/commands.mjs');
  const root = await mkdtemp(join(tmpdir(), 'role-legacy-backup-'));
  try {
    const converted = migration.convertLegacy(legacyFixture(), {}),
      dir = join(root, 'source');
    await mkdir(join(dir, 'artifacts'), { recursive: true });
    await writeFile(join(dir, 'workspace.json'), JSON.stringify(converted.state));
    for (const a of converted.artifacts) await writeFile(join(dir, 'artifacts', a.hash), a.bytes);
    await run('backup', ['--workspace', dir, '--output', join(root, 'backup')]);
    assert.deepEqual(
      (await readdir(join(root, 'backup/artifacts'))).sort(),
      converted.artifacts.map((a) => a.hash).sort(),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
