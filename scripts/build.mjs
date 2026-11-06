import { createHash } from 'node:crypto';
import { readFile, access, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { format } from 'prettier';
import { configuration, browserConfiguration } from '../src/configuration.mjs';
await writeFile(
  'web/configuration.mjs',
  await format(
    '// Generated from config/*.json by npm run build. Do not edit. Public data only.\n' +
      'export const settings = ' +
      JSON.stringify(browserConfiguration(configuration), null, 2) +
      ';\n',
    { parser: 'babel', singleQuote: true, printWidth: 100, trailingComma: 'all' },
  ),
);
await mkdir('web/vendor', { recursive: true });
await copyFile('node_modules/marked/lib/marked.esm.js', 'web/vendor/marked.mjs');
await copyFile('node_modules/marked/LICENSE', 'web/vendor/marked-LICENSE.md');
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
  'web/configuration.mjs',
  'web/i18n.mjs',
  'web/status.mjs',
  'web/outcomes.mjs',
  'web/verification.mjs',
  'web/markdown.mjs',
  'web/vendor/marked.mjs',
  'web/verification.css',
  'api/index.mjs',
])
  await access(file);
for (const file of [
  'web/app.js',
  'web/configuration.mjs',
  'web/i18n.mjs',
  'web/status.mjs',
  'web/outcomes.mjs',
  'web/verification.mjs',
  'web/markdown.mjs',
  'web/vendor/marked.mjs',
  'api/index.mjs',
])
  execFileSync(process.execPath, ['--check', file]);
const config = JSON.parse(await readFile('vercel.json', 'utf8'));
if (config.outputDirectory !== 'web') throw Error('Only public static assets may be deployed');
console.log('Static workbench and serverless entry validated; Vercel builds the API function.');

// A fresh navigation must not mix cached entry assets from different releases.
const bytes = await Promise.all(
  [
    'web/app.js',
    'web/configuration.mjs',
    'web/i18n.mjs',
    'web/style.css',
    'web/status.mjs',
    'web/outcomes.mjs',
    'web/verification.mjs',
    'web/markdown.mjs',
    'web/vendor/marked.mjs',
  ].map((p) => readFile(p)),
);
const version = createHash('sha256').update(Buffer.concat(bytes)).digest('hex').slice(0, 16);
const escape = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const html = (await readFile('web/index.html', 'utf8'))
  .replace(/<title>[^<]*<\/title>/, '<title>' + escape(configuration.ui.title) + '</title>')
  .replace(
    /(<a class="brand" href="\/">)[^<]*(<\/a>)/,
    '$1' + escape(configuration.ui.brand) + '$2',
  )
  .replace(
    /(<nav aria-label="Workspace">)[\s\S]*?(<\/nav>)/,
    (_, start, end) =>
      start +
      '\n' +
      configuration.ui.navigation
        .map(
          (n, i) =>
            '<button data-page="' +
            n.id +
            '"' +
            (i === 0 ? ' class="active"' : '') +
            ' data-i18n="' +
            escape(n.label) +
            '">' +
            escape(n.label) +
            '</button>',
        )
        .join('\n') +
      '\n' +
      end,
  );
await writeFile(
  'web/index.html',
  await format(html.replace(/(\/(?:app\.js|style\.css))(?:\?v=[a-f0-9]+)?/g, '$1?v=' + version), {
    parser: 'html',
    printWidth: 100,
  }),
);
