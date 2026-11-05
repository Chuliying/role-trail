import pg from 'pg';
import { emptyState, validateState, transition, now } from './workbench.mjs';
export class PostgresStore {
  constructor(url) {
    if (!url) throw Error('DATABASE_URL required');
    this.pool = new pg.Pool({ connectionString: url, max: 3, connectionTimeoutMillis: 10000 });
  }
  async migrate() {
    await this.pool.query(
      'CREATE TABLE IF NOT EXISTS role_trail_state (id integer PRIMARY KEY CHECK (id=1), revision integer NOT NULL, state jsonb NOT NULL)',
    );
    await this.pool.query(
      'INSERT INTO role_trail_state VALUES (1,0,$1) ON CONFLICT (id) DO NOTHING',
      [emptyState()],
    );
  }
  async read() {
    const r = await this.pool.query('SELECT state FROM role_trail_state WHERE id=1');
    if (!r.rows.length) throw Error('Run db-migrate first');
    return validateState(r.rows[0].state);
  }
  async update(revision, action) {
    return this.mutate(revision, (s) => transition(s, action));
  }
  async restore(revision, backup) {
    validateState(backup);
    return this.mutate(revision, (s) => ({
      ...structuredClone(backup),
      revision: s.revision + 1,
      updatedAt: now(),
    }));
  }
  async mutate(revision, fn) {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const r = await c.query('SELECT state FROM role_trail_state WHERE id=1 FOR UPDATE');
      if (!r.rows.length) throw Error('Run db-migrate first');
      const s = validateState(r.rows[0].state);
      if (s.revision !== revision) throw Error('Revision conflict');
      const next = validateState(fn(s));
      if (Buffer.byteLength(JSON.stringify(next)) > 3_500_000)
        throw Error(
          'Cloud workspace exceeds 3.5 MB; export and use local storage or a new workspace. Previous state was preserved.',
        );
      await c.query('UPDATE role_trail_state SET revision=$1,state=$2 WHERE id=1', [
        next.revision,
        next,
      ]);
      await c.query('COMMIT');
      return next;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
  async close() {
    await this.pool.end();
  }
}
