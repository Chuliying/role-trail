import { PostgresStore } from '../src/postgres.mjs';
import { handler } from '../src/server.mjs';
let store;
export default async function api(req, res) {
  if (!process.env.DATABASE_URL) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Database not configured' }));
    return;
  }
  store ||= new PostgresStore(process.env.DATABASE_URL);
  return handler({
    store,
    cloud: true,
    key: process.env.ROLE_TRAIL_ACCESS_KEY,
    origin: process.env.ROLE_TRAIL_ORIGIN,
  })(req, res);
}
