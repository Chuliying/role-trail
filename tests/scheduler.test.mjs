import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalStore } from '../src/workbench.mjs';
import { tick } from '../src/schedule.mjs';
test('two concurrent scheduler clients produce one durable run and no double collection', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rt-scheduler-')),
    a = new LocalStore(dir),
    b = new LocalStore(dir);
  try {
    await a.update(0, {
      type: 'schedule',
      schedule: { status: 'active', time: '09:00', timezone: 'UTC' },
    });
    let calls = 0;
    const collectFn = async () => {
      calls++;
      return { run: { id: 'scheduled-test', coverage: [] }, jobs: [] };
    };
    const options = { date: new Date('2026-01-02T10:00:00Z'), collectFn };
    await Promise.allSettled([tick(a, options), tick(b, options)]);
    assert.equal(calls, 1);
    assert.equal((await a.read()).runs.length, 1);
    assert.equal((await a.read()).schedule.lastResult, 'completed');
    assert.equal((await tick(a, options)).ran, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
