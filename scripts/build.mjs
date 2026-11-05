import { readFile, access } from 'node:fs/promises';
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
  'web/status.mjs',
  'web/outcomes.mjs',
  'web/verification.mjs',
  'web/verification.css',
  'api/index.mjs',
])
  await access(file);
for (const file of [
  'web/app.js',
  'web/status.mjs',
  'web/outcomes.mjs',
  'web/verification.mjs',
  'api/index.mjs',
])
  execFileSync(process.execPath, ['--check', file]);
const config = JSON.parse(await readFile('vercel.json', 'utf8'));
if (config.outputDirectory !== 'web') throw Error('Only public static assets may be deployed');
console.log('Static workbench and serverless entry validated; Vercel builds the API function.');
