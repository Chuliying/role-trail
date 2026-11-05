import { createHash } from 'node:crypto';
import { readFile, access, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
execFileSync(
  process.execPath,
  [
    'node_modules/@tailwindcss/cli/dist/index.mjs',
    '-i',
    'src/ui.css',
    '-o',
    'web/style.css',
    '--minify',
  ],
  { stdio: 'inherit' },
);
for (const file of [
  'web/index.html',
  'web/style.css',
  'web/app.js',
  'web/i18n.mjs',
  'web/status.mjs',
  'web/outcomes.mjs',
  'web/verification.mjs',
  'web/verification.css',
  'api/index.mjs',
])
  await access(file);
for (const file of [
  'web/app.js',
  'web/i18n.mjs',
  'web/status.mjs',
  'web/outcomes.mjs',
  'web/verification.mjs',
  'api/index.mjs',
])
  execFileSync(process.execPath, ['--check', file]);
const config = JSON.parse(await readFile('vercel.json', 'utf8'));
if (config.outputDirectory !== 'web') throw Error('Only public static assets may be deployed');
console.log('Static workbench and serverless entry validated; Vercel builds the API function.');

// A fresh navigation must not mix cached entry assets from different releases.
const bytes = await Promise.all(
  ['web/app.js', 'web/i18n.mjs', 'web/style.css', 'web/verification.mjs'].map((p) => readFile(p)),
);
const version = createHash('sha256').update(Buffer.concat(bytes)).digest('hex').slice(0, 16);
const html = await readFile('web/index.html', 'utf8');
await writeFile(
  'web/index.html',
  html.replace(/(\/(?:app\.js|style\.css))(?:\?v=[a-f0-9]+)?/g, '$1?v=' + version),
);
