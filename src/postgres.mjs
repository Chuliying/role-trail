import { artifactHash, artifactId, attachPDF, researchArtifact } from './artifacts.mjs';
import pg from 'pg';
import { emptyState, validateState, transition, now } from './workbench.mjs';
export class PostgresStore {
  constructor(url) {
    if (!url) throw Error('DATABASE_URL required');
    this.pool = new pg.Pool({
      connectionString: url,
      max: 3,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: true,
    });
  }
  async migrate() {
    await this.pool.query(
      'CREATE TABLE IF NOT EXISTS role_trail_artifacts (hash text PRIMARY KEY, bytes bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now())',
    );
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
    return this.mutate(revision, async (s, c) => {
      const next = transition(s, action),
        bytes = researchArtifact(action);
      if (bytes && next !== s) {
        const id = await this.putArtifact(bytes, c);
        next.runs.find((r) => r.id === action.run.id).archiveHash = id;
      }
      return next;
    });
  }
  async putArtifact(bytes, client = this.pool) {
    const id = artifactHash(bytes);
    await client.query(
      'INSERT INTO role_trail_artifacts(hash,bytes) VALUES($1,$2) ON CONFLICT(hash) DO NOTHING',
      [id, bytes],
    );
    return id;
  }
  async getArtifact(id) {
    const r = await this.pool.query('SELECT bytes FROM role_trail_artifacts WHERE hash=$1', [
      artifactId(id),
    ]);
    if (!r.rows.length) throw Error('Artifact not found');
    return r.rows[0].bytes;
  }
  async savePDF(revision, input, pdf) {
    return this.mutate(revision, async (s, c) => {
      const next = attachPDF(s, input, pdf);
      await this.putArtifact(pdf, c);
      return next;
    });
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
      const next = validateState(await fn(s, c));
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
