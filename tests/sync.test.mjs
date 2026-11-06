import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from '../src/server.mjs';
import { emptyState, transition, hash } from '../src/workbench.mjs';
import { demoActions } from '../src/demo.mjs';

async function fixture(fn) {
  let s = demoActions().reduce(transition, emptyState());
  const template = s.jobs[0];
  s.jobs = Array.from({ length: 150 }, (_, i) => ({
    ...template,
    url: 'https://example.com/large/' + i,
    id: hash('https://example.com/large/' + i).slice(0, 24),
    assessment: null,
    description: 'Large synthetic JD '.repeat(400),
  }));
  const store = {
    read: async () => structuredClone(s),
    update: async (revision, action) => {
      s = transition(s, action);
      return structuredClone(s);
    },
  };
  const server = createServer({ store });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await fn('http://127.0.0.1:' + server.address().port, s);
  } finally {
    server.close();
    server.closeAllConnections();
  }
}
test('conditional state GET sends no workspace body when revision is unchanged', async () => {
  await fixture(async (base) => {
    const first = await fetch(base + '/api/state');
    const tag = first.headers.get('etag');
    assert.ok(tag, 'state needs a private revision ETag');
    const second = await fetch(base + '/api/state', { headers: { 'If-None-Match': tag } });
    assert.equal(second.status, 304);
    assert.equal(await second.text(), '');
    assert.equal(second.headers.get('cache-control'), 'no-store');
  });
});
test('opt-in write delta stays small and legacy full responses still work', async () => {
  await fixture(async (base, s) => {
    const fullBytes = Buffer.byteLength(JSON.stringify(s));
    const send = (revision, status, delta = true) =>
      fetch(base + '/api/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Role-Trail': '1',
          ...(delta ? { 'X-Role-Trail-Response': 'delta' } : {}),
        },
        body: JSON.stringify({ revision, action: { type: 'review', jobId: s.jobs[0].id, status } }),
      });
    const r = await send(s.revision, 'shortlisted');
    const raw = await r.text(),
      delta = JSON.parse(raw);
    assert.equal(r.status, 200, raw);
    assert.equal(delta.kind, 'workspace-delta');
    assert.equal(delta.baseRevision, s.revision);
    assert.equal(delta.revision, s.revision + 1);
    assert.equal(delta.changes.jobs, undefined);
    assert.ok(Buffer.byteLength(raw) < fullBytes / 20);
    const full = await (await send(delta.revision, 'review', false)).json();
    assert.equal(full.jobs.length, 150);
    assert.equal(full.reviews[s.jobs[0].id].status, 'review');
    console.log(
      JSON.stringify({
        benchmark: '150 synthetic jobs',
        fullBytes,
        reviewDeltaBytes: Buffer.byteLength(raw),
      }),
    );
  });
});

test('entity deltas reconstruct updates, removals, ordering and optional collections without mutating the base', async () => {
  const { workspaceDelta, mergeWorkspaceDelta } = await import('../web/sync.mjs');
  const before = {
    ...emptyState(),
    revision: 5,
    jobs: [
      { id: 'a', description: 'keep' },
      { id: 'b', description: 'old' },
    ],
    submissions: [{ jobId: 'a', source: 'manual' }],
    resumes: [{ jobId: 'a', version: 1, content: 'one' }],
    reviews: { a: { status: 'review' }, b: { status: 'passed' } },
  };
  const saved = structuredClone(before);
  const after = {
    ...before,
    revision: 6,
    jobs: [
      { id: 'b', description: 'new' },
      { id: 'c', description: 'added' },
    ],
    submissions: [{ jobId: 'b', source: 'manual' }],
    resumes: [
      { jobId: 'a', version: 1, content: 'one' },
      { jobId: 'a', version: 2, content: 'two' },
    ],
    reviews: { b: { status: 'shortlisted' } },
    resumeRequests: [{ id: 'request', jobId: 'b' }],
  };
  const delta = workspaceDelta(before, after);
  assert.deepEqual(mergeWorkspaceDelta(before, delta), after);
  assert.deepEqual(before, saved);
  assert.equal(delta.changes.resumes.upsert.length, 1);
  assert.throws(() => mergeWorkspaceDelta({ ...before, revision: 4 }, delta), /base mismatch/);
  const removed = { ...after, revision: 7 };
  delete removed.resumeRequests;
  assert.deepEqual(mergeWorkspaceDelta(after, workspaceDelta(after, removed)), removed);
});
test('transport recovers a mismatched delta with one read and never repeats a write', async () => {
  const { createTransport } = await import('../web/transport.mjs');
  const base = { ...emptyState(), revision: 1 },
    fresh = { ...base, revision: 3 };
  const calls = [];
  const api = createTransport({
    getState: () => base,
    onUnauthorized: () => {},
    fetcher: async (url, options) => {
      calls.push([url, options.method]);
      return new Response(
        JSON.stringify(
          options.method === 'POST'
            ? { kind: 'workspace-delta', version: 1, baseRevision: 2, revision: 3, changes: {} }
            : fresh,
        ),
        { headers: { 'content-type': 'application/json' } },
      );
    },
  });
  assert.deepEqual(await api('action', { revision: 1 }), fresh);
  assert.deepEqual(calls, [
    ['/api/action', 'POST'],
    ['/api/state', 'GET'],
  ]);
});
test('full export and unauthorized reads remain protected independently of conditional headers', async () => {
  const server = createServer({
    store: { read: async () => emptyState() },
    cloud: true,
    key: 'a'.repeat(64),
    origin: 'https://example.com',
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const r = await fetch('http://127.0.0.1:' + server.address().port + '/api/state', {
      headers: { 'If-None-Match': '*' },
    });
    assert.equal(r.status, 401);
  } finally {
    server.close();
    server.closeAllConnections();
  }
});
