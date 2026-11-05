import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile, realpath, lstat } from 'node:fs/promises';
import { resolve, dirname, basename, join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
const exec = promisify(execFile),
  packageRoot = fileURLToPath(new URL('../', import.meta.url));
const inside = (root, path) => {
  const r = relative(root, path);
  return !r || (!r.startsWith('..') && !r.startsWith('/'));
};
const env = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_TERMINAL_PROMPT: '0',
  GIT_OPTIONAL_LOCKS: '0',
};
for (const k of Object.keys(env))
  if (
    /^GIT_(DIR|WORK_TREE|COMMON_DIR|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG_COUNT|CONFIG_KEY_|CONFIG_VALUE_)/.test(
      k,
    )
  )
    delete env[k];
async function git(repo, args) {
  try {
    return (
      await exec('git', ['--no-replace-objects', '-C', repo, ...args], {
        encoding: 'utf8',
        env,
        timeout: 20000,
        maxBuffer: 2_000_000,
      })
    ).stdout;
  } catch {
    throw Error('Git read failed; verify repository, Git installation and bounded input size');
  }
}
async function canonicalFuture(path) {
  let p = resolve(path),
    tail = [];
  for (;;) {
    try {
      return resolve(await realpath(p), ...tail.reverse());
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      tail.push(basename(p));
      p = dirname(p);
    }
  }
}
export async function privateWorkspace(path, repo) {
  const p = await canonicalFuture(path),
    pkg = await realpath(packageRoot);
  if (inside(pkg, p) || (repo && inside(await realpath(repo), p)))
    throw Error('Private workspace must be outside the repository/package');
  let ancestor = p;
  for (;;) {
    try {
      await lstat(ancestor);
      break;
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      ancestor = dirname(ancestor);
    }
  }
  let gitRoot;
  try {
    gitRoot = (await git(ancestor, ['rev-parse', '--show-toplevel'])).trim();
  } catch {}
  if (gitRoot) throw Error('Private workspace must be outside any Git repository');
  return p;
}
export function validateFeeds(feeds = []) {
  if (!Array.isArray(feeds) || feeds.length > 12) throw Error('At most 12 feeds');
  const allowed = ['type', 'board', 'company', 'name', 'query', 'country', 'timezone', 'location'];
  for (const f of feeds) {
    if (
      !f ||
      typeof f !== 'object' ||
      Array.isArray(f) ||
      Object.keys(f).some((k) => !allowed.includes(k)) ||
      Object.values(f).some((v) => typeof v !== 'string' || v.length > 500)
    )
      throw Error('Invalid feed configuration; never put credentials in profiles');
    if (!['himalayas', 'greenhouse', 'lever', 'google-jobs'].includes(f.type))
      throw Error('Unsupported feed');
    if (f.type === 'greenhouse' && !/^[a-zA-Z0-9_-]{1,80}$/.test(f.board || ''))
      throw Error('Greenhouse board slug required');
    if (f.type === 'lever' && !/^[a-zA-Z0-9_-]{1,80}$/.test(f.company || ''))
      throw Error('Lever employer slug required');
  }
  return structuredClone(feeds);
}
export function validateProfile(p) {
  for (const k of ['name', 'location', 'remotePolicy', 'timezone', 'ownershipPolicy'])
    if (typeof p[k] !== 'string' || !p[k].trim() || p[k].length > 1000)
      throw Error('Missing or invalid ' + k);
  try {
    new Intl.DateTimeFormat('en', { timeZone: p.timezone });
  } catch {
    throw Error('Invalid timezone');
  }
  for (const k of ['targetRoles', 'languages', 'platforms'])
    if (
      !Array.isArray(p[k]) ||
      !p[k].length ||
      p[k].some((x) => typeof x !== 'string' || !x.trim() || x.length > 200)
    )
      throw Error('Missing or invalid ' + k);
  if (p.portfolio) {
    const u = new URL(p.portfolio);
    if (u.protocol !== 'https:' || u.username || u.password)
      throw Error('Portfolio must be a public HTTPS link');
  }
  return {
    schemaVersion: 1,
    name: p.name,
    targetRoles: p.targetRoles,
    location: p.location,
    remotePolicy: p.remotePolicy,
    timezone: p.timezone,
    languages: p.languages,
    ownershipPolicy: p.ownershipPolicy,
    platforms: p.platforms,
    portfolio: p.portfolio || null,
    resumeSource: p.resumeSource || 'manual',
    confirmedCapabilities: [],
    feeds: validateFeeds(p.feeds),
    createdAt: new Date().toISOString(),
  };
}
export async function initialize(workspace, profile) {
  const dir = await privateWorkspace(workspace);
  const value = validateProfile(profile);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  try {
    await writeFile(join(dir, 'profile.json'), JSON.stringify(value, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const st = await lstat(join(dir, 'profile.json'));
    if (!st.isFile() || st.isSymbolicLink()) throw Error('Profile must be a regular file');
    validateProfile(JSON.parse(await readFile(join(dir, 'profile.json'), 'utf8')));
    return { workspace: dir, created: false };
  }
  return { workspace: dir, created: true };
}
const sensitive =
  /(^|\/)(\.[^/]+|node_modules|vendor|dist|build|coverage|credentials?|secrets?|private|id_rsa)(\/|$)|(?:token|password|credential|secret)|\.(?:pem|key|p12|pfx|sqlite|db|lock)$/i;
const codeExtensions = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.ts',
  '.tsx',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.rb',
  '.css',
  '.html',
  '.vue',
  '.svelte',
  '.sql',
]);
function redact(s) {
  return s
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .replace(
      /(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{15,}|github_pat_[A-Za-z0-9_]+|apify_(?:api|ui)_[A-Za-z0-9_-]+|AKIA[A-Z0-9]{16})/g,
      '[REDACTED]',
    )
    .replace(/\b(?:api[_-]?key|token|password|secret)\s*[:=]\s*[^\s,;]+/gi, '[REDACTED ASSIGNMENT]')
    .replace(/https?:\/\/[^\s/@]+:[^\s/@]+@[^\s]+/g, '[REDACTED CREDENTIAL URL]');
}
export async function scanRepository({
  repo,
  workspace,
  authors,
  since,
  maxCommits = 50,
  includePatches = false,
}) {
  if (
    !Array.isArray(authors) ||
    !authors.length ||
    authors.some((a) => typeof a !== 'string' || !/^\S+@\S+\.\S+$/.test(a))
  )
    throw Error('Explicit author email required');
  if (!Number.isInteger(maxCommits) || maxCommits < 1 || maxCommits > 200)
    throw Error('maxCommits must be 1–200');
  if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) throw Error('since must be YYYY-MM-DD');
  const root = await realpath(repo),
    dir = await privateWorkspace(workspace, root);
  if ((await git(root, ['rev-parse', '--show-toplevel'])).trim() !== root)
    throw Error('Select the repository root');
  const head = (await git(root, ['rev-parse', 'HEAD'])).trim();
  const shallow = (await git(root, ['rev-parse', '--is-shallow-repository'])).trim() === 'true';
  const args = [
    'log',
    'HEAD',
    '--no-merges',
    '--max-count=1001',
    '--format=%H%x00%ae%x00%aI%x00%s%x00%b%x00',
  ];
  if (since) args.push('--since=' + since);
  const parts = (await git(root, args)).split('\0');
  let seen = 0,
    matching = 0;
  const commits = [];
  for (let i = 0; i + 4 < parts.length; i += 5) {
    const [rawSha, email, date, subject, body] = parts.slice(i, i + 5),
      sha = rawSha.trim();
    if (!sha) continue;
    seen++;
    if (seen > 1000) break;
    if (!authors.includes(email)) continue;
    matching++;
    if (commits.length >= maxCommits) continue;
    const names = (
      await git(root, [
        'diff-tree',
        '--root',
        '--no-commit-id',
        '--no-renames',
        '--name-only',
        '-r',
        '-z',
        sha,
      ])
    )
      .split('\0')
      .filter(Boolean);
    const files = names
      .filter((f) => !sensitive.test(f) && codeExtensions.has(extname(f)))
      .slice(0, 30);
    const entry = {
      evidenceId: 'git:' + sha,
      sha,
      author: email,
      date,
      subject: redact(subject).slice(0, 500),
      attribution: /^Co-authored-by:/im.test(body) ? 'coauthored' : 'author_identity_only',
      files,
      omittedFiles: names.length - files.length,
      patches: [],
    };
    if (includePatches)
      for (const f of files.slice(0, 3)) {
        const patch = await git(root, [
          '--literal-pathspecs',
          'show',
          '--format=',
          '--no-ext-diff',
          '--no-textconv',
          '--no-renames',
          '--unified=2',
          sha,
          '--',
          f,
        ]);
        if (patch.includes('GIT binary patch') || patch.includes('Binary files')) continue;
        const text = redact(patch);
        entry.patches.push({ file: f, text: text.slice(0, 6000), truncated: text.length > 6000 });
      }
    commits.push(entry);
  }
  const report = {
    schemaVersion: 1,
    kind: 'untrusted-git-evidence',
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    repo: root,
    head,
    authors,
    since: since || null,
    historyScope: 'HEAD only, non-merge, latest 1000 examined; no remote fetch',
    shallow,
    examined: Math.min(seen, 1000),
    truncated: seen > 1000 || matching > maxCommits,
    includePatches,
    claimsConfirmed: false,
    limitations: [
      'Git authorship is self-reported and may be forged.',
      'Commit count, filenames and repository stack do not establish proficiency.',
      'Coauthored, generated, copied and AI-assisted code need human attribution review.',
      'Redaction is best effort; inspect locally before sharing with a model or employer.',
      'No source files, hooks, package scripts or tests were executed.',
    ],
    commits,
  };
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = join(dir, 'evidence-' + report.id + '.json');
  await writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return { ...report, output: file };
}
