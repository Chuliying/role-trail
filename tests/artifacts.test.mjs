import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStore } from '../src/workbench.mjs';
import { demoActions } from '../src/demo.mjs';
import { draftAction } from '../src/resume.mjs';

test('PDF bytes and complete research bundles survive reload without approving or applying', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rt-artifacts-'));
  try {
    const store = new LocalStore(dir);
    let s = await store.read();
    for (const action of demoActions()) s = await store.update(s.revision, action);
    const j = s.jobs[0];
    s = await store.update(s.revision, draftAction(s, j.id));
    assert.equal(typeof store.savePDF, 'function', 'shared runtime must persist original PDFs');
    const pdf = Buffer.from('%PDF-1.4\n' + 'synthetic PDF fixture '.repeat(20));
    s = await store.savePDF(
      s.revision,
      { jobId: j.id, version: 1, filename: 'synthetic.pdf' },
      pdf,
    );
    const fresh = new LocalStore(dir),
      r = (await fresh.read()).resumes[0];
    assert.deepEqual(await fresh.getArtifact(r.pdfHash), pdf);
    assert.equal(r.reviewStatus, 'pending');
    assert.equal(s.submissions.length, 0);
    await assert.rejects(
      store.savePDF(s.revision - 1, { jobId: j.id, version: 1, filename: 'synthetic.pdf' }, pdf),
      /conflict/i,
    );
    await assert.rejects(
      store.savePDF(
        s.revision,
        { jobId: j.id, version: 1, filename: 'synthetic.pdf' },
        Buffer.from('%PDF-1.4\n' + 'changed '.repeat(30)),
      ),
      /immutable/i,
    );
    const bundle = {
      run: { id: 'archive-example', kind: 'daily', coverage: [], note: 'Full source payload' },
      jobs: [j].map(({ assessment, ...job }) => job),
    };
    s = await store.update(s.revision, { type: 'research', ...bundle });
    const run = s.runs.at(-1);
    assert.ok(run.archiveHash);
    assert.deepEqual(JSON.parse((await fresh.getArtifact(run.archiveHash)).toString()), bundle);
    const again = await fresh.update(s.revision, { type: 'research', ...bundle });
    assert.equal(again.revision, s.revision);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('authenticated PDF route returns original bytes and never exposes them before login', async () => {
  const { createServer } = await import('../src/server.mjs');
  const { once } = await import('node:events');
  const dir = await mkdtemp(join(tmpdir(), 'rt-artifact-api-'));
  const store = new LocalStore(dir);
  let s = await store.read();
  for (const a of demoActions()) s = await store.update(s.revision, a);
  s = await store.update(s.revision, draftAction(s, s.jobs[0].id));
  const key = 'b'.repeat(64),
    server = createServer({ store, cloud: true, key, origin: 'https://example.test' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const input = { jobId: s.jobs[0].id, version: 1, filename: 'fixture.pdf' },
      pdf = Buffer.from('%PDF-1.4\n' + 'fixture '.repeat(30));
    let r = await fetch(base + '/api/pdf', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify({ revision: s.revision, input, pdf: pdf.toString('base64') }),
    });
    assert.equal(r.status, 200);
    const path = '/api/resume?job=' + input.jobId + '&version=1&format=pdf';
    assert.equal((await fetch(base + path)).status, 401);
    r = await fetch(base + path, { headers: { authorization: 'Bearer ' + key } });
    assert.equal(r.headers.get('content-type'), 'application/pdf');
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), pdf);
  } finally {
    server.close();
    server.closeAllConnections();
    await rm(dir, { recursive: true, force: true });
  }
});
