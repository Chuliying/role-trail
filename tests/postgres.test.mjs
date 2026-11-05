import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { demoActions } from '../src/demo.mjs';
import { draftAction } from '../src/resume.mjs';
import { hash, jdHash, preparationStale } from '../src/workbench.mjs';
import { PostgresStore } from '../src/postgres.mjs';
const available = (() => {
  try {
    execFileSync('initdb', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
test(
  'real PostgreSQL: transaction rollback, cross-client conflict, persistence and restore',
  { skip: !available && !process.env.ROLE_TRAIL_TEST_DATABASE_URL },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rt-postgres-'));
    let store,
      second,
      started = false;
    try {
      let url = process.env.ROLE_TRAIL_TEST_DATABASE_URL;
      if (!url) {
        const portServer = createServer();
        portServer.listen(0, '127.0.0.1');
        await once(portServer, 'listening');
        const port = portServer.address().port;
        await new Promise((r) => portServer.close(r));
        execFileSync(
          'initdb',
          ['-D', join(dir, 'db'), '--auth=trust', '--no-locale', '-U', 'roletrail'],
          { stdio: 'ignore' },
        );
        execFileSync(
          'pg_ctl',
          [
            '-D',
            join(dir, 'db'),
            '-l',
            join(dir, 'postgres.log'),
            '-o',
            `-h 127.0.0.1 -p ${port} -k ${dir}`,
            '-w',
            'start',
          ],
          { stdio: 'ignore' },
        );
        started = true;
        url = `postgresql://roletrail@127.0.0.1:${port}/postgres`;
      }
      store = new PostgresStore(url);
      second = new PostgresStore(url);
      await store.migrate();
      let s = await store.read();
      assert.equal(s.revision, 0);
      const run = (id) => ({ type: 'research', run: { id, coverage: [] }, jobs: [] });
      const results = await Promise.allSettled([
        store.update(0, run('a')),
        second.update(0, run('b')),
      ]);
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      s = await store.read();
      assert.equal(s.revision, 1);
      await assert.rejects(store.update(1, { type: 'invalid' }));
      assert.equal((await second.read()).revision, 1);
      await store.restore(1, { ...s, runs: [] });
      assert.equal((await second.read()).revision, 2);
      assert.equal((await second.read()).runs.length, 0);
      for (const action of demoActions()) {
        const latest = await store.read();
        await store.update(latest.revision, action);
      }
      s = await second.read();
      const jobId = s.jobs[0].id;
      assert.equal(s.jobs[0].assessment.stale, false);
      s = await store.update(s.revision, draftAction(s, jobId));
      s = await second.read();
      s = await store.update(s.revision, {
        type: 'resumeReview',
        jobId,
        version: 1,
        status: 'approved',
      });
      s = await second.read();
      assert.equal(draftAction(s, jobId), null);
      assert.equal(s.resumes[0].reviewStatus, 'approved');
      s = await store.update(s.revision, {
        type: 'preparation',
        jobId,
        jdHash: jdHash(s.jobs[0]),
        resumeVersion: 1,
        resumeContentHash: hash(s.resumes[0].content),
        capabilityIds: ['demo-ui'],
        content: '## Practice\nExplain the synthetic accessible interface example.',
      });
      s = await second.read();
      assert.equal(s.preparations.length, 1);
      assert.equal(preparationStale(s, s.preparations[0]), false);
      assert.equal(s.preparations[0].evidence[0].id, 'demo-ui');
      assert.equal(s.resumes[0].reviewStatus, 'approved');

      // Exercise cutover in this disposable PostgreSQL instance only.
      const { convertLegacy } = await import('../src/legacy-migration.mjs');
      const { legacyFixture } = await import('./fixtures/legacy.mjs');
      let migration = {};
      try {
        migration = await import('../src/legacy-postgres.mjs');
      } catch (e) {
        if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
      }
      assert.equal(typeof migration.installLegacy, 'function', 'transactional cutover is required');
      const { installLegacy } = migration;
      const snapshot = legacyFixture(),
        converted = convertLegacy(snapshot, {});
      await store.pool.query('DELETE FROM role_trail_state');
      await store.migrate();
      await store.pool.query(
        'CREATE TABLE job_board_state(id integer primary key,revision integer)',
      );
      await store.pool.query('INSERT INTO job_board_state VALUES(1,13)');
      await assert.rejects(installLegacy(store, converted), /Legacy revision conflict/);
      assert.equal((await store.read()).jobs.length, 0);
      await store.pool.query('UPDATE job_board_state SET revision=12');
      await installLegacy(store, converted);
      const migrated = await second.read();
      assert.equal(migrated.jobs.length, 2);
      assert.equal(migrated.resumes[0].reviewStatus, 'approved');
      assert.deepEqual(
        await second.getArtifact(migrated.resumes[0].pdfHash),
        converted.artifacts.find((a) => a.hash === migrated.resumes[0].pdfHash).bytes,
      );
      await assert.rejects(
        store.pool.query('UPDATE job_board_state SET revision=99'),
        /moved to Role Trail/,
      );
      await assert.rejects(installLegacy(store, converted), /Destination is not empty/);
    } finally {
      await store?.close();
      await second?.close();
      if (started)
        execFileSync('pg_ctl', ['-D', join(dir, 'db'), '-m', 'fast', '-w', 'stop'], {
          stdio: 'ignore',
        });
      await rm(dir, { recursive: true, force: true });
    }
  },
);
