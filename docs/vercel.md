# Deploy your private frontend, API and PostgreSQL

The shipped frontend is `web/`; the Node API entry is `api/index.mjs`. `vercel.json` connects `/api/*` to that entry. Both use the same domain. PostgreSQL is the shared source of truth; agents use the API, not copied local snapshots.

You need your own Git repository, Vercel project and PostgreSQL database (Neon or another PostgreSQL provider). You may fork this public source repo; **keep all workspace data outside it**. No maintainer deployment, database or credentials are reused. Check provider plans yourself; these instructions do not authorize paid resources.

## Setup

1. Clone/fork, install Node22 dependencies with `npm ci --ignore-scripts`, and run `npm test` and `npm run build`.
2. Create/select your own PostgreSQL database. Put its provider-issued TLS connection string in a private runtime environment as `DATABASE_URL`. Do not paste it in chat or commit an env file. Keep TLS verification enabled.
3. Generate a random 32-byte hex value in your password manager or secret manager for `ROLE_TRAIL_ACCESS_KEY`. This is a single-owner access credential, not a public app configuration value. Use a unique value; do not use the synthetic test key.
4. Import your repository in Vercel as an **Other** framework with Node.js 22. The root is this repository. Build command: `npm run build`. Output: `web`. The checked-in config supplies both; no separate backend project is needed.
5. Add these variables through Vercel's environment settings or an interactive secret input, scoped to the environments you intend to use:

| Server variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Private PostgreSQL connection string |
| `ROLE_TRAIL_ACCESS_KEY` | 64 hexadecimal characters / 256 random bits; API ownership credential |
| `ROLE_TRAIL_ORIGIN` | Exact HTTPS origin, e.g. `https://YOUR-PROJECT.vercel.app`, without a trailing slash |
| `SERPAPI_API_KEY` | Optional, only if you configured Google Jobs via SerpApi |

Do not prefix secrets with `PUBLIC`, `NEXT_PUBLIC` or `VITE`. Do not export secrets into static JavaScript. Do not pull env files into Git. Use separate credentials/databases for preview tests if previews are enabled.

6. In a private shell environment with `DATABASE_URL` set, initialize the one-workspace table:

```sh
node bin/role-trail.mjs db-migrate
```

Migration is idempotent. It does not populate a real profile. Do not run tests against this database. For migration credentials with broader permissions, rotate to a runtime role limited to SELECT/INSERT/UPDATE on `role_trail_state` after setup.

7. Deploy using Vercel's Git integration or `vercel deploy --prod` linked to **your** project. Keep any existing Vercel Deployment Protection enabled. App-level authentication is required even if Deployment Protection is also enabled. Open your deployment and enter the access key to start a 24-hour session.
8. Set up a profile in the UI, or import your local backup via the authenticated restore endpoint. Before any restore export the existing cloud state. Rotate the access key if it was exposed.

If your deployment's hostname changes, update `ROLE_TRAIL_ORIGIN` and redeploy. Preview URLs need their own matching origin. A missing auth config returns 503; it never exposes private data as a fallback.

## Agent access and data migration

Set `ROLE_TRAIL_URL` to your HTTPS origin and `ROLE_TRAIL_ACCESS_KEY` in the agent's private runtime environment. Never put the key in the URL or CLI arguments.

```sh
node bin/role-trail.mjs state --remote
node bin/role-trail.mjs import --remote --file /private/research.json
node bin/role-trail.mjs draft --remote
node bin/role-trail.mjs export --remote --output /private/cloud-backup.json
node bin/role-trail.mjs restore --remote --file /private/local-backup.json --revision CURRENT_REVISION
```

`state` prints private content: inspect locally, not in public CI logs. File exports refuse to overwrite files. Read the revision before restore; restore is intentional replacement, not a research merge.

If Vercel Deployment Protection blocks a machine client, use your organization's approved authenticated access route or host tooling. This CLI does not disable protection or configure a bypass automatically. Test that route before enabling cloud scheduling.

## Required acceptance in your account

- Unauthenticated `GET /api/state` returns 401 (or Vercel's outer protection), with no profile, jobs or resume content.
- Login works on the exact origin. A cookie is HttpOnly, Secure, SameSite=Strict and expires; key rotation invalidates it.
- A bad Origin write is denied. Two clients using one revision cannot both write.
- Create a synthetic job, shortlist it, check a task, generate a resume and reload. Confirm persistence from a second agent/API client.
- Backup, then restore a synthetic workspace. Invalid JSON/schema/revision must leave the previous data intact.
- A bounded source run is saved with actual coverage. No private state or credential appears in static assets or Git history.

The repo verifies the handler and PostgreSQL behavior locally and in CI. That does not prove your Vercel domain, environment settings, database permissions or provider accounts are configured correctly. Record your deployment URL and the actual results in a private setup report.

## Size and runtime boundaries

Cloud state is capped at 3.5 MB serialized UTF-8, including jobs and resume versions, to keep responses below [Vercel's function payload limit](https://vercel.com/docs/functions/limitations). Oversized writes fail before commit. Local mode supports 15 MB; keep private backups and split/export a workspace when approaching these limits. API bodies accept Vercel's [pre-parsed request body](https://vercel.com/docs/functions/runtimes/node-js) as well as the local Node request stream.
