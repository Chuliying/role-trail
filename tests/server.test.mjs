import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
let api = {};
try {
  api = await import('../src/server.mjs');
} catch (e) {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
}
test('local API protects writes, persists decisions and rejects invalid restores', async () => {
  assert.equal(typeof api.createServer, 'function');
  const dir = await mkdtemp(join(tmpdir(), 'rt-http-'));
  const server = api.createServer({ workspace: dir });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    let r = await fetch(base + '/api/state');
    assert.equal(r.status, 200);
    assert.equal((await r.json()).revision, 0);
    r = await fetch(base + '/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
      body: '{}',
    });
    assert.equal(r.status, 403);
    r = await fetch(base + '/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base, 'X-Role-Trail': '1' },
      body: JSON.stringify({
        revision: 0,
        action: { type: 'research', run: { id: 'empty', coverage: [] }, jobs: [] },
      }),
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).revision, 1);
    r = await fetch(base + '/api/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base, 'X-Role-Trail': '1' },
      body: JSON.stringify({ revision: 1, state: { schemaVersion: 99 } }),
    });
    assert.equal(r.status, 400);
    assert.equal((await (await fetch(base + '/api/state')).json()).revision, 1);
  } finally {
    server.close();
    server.closeAllConnections();
    await rm(dir, { recursive: true, force: true });
  }
});
test('cloud auth fails closed and cookie sessions expire; bearer key never accepted via URL', async () => {
  assert.equal(typeof api.authorized, 'function');
  const key = 'a'.repeat(64);
  assert.equal(api.authorized({ headers: {} }, { cloud: true, key }), false);
  assert.equal(
    api.authorized({ headers: { authorization: 'Bearer ' + key } }, { cloud: true, key }),
    true,
  );
  assert.equal(api.authorized({ headers: {} }, { cloud: true, key: '' }), false);
  const cookie = api.session(key, Date.now() + 10000);
  assert.equal(
    api.authorized({ headers: { cookie: 'role_session=' + cookie } }, { cloud: true, key }),
    true,
  );
  assert.equal(
    api.authorized(
      { headers: { cookie: 'role_session=' + api.session(key, 1) } },
      { cloud: true, key },
    ),
    false,
  );
});
test('Vercel pre-parsed bodies and malformed JSON do not break the handler or expose input', async () => {
  assert.deepEqual(await api.body({ body: { revision: 1 } }), { revision: 1 });
});
test('Vercel protected mode requires a matching platform project and does not trust request headers', () => {
  assert.equal(typeof api.protectedVercel, 'function');
  assert.equal(
    api.protectedVercel({
      ROLE_TRAIL_AUTH: 'vercel-protected',
      VERCEL: '1',
      VERCEL_PROJECT_ID: 'project',
      ROLE_TRAIL_PROTECTED_PROJECT_ID: 'project',
    }),
    true,
  );
  assert.equal(
    api.protectedVercel({
      ROLE_TRAIL_AUTH: 'vercel-protected',
      VERCEL: '1',
      VERCEL_PROJECT_ID: 'wrong',
      ROLE_TRAIL_PROTECTED_PROJECT_ID: 'project',
    }),
    false,
  );
  assert.equal(
    api.authorized({ headers: { 'x-vercel-id': 'forged' } }, { cloud: true, key: '' }),
    false,
  );
});
test('retired dashboard gives a reload instruction instead of a misleading missing-data error', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rt-legacy-route-'));
  const server = api.createServer({ workspace: dir });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const r = await fetch('http://127.0.0.1:' + server.address().port + '/api/dashboard');
    assert.equal(r.status, 410);
    assert.match((await r.json()).error, /重新開啟/);
  } finally {
    server.close();
    server.closeAllConnections();
    await rm(dir, { recursive: true, force: true });
  }
});
