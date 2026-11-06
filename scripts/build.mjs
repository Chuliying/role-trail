import { build } from 'esbuild';
import { renderToString } from 'react-dom/server';
import { rm } from 'node:fs/promises';
import browserModules from '../web/modules.json' with { type: 'json' };
import { createHash } from 'node:crypto';
import { readFile, access, writeFile, mkdir } from 'node:fs/promises';
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
await writeFile(
  'web/vendor/runtime-LICENSE.txt',
  (
    await Promise.all(
      ['react', 'react-dom', 'scheduler', '@tanstack/react-query', '@tanstack/query-core'].map(
        async (name) =>
          name + '\n\n' + (await readFile('node_modules/' + name + '/LICENSE', 'utf8')),
      ),
    )
  ).join('\n\n'),
);
await build({
  entryPoints: ['src/client/main.tsx'],
  bundle: true,
  outfile: 'web/app.js',
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  minify: true,
  legalComments: 'inline',
  define: { 'process.env.NODE_ENV': '"production"' },
});
const ssrFile = new URL('../.role-trail-shell.mjs', import.meta.url);
let shell;
try {
  await build({
    entryPoints: ['src/client/App.tsx'],
    bundle: true,
    outfile: ssrFile.pathname,
    format: 'esm',
    platform: 'node',
    packages: 'external',
  });
  const { App } = await import(ssrFile.href + '?build=' + Date.now());
  const { createElement } = await import('react');
  shell = renderToString(createElement(App));
} finally {
  await rm(ssrFile, { force: true });
}
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
  ...browserModules.map((p) => 'web/' + p),
  'web/index.html',
  'web/style.css',
  'web/verification.css',
  'api/index.mjs',
])
  await access(file);
for (const file of [...browserModules.map((p) => 'web/' + p), 'api/index.mjs'])
  execFileSync(process.execPath, ['--check', file]);
const config = JSON.parse(await readFile('vercel.json', 'utf8'));
if (config.outputDirectory !== 'web') throw Error('Only public static assets may be deployed');
console.log('Static workbench and serverless entry validated; Vercel builds the API function.');

// A fresh navigation must not mix cached entry assets from different releases.
const bytes = await Promise.all(
  [...browserModules.map((p) => 'web/' + p), 'web/style.css'].map((p) => readFile(p)),
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
    /(?:<!-- prettier-ignore -->\s*)?<body>[\s\S]*?<\/body>/,
    '<!-- prettier-ignore -->\n<body>' + shell + '</body>',
  );
await writeFile(
  'web/index.html',
  await format(html.replace(/(\/(?:app\.js|style\.css))(?:\?v=[a-f0-9]+)?/g, '$1?v=' + version), {
    parser: 'html',
    printWidth: 100,
  }),
);
