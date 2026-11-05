import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStore } from '../src/workbench.mjs';
import { demoActions } from '../src/demo.mjs';
import { createServer } from '../src/server.mjs';
const workspace = await mkdtemp(join(tmpdir(), 'role-trail-ui-')),
  store = new LocalStore(workspace);
let s = await store.read();
for (const a of demoActions()) s = await store.update(s.revision, a);
const server = createServer({ store });
server.listen(4319, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    server.close();
    server.closeAllConnections();
    await rm(workspace, { recursive: true, force: true });
    process.exit(0);
  });
