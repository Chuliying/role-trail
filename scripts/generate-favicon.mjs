// Render the bundled, OFL-licensed logo font; no network or system font dependency.
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const font = [...(await readFile('web/fonts/google/mplus-u-latin.woff2'))];
  const rendered = await page.evaluate(async (font) => {
    const face = new FontFace('RT Brand', new Uint8Array(font), { weight: '500' });
    document.fonts.add(await face.load());
    return [16, 32, 48, 180].map((size) => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#2E3F5C';
      ctx.fillRect(0, 0, size, size);
      ctx.font = `500 ${size * 0.64}px "RT Brand"`;
      const metrics = ctx.measureText('RT');
      ctx.fillStyle = '#FBF9F4';
      ctx.fillText(
        'RT',
        (size - metrics.width) / 2,
        (size + metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2,
      );
      return c.toDataURL('image/png').split(',')[1];
    });
  }, font);
  const pngs = rendered.map((x) => Buffer.from(x, 'base64'));
  await writeFile('web/favicon-32.png', pngs[1]);
  await writeFile('web/apple-touch-icon.png', pngs[3]);
  const header = Buffer.alloc(6 + 16 * 3);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(3, 4);
  let offset = header.length;
  for (let i = 0; i < 3; i++) {
    const n = 6 + i * 16;
    header[n] = header[n + 1] = [16, 32, 48][i];
    header.writeUInt16LE(1, n + 4);
    header.writeUInt16LE(32, n + 6);
    header.writeUInt32LE(pngs[i].length, n + 8);
    header.writeUInt32LE(offset, n + 12);
    offset += pngs[i].length;
  }
  await writeFile('web/favicon.ico', Buffer.concat([header, ...pngs.slice(0, 3)]));
} finally {
  await browser.close();
}
