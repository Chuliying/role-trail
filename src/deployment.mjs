import { mkdir, copyFile, readFile, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { artifactHash } from './artifacts.mjs';
export const staticFiles = [
  'index.html',
  'app.js',
  'style.css',
  'status.mjs',
  'outcomes.mjs',
  'verification.mjs',
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
    await copyFile(src, join(destination, file));
    hashes[file] = artifactHash(await readFile(src));
  }
  return { files: staticFiles, hashes };
}
