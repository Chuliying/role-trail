# One runtime, private installations

Maintain application changes in Role Trail. A private installation pins a reviewed public commit in `package.json`; its own repository contains deployment configuration and operational instructions, not a fork of the UI or domain layer. Update the pin and lockfile to upgrade. Keep the previous pin and deployment available until acceptance passes.

A minimal Vercel wrapper has:

- `package.json`: Node 22, a `role-trail` Git dependency pinned to a full commit SHA, and `build: node build.mjs`.
- `build.mjs`: `import {buildDeployment} from 'role-trail/src/deployment.mjs'; await buildDeployment('web');`
- `api/index.mjs`: `export {default} from 'role-trail/api/index.mjs';`
- `vercel.json`: Other framework, build `npm run build`, output `web`, and rewrite `/api/:path*` to `/api/index`.
- `.gitignore`: `node_modules/`, `web/`, `.vercel/`, `.env*` and all private artifacts.

The generated `web/` contains the same reviewed static files as the dependency. Do not edit it. UI, API, collectors and storage changes belong upstream. Keep the package license and attribution. New users can also deploy a fork of the source repository directly; it runs the same application.

## Authentication

The default remains the access-key and session mode in [Vercel setup](vercel.md). A dedicated private installation may instead use `ROLE_TRAIL_AUTH=vercel-protected`, with `ROLE_TRAIL_PROTECTED_PROJECT_ID` equal to Vercel's `VERCEL_PROJECT_ID`. This requires `VERCEL=1` and a matching project at runtime. It trusts Vercel's outer authentication, never a client request header.

Only use this mode when a deployment guard verifies that **all deployments**, including previews, require Vercel Authentication before and after release. Retain that guard and private repository visibility. If the project cannot enforce this boundary, use the default application key instead. Do not enable this mode on a publicly accessible deployment. `ROLE_TRAIL_ORIGIN` must be the exact permitted HTTPS origin. Protect machine access through the same approved host tooling; do not disable protection for automation.

## Existing job-board PostgreSQL installation

This is a one-time converter, not a parallel legacy runtime. Use Node 22 and supply the source `DATABASE_URL` through the existing runtime secret mechanism. No keys belong in arguments or files. Keep exports outside every Git working tree with owner-only permissions.

1. Run `legacy-export --output /private/snapshot.json`. This captures the state, every research bundle, decision, PDF version, submission, preparation and evidence row in one repeatable-read transaction.
2. Prepare `/private/profile.json` from the owner's existing preferences. It must satisfy the normal profile contract. Do not insert maintainer preferences into someone else's installation.
3. Run `legacy-preview --file /private/snapshot.json --profile /private/profile.json --output /private/preview`. Inspect the report, state and artifacts. Check ID collisions, orphan references, exact PDF hashes, shared task relations and all review states. The old database is still authoritative.
4. Test the canonical application with synthetic data. Verify the pinned deployment wrapper, database connection and authentication configuration before cutting over. Export again if the source revision changed.
5. Run `legacy-migrate --file /private/snapshot.json --profile /private/profile.json`. The transaction requires an empty canonical destination and exactly the exported source revision. It locks all legacy tables and checks every source row against the snapshot, including independent decision and resume updates. It inserts artifacts and state, then installs write-blocking triggers on the old tables. It retains the old rows unchanged. A conflict or error rolls everything back.
6. Deploy the pinned runtime, verify authenticated reads and original PDFs, and update the **existing** host automation to use this CLI and its current profile. Do not create another recurring task or run both writers. Old writers fail with an explicit migration message.
7. Compare live counts, decisions, tasks, versions, timestamps, source evidence and every artifact hash with the preview. Record the deployment and timed-trigger checks separately.

Legacy scores remain historical/stale when the original assessment lacked reproducible input bindings. Imported documents retain their original review state and their original JD/PDF bindings; migration does not newly approve claims or applications. Evidence cards become proposed capability records for review. Their existing preparation snapshots remain preserved. A shared task remains one task across all linked roles. Date-only checks do not gain invented time precision.

## Operations and recovery

Use `--database` with a runtime `DATABASE_URL` for direct PostgreSQL CLI operations. Use `--remote` for application-key API access, or `--workspace` for local state. These modes use the same transitions and collectors.

`backup --database --output /private/backup-directory` writes state and every referenced PDF, research and migration artifact. State-only `export` is convenient for agent work, but is not a full artifact backup. Keep the pre-cutover source snapshot as well.

Before cutover, recovery is simply leaving the old installation active. After cutover, never point the old app at writable legacy tables without reconciling newer canonical writes. Restore the saved database and previous protected deployment only through an explicit recovery procedure; removing write guards alone would split the source of truth. No history is deleted by migration.

The application does not turn a feed timer into an LLM. Preserve the existing host automation ID, time zone, schedule and notification policy. Its prompt must read the canonical profile, skill and current revision, execute research, import results, and run `work-check`. A manual acceptance run is not proof of a future timed trigger.
