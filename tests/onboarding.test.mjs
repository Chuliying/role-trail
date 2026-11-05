import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
let api = {};
try {
  api = await import('../src/onboarding.mjs');
} catch (e) {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
}
const git = (dir, args) =>
  execFileSync('git', ['-C', dir, ...args], {
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
  }).trim();
const profile = {
  name: 'Example Developer',
  targetRoles: ['Data Product Engineer'],
  location: 'Berlin',
  remotePolicy: 'Germany or worldwide',
  timezone: 'Europe/Berlin',
  languages: ['English'],
  ownershipPolicy: 'No restriction',
  portfolio: 'https://example.org',
  resumeSource: 'manual',
  platforms: ['official', 'himalayas'],
};
test('private workspace is reusable without overwriting profile; rejects invalid preferences and repo-contained output', async () => {
  assert.equal(typeof api.initialize, 'function');
  const root = await mkdtemp(join(tmpdir(), 'role-init-'));
  try {
    const dir = join(root, 'private');
    await api.initialize(dir, profile);
    const before = await readFile(join(dir, 'profile.json'), 'utf8');
    await api.initialize(dir, { ...profile, name: 'Other' });
    assert.equal(await readFile(join(dir, 'profile.json'), 'utf8'), before);
    await assert.rejects(
      api.initialize(join(root, 'bad'), { ...profile, timezone: 'Fake/Zone' }),
      /timezone/i,
    );
    await assert.rejects(api.initialize(process.cwd(), profile), /repository|package/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('scan uses exact authors, labels coauthored commits, skips merges and secrets, and never claims ability', async () => {
  assert.equal(typeof api.scanRepository, 'function');
  const root = await mkdtemp(join(tmpdir(), 'role-git-')),
    repo = join(root, 'repo'),
    out = join(root, 'private');
  try {
    await mkdir(repo);
    git(repo, ['init', '-q']);
    git(repo, ['config', 'user.name', 'Example']);
    git(repo, ['config', 'user.email', 'owner@example.org']);
    await writeFile(join(repo, 'ui.ts'), 'export const x = 1;\n');
    await writeFile(join(repo, '.env'), 'SECRET=do-not-export\n');
    git(repo, ['add', '.']);
    git(repo, ['commit', '-qm', 'UI foundation']);
    git(repo, ['config', 'user.email', 'other@example.org']);
    await writeFile(join(repo, 'other.ts'), 'export const y=2;\n');
    git(repo, ['add', '.']);
    git(repo, ['commit', '-qm', 'Other contributor']);
    git(repo, ['config', 'user.email', 'owner@example.org']);
    await writeFile(join(repo, 'ui.ts'), 'export const x = 3;\n');
    git(repo, ['add', '.']);
    git(repo, ['commit', '-qm', 'Improve UI\n\nCo-authored-by: Team <team@example.org>']);
    await api.initialize(out, profile);
    const report = await api.scanRepository({
      repo,
      workspace: out,
      authors: ['owner@example.org'],
      includePatches: true,
      maxCommits: 10,
    });
    assert.equal(report.commits.length, 2);
    assert.equal(report.commits[0].attribution, 'coauthored');
    assert.equal(report.commits[1].attribution, 'author_identity_only');
    assert.equal(report.claimsConfirmed, false);
    const raw = JSON.stringify(report);
    assert.ok(!raw.includes('Other contributor'));
    assert.ok(!raw.includes('SECRET'));
    assert.ok(!raw.includes('.env'));
    assert.ok(raw.includes('ui.ts'));
    assert.ok(report.commits.every((c) => /^[a-f0-9]{40,64}$/.test(c.sha)));
    assert.ok(report.commits.every((c) => c.evidenceId));
    await assert.rejects(api.scanRepository({ repo, workspace: out, authors: [] }), /author/i);
    await assert.rejects(
      api.scanRepository({ repo, workspace: repo, authors: ['owner@example.org'] }),
      /repository/i,
    );
    const limited = await api.scanRepository({
      repo,
      workspace: out,
      authors: ['owner@example.org'],
      maxCommits: 1,
    });
    assert.equal(limited.commits.length, 1);
    assert.ok(limited.truncated);
    assert.ok(!JSON.stringify(limited).includes('diff --git'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('merge history and symlink destinations cannot broaden the authorized scan', async () => {
  const root = await mkdtemp(join(tmpdir(), 'role-merge-')),
    repo = join(root, 'repo'),
    out = join(root, 'private');
  try {
    await mkdir(repo);
    git(repo, ['init', '-q']);
    git(repo, ['config', 'user.name', 'Example']);
    git(repo, ['config', 'user.email', 'owner@example.org']);
    await writeFile(join(repo, 'base.ts'), 'export const base=1;');
    git(repo, ['add', '.']);
    git(repo, ['commit', '-qm', 'Base']);
    const branch = git(repo, ['branch', '--show-current']);
    git(repo, ['checkout', '-qb', 'feature']);
    await writeFile(join(repo, 'feature.ts'), 'const token = "example-not-a-real-token";\n');
    git(repo, ['add', '.']);
    git(repo, ['commit', '-qm', 'Feature']);
    git(repo, ['checkout', '-q', branch]);
    git(repo, ['merge', '--no-ff', '-m', 'Merge feature', 'feature']);
    await api.initialize(out, profile);
    const r = await api.scanRepository({
      repo,
      workspace: out,
      authors: ['owner@example.org'],
      includePatches: true,
    });
    assert.equal(r.commits.length, 2);
    assert.ok(!r.commits.some((c) => c.subject === 'Merge feature'));
    assert.ok(!JSON.stringify(r).includes('example-not-a-real-token'));
    const { symlink } = await import('node:fs/promises');
    await symlink(repo, join(root, 'alias'));
    await assert.rejects(
      api.scanRepository({
        repo,
        workspace: join(root, 'alias', 'evidence'),
        authors: ['owner@example.org'],
      }),
      /repository/i,
    );
    const outsider = await api.scanRepository({
      repo,
      workspace: out,
      authors: ['nobody@example.org'],
    });
    assert.equal(outsider.commits.length, 0);
    assert.equal(outsider.claimsConfirmed, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('nonexistent absolute workspace keeps its complete path', async () => {
  const path = '/role-trail-nonexistent-6683453/private';
  assert.equal(await api.privateWorkspace(path), path);
});

test('initial profile preserves explicitly configured feeds without accepting credential fields', async () => {
  const p = {
    name: 'Synthetic',
    targetRoles: ['Data Engineer'],
    location: 'London',
    remotePolicy: 'UK',
    timezone: 'Europe/London',
    languages: ['English'],
    ownershipPolicy: 'None',
    platforms: ['himalayas'],
    feeds: [{ type: 'himalayas', query: 'data engineer', country: 'GB' }],
  };
  const { validateProfile } = await import('../src/onboarding.mjs');
  assert.deepEqual(validateProfile(p).feeds, p.feeds);
  assert.throws(() =>
    validateProfile({
      ...p,
      feeds: [{ type: 'google-jobs', api_key: 'example-not-a-real-token' }],
    }),
  );
});
