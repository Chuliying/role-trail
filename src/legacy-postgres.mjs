import { validateState } from './workbench.mjs';
import { artifactHash } from './artifacts.mjs';
export const legacyTables = [
  'job_board_state',
  'job_board_runs',
  'job_board_reviews',
  'job_board_resumes',
  'job_board_submissions',
  'job_board_evidence',
  'job_board_preparation',
];
export async function exportLegacy(pool) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    const tables = {};
    for (const table of legacyTables)
      tables[table] = (await c.query('SELECT * FROM ' + table)).rows;
    await c.query('COMMIT');
    return JSON.parse(
      JSON.stringify({
        format: 'job-board-postgres-v1',
        exportedAt: new Date().toISOString(),
        tables,
      }),
    );
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
export async function installLegacy(store, converted) {
  const { state, artifacts } = converted;
  validateState(state);
  if (!Number.isSafeInteger(state.migration?.sourceRevision))
    throw Error('Missing source revision');
  for (const a of artifacts)
    if (artifactHash(a.bytes) !== a.hash) throw Error('Artifact hash mismatch');
  if (Buffer.byteLength(JSON.stringify(state)) > 3_500_000)
    throw Error('Converted state exceeds cloud size limit');
  const c = await store.pool.connect();
  try {
    await c.query('BEGIN');
    const target = (await c.query('SELECT state FROM role_trail_state WHERE id=1 FOR UPDATE'))
      .rows[0]?.state;
    if (
      !target ||
      target.revision !== 0 ||
      target.jobs.length ||
      target.profile ||
      target.runs.length
    )
      throw Error('Destination is not empty');
    const source = (await c.query('SELECT revision FROM job_board_state WHERE id=1 FOR UPDATE'))
      .rows[0];
    if (source?.revision !== state.migration.sourceRevision)
      throw Error('Legacy revision conflict; export and convert again');
    for (const a of artifacts) await store.putArtifact(a.bytes, c);
    const saved = { ...state, revision: 1 };
    await c.query('UPDATE role_trail_state SET state=$1,revision=1 WHERE id=1', [saved]);
    // Keep old data intact, but prevent a second writer from creating divergent truth.
    await c.query(
      `CREATE OR REPLACE FUNCTION role_trail_legacy_read_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Workspace moved to Role Trail; use the canonical runtime'; END $$`,
    );
    for (const table of legacyTables) {
      const exists = (await c.query('SELECT to_regclass($1) AS name', [table])).rows[0].name;
      if (exists)
        await c.query(
          'CREATE TRIGGER role_trail_moved BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON ' +
            table +
            ' FOR EACH STATEMENT EXECUTE FUNCTION role_trail_legacy_read_only()',
        );
    }
    await c.query('COMMIT');
    return { revision: 1, ...converted.report };
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
