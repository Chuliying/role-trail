# Review corrections — 2026-11-05

Execution mode: bug-fix. Manifest: vanilla JS, Node tests, browser tests, no typed contract. No new dependencies or visual styling. Review and implementation use synthetic data only; no production migration or schedule change.

## Root causes and observed RED

- Five new domain regressions initially failed: JD/profile/capability scores remained current, positive facts never expired, Applied had no independent record, draft always appended a pending version.
- Browser regression initially failed because a stale score still appeared as current and there was no Reassess label.
- Same-payload retry test failed with Duplicate run ID.
- Independent follow-up found late assessment actions could use a current workspace revision to revive old results. Its regression failed with Missing expected exception.
- Independent follow-up found JSON object insertion order affected hashes. Key-order regression failed with different profile digests; the expanded real PostgreSQL demo failed with Stale assessment binding.

## Changes

Shared browser/server canonical hashing makes object-key order irrelevant while retaining array order. Assessment inputs are bound to JD, profile and confirmed capability evidence; stale or missing bindings cannot be submitted as a new assessment. Old scores remain historical and are excluded from list filtering/sorting until reassessed.

Positive evidence uses 7-day opening and 30-day qualification TTLs. Negative evidence remains archived. Applied reports persist independently of the current bucket. Current pending/approved drafts are no-ops; revisions are generated for missing/stale/changes-requested resumes. Research content hashes support exact same-payload retries and reject changed payloads at the same run ID.

List and detail show stale assessment/resume status and retained application reports. README/setup parity and migration documentation describe the remaining storage, required-policy, artifact, source and operational boundaries.

## Fresh verification

- `npm test`: 31/31 pass, 0 skipped, including isolated real PostgreSQL transaction and demo→read→draft→approve→read→no-op behavior.
- `npm run build`: pass. Static/module assets and serverless entry checked; Tailwind output generated.
- `npm run test:ui`: 4/4 pass. Includes real browser stale-score/fact display, application report retention, resume staleness, editor binding submission, draft no-op, mobile wrapping and existing workflow.
- `npm run format:check`: pass. `npx prettier --check web/status.mjs`: pass.
- `npm audit`: zero known vulnerabilities in the existing lockfile.
- Independent subagent reviewed the final changes and independently ran 31/31 Node tests including real isolated PostgreSQL. No remaining blocking finding in this correction scope. This is not a live deployment or migration acceptance.

A browser assertion briefly matched both list and dialog copies of the same reason; it was scoped to the dialog and the full browser suite reran successfully. No production code was changed to accommodate that selector issue.

## Security and delivery boundary

Secret preflight runs across the manifest roots; three preexisting suppressed synthetic-test candidates remain, with no new credentials. Authentication/session logic is unchanged. The new static status module contains only generic policy/hash helpers. No real profiles, job datasets, PDFs, credentials or private comparison reports are published.

No live-provider reliability, newly provisioned cloud deployment, timed trigger or lossless private migration is claimed. Migration gates remain explicit in docs/migration.md.

## Execution checklist

- Environment/boundaries: PASS; manifest used; root-cause evidence replaces speculative requirements.
- RED/GREEN/REFACTOR: PASS; observed failures above, fresh passing regressions, shared hashing removes drift.
- Full verification: PASS; Node 31/31, browser 4/4, build and formatting.
- Type checking: N/A (vanilla JS manifest).
- UI styling/mockup gate: N/A (no token or layout changes).
