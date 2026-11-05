import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const packageDir = fileURLToPath(new URL('../', import.meta.url));
test('standalone copy initializes synthetic profile and creates a draft brief without activating a schedule', async () => {
  const root = await mkdtemp(join(tmpdir(), 'role-cli-'));
  try {
    const portable = join(root, 'portable');
    await cp(packageDir, portable, {
      recursive: true,
      filter: (source) =>
        !['.git', 'node_modules', 'test-results', 'playwright-report'].includes(basename(source)),
    });
    const run = (args) =>
      spawnSync(process.execPath, [join(portable, 'bin/role-trail.mjs'), ...args], {
        encoding: 'utf8',
        cwd: root,
      });
    assert.equal(run(['help']).status, 0, 'CLI help must run outside private repository');
    const p = join(root, 'input.json'),
      w = join(root, 'workspace');
    await writeFile(
      p,
      JSON.stringify({
        name: 'Demo',
        targetRoles: ['Data Analyst'],
        location: 'London',
        remotePolicy: 'UK',
        timezone: 'Europe/London',
        languages: ['English'],
        ownershipPolicy: 'None',
        platforms: ['official'],
      }),
    );
    const init = run(['init', '--workspace', w, '--profile', p]);
    assert.equal(init.status, 0, init.stderr);
    const brief = run(['brief', '--workspace', w, '--host', 'codex']);
    assert.equal(brief.status, 0, brief.stderr);
    const text = await readFile(join(w, 'agent-brief.md'), 'utf8');
    assert.ok(text.includes('Data Analyst'));
    assert.ok(text.includes('Europe/London'));
    assert.ok(text.includes('NOT ACTIVATED'));
    assert.ok(text.includes('UNTRUSTED'));
    assert.notEqual(run(['scan', '--workspace', w, '--repo', portable]).status, 0);
    assert.notEqual(run(['brief', '--workspace', w, '--host', 'unknown']).status, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('invalid profile JSON does not echo private input in errors', async () => {
  const root = await mkdtemp(join(tmpdir(), 'role-invalid-'));
  try {
    const input = join(root, 'bad.json');
    await writeFile(input, '{"password":"PRIVATE-EXAMPLE-DO-NOT-ECHO", broken}');
    const result = spawnSync(
      process.execPath,
      [
        join(packageDir, 'bin/role-trail.mjs'),
        'init',
        '--workspace',
        join(root, 'w'),
        '--profile',
        input,
      ],
      { encoding: 'utf8' },
    );
    assert.notEqual(result.status, 0);
    assert.ok(!result.stderr.includes('PRIVATE-EXAMPLE-DO-NOT-ECHO'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
