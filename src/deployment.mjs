import { mkdir, copyFile, readFile, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join, dirname } from 'node:path';
import { artifactHash } from './artifacts.mjs';
import fontFiles from '../web/fonts/manifest.json' with { type: 'json' };
export const staticFiles = [
  ...fontFiles,
  'index.html',
  'app.js',
  'i18n.mjs',
  'fonts/OFL.txt',
  'fonts/ibm-plex-sans-400.ttf',
  'fonts/ibm-plex-sans-600.ttf',
  'style.css',
  'status.mjs',
  'outcomes.mjs',
  'verification.mjs',
  'markdown.mjs',
  'vendor/marked.mjs',
  'vendor/marked-LICENSE.md',
];
export async function buildDeployment(output) {
  const source = fileURLToPath(new URL('../web/', import.meta.url)),
    destination = resolve(output);
  if (destination === resolve(source)) throw Error('Do not overwrite the package source');
  await mkdir(destination, { recursive: true });
  const hashes = {};
  for (const file of staticFiles) {
    const src = join(source, file);
    if (!(await lstat(src)).isFile()) throw Error('Invalid static asset');
    await mkdir(dirname(join(destination, file)), { recursive: true });
    await copyFile(src, join(destination, file));
    hashes[file] = artifactHash(await readFile(src));
  }
  return { files: staticFiles, hashes };
}
