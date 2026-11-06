import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
let deployment = {};
try {
  deployment = await import('../src/deployment.mjs');
} catch (e) {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
}
test('deployment wrapper copies exactly the canonical static app and no private files', async () => {
  assert.equal(typeof deployment.buildDeployment, 'function');
  const dir = await mkdtemp(join(tmpdir(), 'rt-deploy-'));
  try {
    const result = await deployment.buildDeployment(join(dir, 'web'));
    assert.ok(result.files.includes('app.js'));
    for (const file of ['favicon.ico', 'favicon-32.png', 'apple-touch-icon.png', 'filters.mjs'])
      assert.ok(result.files.includes(file));
    for (const file of result.files)
      assert.deepEqual(
        await readFile(join(dir, 'web', file)),
        await readFile(new URL('../web/' + file, import.meta.url)),
      );
    assert.ok(!result.files.some((f) => /state|resume|env/.test(f)));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
