import http from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
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
export function authorized(req, { cloud, key }) {
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
  '/': ['index.html', 'text/html'],
  '/index.html': ['index.html', 'text/html'],
  '/app.js': ['app.js', 'text/javascript'],
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
export function handler({ store, cloud = false, key, origin }) {
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
        (!/^[a-f0-9]{64}$/i.test(key || '') || !origin || !origin.startsWith('https://'))
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
      if (!authorized(req, { cloud, key }))
        return send(401, { error: 'Sign in with your workspace access key' });
      if (path === '/api/logout' && req.method === 'POST') {
        res.setHeader(
          'Set-Cookie',
          'role_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
        );
        return send(200, { ok: true });
      }
      if (path === '/api/state' && req.method === 'GET') return send(200, await store.read());
      if (path === '/api/export' && req.method === 'GET') {
        res.setHeader('Content-Disposition', 'attachment; filename="role-trail-backup.json"');
        return send(200, await store.read());
      }
      if (path === '/api/action' && req.method === 'POST') {
        const b = await body(req);
        return send(200, await store.update(b.revision, b.action));
      }
      if (path === '/api/restore' && req.method === 'POST') {
        const b = await body(req);
        return send(200, await store.restore(b.revision, b.state));
      }
      if (path === '/api/draft' && req.method === 'POST') {
        const b = await body(req),
          s = await store.read();
        if (s.revision !== b.revision) throw Error('Revision conflict');
        const { draftAction } = await import('./resume.mjs');
        return send(200, await store.update(b.revision, draftAction(s, b.jobId)));
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
        return send(200, await saveResearch(store, bundle));
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
