import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.mjs';
import { LocalStore } from '../src/workbench.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
test('cloud-mode HTTP auth, signed session, origin rejection and owner writes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rt-cloud-')),
    key = 'b'.repeat(64),
    origin = 'https://workspace.example';
  const server = createServer({ store: new LocalStore(dir), cloud: true, key, origin });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    assert.equal((await fetch(base + '/api/state')).status, 401);
    assert.equal((await fetch(base + '/api/state?key=' + key)).status, 401);
    const login = await fetch(base + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Role-Trail': '1', Origin: origin },
      body: JSON.stringify({ key }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie');
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict']) assert.ok(cookie.includes(flag));
    assert.equal(
      (await fetch(base + '/api/state', { headers: { Cookie: cookie.split(';')[0] } })).status,
      200,
    );
    const r = await fetch(base + '/api/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + key,
        Origin: 'https://evil.example',
      },
      body: '{}',
    });
    assert.equal(r.status, 403);
    const good = await fetch(base + '/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({
        revision: 0,
        action: { type: 'research', run: { id: 'authenticated', coverage: [] }, jobs: [] },
      }),
    });
    assert.equal(good.status, 200);
    assert.equal((await good.json()).revision, 1);
    const bad = await fetch(base + '/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: '{"private":"do-not-echo",broken',
    });
    assert.equal(bad.status, 400);
    assert.doesNotMatch(await bad.text(), /do-not-echo/);
  } finally {
    server.close();
    server.closeAllConnections();
    await rm(dir, { recursive: true, force: true });
  }
});
