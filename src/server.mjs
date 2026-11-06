import imageAssets from '../web/assets.json' with { type: 'json' };
import browserModules from '../web/modules.json' with { type: 'json' };
import { workspaceDelta } from '../web/sync.mjs';
import { artifactHash } from './artifacts.mjs';
import http from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import fontFiles from '../web/fonts/manifest.json' with { type: 'json' };
import { LocalStore } from './workbench.mjs';
const equal = (a, b) =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function session(key, expires) {
  const body = String(expires);
  return body + '.' + createHmac('sha256', key).update(body).digest('hex');
}
// Opt-in only for dedicated installations whose deployment guard enforces ALL protection.
// Never infer trust from request headers. Generic installations use the access-key mode.
export function protectedVercel(env = process.env) {
  return (
    env.ROLE_TRAIL_AUTH === 'vercel-protected' &&
    env.VERCEL === '1' &&
    !!env.ROLE_TRAIL_PROTECTED_PROJECT_ID &&
    env.VERCEL_PROJECT_ID === env.ROLE_TRAIL_PROTECTED_PROJECT_ID
  );
}
export function authorized(req, { cloud, key, platformProtected = false }) {
  if (cloud && platformProtected) return true;
  if (!cloud) return true;
  if (!/^[a-f0-9]{64}$/i.test(key || '')) return false;
  if (equal(req.headers.authorization, 'Bearer ' + key)) return true;
  const value = (req.headers.cookie || '')
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('role_session='))
    ?.slice(13);
  if (!value || value.length > 100) return false;
  const expires = Number(value.split('.')[0]);
  return (
    Number.isSafeInteger(expires) &&
    expires > Date.now() &&
    expires < Date.now() + 86400001 &&
    equal(value, session(key, expires))
  );
}
const root = fileURLToPath(new URL('../web/', import.meta.url));
const assets = {
  ...Object.fromEntries(Object.entries(imageAssets).map(([p, mime]) => ['/' + p, [p, mime]])),
  ...Object.fromEntries(browserModules.map((p) => ['/' + p, [p, 'text/javascript']])),
  ...Object.fromEntries(
    fontFiles.map((p) => [
      '/' + p,
      [p, p.endsWith('.woff2') ? 'font/woff2' : p.endsWith('.css') ? 'text/css' : 'text/plain'],
    ]),
  ),
  '/': ['index.html', 'text/html'],
  '/index.html': ['index.html', 'text/html'],
  '/fonts/ibm-plex-sans-400.ttf': ['fonts/ibm-plex-sans-400.ttf', 'font/ttf'],
  '/fonts/ibm-plex-sans-600.ttf': ['fonts/ibm-plex-sans-600.ttf', 'font/ttf'],
  '/style.css': ['style.css', 'text/css'],
};
export async function body(req) {
  if (req.body !== undefined) {
    const raw =
      typeof req.body === 'string'
        ? req.body
        : Buffer.isBuffer(req.body)
          ? req.body.toString()
          : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > 16_000_000) throw Error('Request too large');
    return JSON.parse(raw);
  }
  let size = 0,
    parts = [];
  for await (const part of req) {
    size += part.length;
    if (size > 16_000_000) throw Error('Request too large');
    parts.push(part);
  }
  return JSON.parse(Buffer.concat(parts).toString() || '{}');
}
export function handler({ store, cloud = false, key, origin, platformProtected = false }) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    const send = (code, value) => {
      res.statusCode = code;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(value));
    };
    try {
      const host = req.headers.host || '',
        expected = cloud ? origin : 'http://' + host;
      if (!cloud && !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host))
        return send(403, { error: 'Invalid host' });
      const path = new URL(req.url, 'http://localhost').pathname;
      if (!path.startsWith('/api/')) {
        if (req.method !== 'GET' || !assets[path]) return send(404, { error: 'Not found' });
        const [file, mime] = assets[path];
        res.setHeader('Content-Type', mime + '; charset=utf-8');
        return res.end(await readFile(root + file));
      }
      if (
        cloud &&
        ((!platformProtected && !/^[a-f0-9]{64}$/i.test(key || '')) ||
          !origin ||
          !origin.startsWith('https://'))
      )
        return send(503, { error: 'Cloud authentication is not configured' });
      const write = req.method !== 'GET';
      if (req.headers.origin && req.headers.origin !== expected)
        return send(403, { error: 'Origin rejected' });
      if (
        write &&
        (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !==
          'application/json'
      )
        return send(415, { error: 'JSON required' });
      if (write && req.headers['x-role-trail'] !== '1' && !req.headers.authorization)
        return send(403, { error: 'Write header required' });
      if (path === '/api/login' && req.method === 'POST') {
        const b = await body(req);
        if (!cloud || !equal(b.key, key)) return send(401, { error: 'Invalid access key' });
        res.setHeader(
          'Set-Cookie',
          'role_session=' +
            session(key, Date.now() + 86400000) +
            '; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400',
        );
        return send(200, { ok: true });
      }
      if (!authorized(req, { cloud, key, platformProtected }))
        return send(401, { error: 'Sign in with your workspace access key' });
      if (path === '/api/dashboard')
        return send(410, {
          error:
            '此頁面是舊版本。請關閉這個頁面，重新開啟工作台；頁內更新按鈕無法升級舊頁面。 Close and reopen the workspace to load the new version.',
          code: 'CLIENT_UPGRADE_REQUIRED',
        });
      if (path === '/api/logout' && req.method === 'POST') {
        res.setHeader(
          'Set-Cookie',
          'role_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
        );
        return send(200, { ok: true });
      }
      const etag = (s) => '"workspace-' + artifactHash(JSON.stringify(s)).slice(0, 24) + '"';
      const wantsDelta = req.headers['x-role-trail-response'] === 'delta';
      const sendState = (s, before) => {
        res.setHeader('ETag', etag(s));
        return send(200, wantsDelta && before ? workspaceDelta(before, s) : s);
      };
      if (path === '/api/state' && req.method === 'GET') {
        const s = await store.read(),
          tag = etag(s);
        res.setHeader('ETag', tag);
        if (req.headers['if-none-match'] === tag) {
          res.statusCode = 304;
          return res.end();
        }
        return send(200, s);
      }
      if (path === '/api/export' && req.method === 'GET') {
        res.setHeader('Content-Disposition', 'attachment; filename="role-trail-backup.json"');
        return send(200, await store.read());
      }
      if (path === '/api/action' && req.method === 'POST') {
        const b = await body(req);
        const before = wantsDelta ? await store.read() : null;
        return sendState(await store.update(b.revision, b.action), before);
      }
      if (path === '/api/restore' && req.method === 'POST') {
        const b = await body(req);
        const before = wantsDelta ? await store.read() : null;
        return sendState(await store.restore(b.revision, b.state), before);
      }
      if (path === '/api/draft' && req.method === 'POST') {
        const b = await body(req),
          s = await store.read();
        if (s.revision !== b.revision) throw Error('Revision conflict');
        const { draftAction } = await import('./resume.mjs');
        const draft = draftAction(s, b.jobId);
        return sendState(draft ? await store.update(b.revision, draft) : s, s);
      }
      if (path === '/api/pdf' && req.method === 'POST') {
        const b = await body(req);
        if (
          typeof b.pdf !== 'string' ||
          b.pdf.length > 2_700_000 ||
          !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(b.pdf)
        )
          throw Error('Invalid PDF encoding');
        const before = wantsDelta ? await store.read() : null;
        return sendState(
          await store.savePDF(b.revision, b.input, Buffer.from(b.pdf, 'base64')),
          before,
        );
      }
      if (path === '/api/research' && req.method === 'GET') {
        const u = new URL(req.url, 'http://localhost');
        const state = await store.read();
        const run = state.runs.find((r) => r.id === u.searchParams.get('run'));
        if (!run?.archiveHash) return send(404, { error: 'Research archive not found' });
        let bytes;
        try {
          bytes = await store.getArtifact(run.archiveHash);
        } catch (e) {
          if (e.code === 'ENOENT' || e.message === 'Artifact not found')
            return send(404, { error: 'Research archive not found' });
          throw e;
        }
        let bundle;
        try {
          bundle = JSON.parse(bytes.toString('utf8'));
        } catch {}
        if (
          artifactHash(bytes) !== run.archiveHash ||
          !bundle ||
          bundle.run?.id !== run.id ||
          !Array.isArray(bundle.run?.coverage) ||
          !Array.isArray(bundle.jobs)
        )
          return send(422, { error: 'Saved research archive is invalid' });
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        if (u.searchParams.get('download') === '1')
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="research-${run.archiveHash.slice(0, 16)}.json"`,
          );
        return res.end(bytes);
      }
      if (path === '/api/artifact' && req.method === 'GET') {
        const id = new URL(req.url, 'http://localhost').searchParams.get('hash');
        res.setHeader('Content-Type', 'application/octet-stream');
        return res.end(await store.getArtifact(id));
      }
      if (path === '/api/resume' && req.method === 'GET') {
        const u = new URL(req.url, 'http://localhost'),
          s = await store.read(),
          r = s.resumes.find(
            (x) =>
              x.jobId === u.searchParams.get('job') &&
              x.version === Number(u.searchParams.get('version')),
          );
        if (!r) return send(404, { error: 'Resume not found' });
        if (u.searchParams.get('format') === 'pdf') {
          if (!r.pdfHash) return send(404, { error: 'PDF not saved' });
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'inline; filename="' + r.pdfFilename + '"');
          return res.end(await store.getArtifact(r.pdfHash));
        }
        const { resumeHTML } = await import('./resume.mjs');
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'",
        );
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.end(resumeHTML(r));
      }
      if (path === '/api/tick' && req.method === 'POST') {
        const { tick } = await import('./schedule.mjs');
        return send(200, await tick(store));
      }
      if (path === '/api/collect' && req.method === 'POST') {
        const b = await body(req),
          s = await store.read();
        if (s.revision !== b.revision) throw Error('Revision conflict');
        const { collect, saveResearch } = await import('./collect.mjs');
        const bundle = await collect(s.profile);
        const before = wantsDelta ? await store.read() : null;
        const after = await saveResearch(store, bundle);
        // Collector may reconcile at a later revision: only emit a delta from the requested base.
        return sendState(after, before?.revision === b.revision ? before : null);
      }
      send(404, { error: 'Not found' });
    } catch (e) {
      const message =
        e instanceof SyntaxError
          ? 'Invalid JSON'
          : /Revision conflict|writer active/.test(e.message)
            ? 'Revision conflict; refresh and retry'
            : e.code
              ? 'Storage or upstream unavailable'
              : e.message;
      send(/conflict/.test(message) ? 409 : 400, { error: message });
    }
  };
}
export function createServer({ workspace, store, ...options }) {
  return http.createServer(handler({ store: store || new LocalStore(workspace), ...options }));
}
