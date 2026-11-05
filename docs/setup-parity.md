# Shipped workflow and installation acceptance

Version 0.2 ships the reusable core. The maintainer's private installation is not a dependency.

| Capability | Shipped and verified in this repo | Per-user acceptance |
| --- | --- | --- |
| Profile and selected Git evidence | Initialization, author allowlist, bounded metadata/patch export, injection boundaries, standalone CLI tests | Confirm personal authorship and authorized sources |
| Fit / eligibility / decisions | Independent persisted fields; evidence-backed assessment validation; unknown/closed/excluded handling | Agent assesses actual fit and verifies factual requirements |
| Workbench | Responsive table, JD dialog, filters/sort, source links, decisions, archive, todo, resume review, coverage, profile and backup | Open in the user's browser and verify their installation |
| Resume pipeline | Confirmed-claim draft, adjustments, versioning, stale JD/profile/capability detection, local PDF command and private print view | User reviews facts; host agent refines wording and checks final PDF |
| Collectors | Himalayas, Greenhouse, Lever, optional SerpApi Google Jobs; bounded runs and explicit failures | Valid employer slugs, provider accounts and geography-specific queries |
| Daily runner | Timezone-aware daemon/tick, durable daily reservation, concurrency test, cloud tick endpoint and optional workflow | Activate one actual host/process/workflow; observe its later timed execution |
| Local / PostgreSQL | Atomic file writes, revision conflict, locked DB transaction, migration, rollback, backup/restore | Own DB credentials and backups |
| Vercel | Static frontend, Node API entry, routing config, authentication, same-origin policy and setup guide | Own deployment build, domain/origin, secrets and runtime verification |

Qualitative analysis remains agent-assisted by design: your existing Claude Code or Codex model interprets evidence and writes supported assessment/resume actions. No second model API subscription is required for that workflow. The built-in deterministic resume drafter is an editable starting point, not a claim that keyword ranking understands your entire career.

## Tested evidence

See docs/release-check.md for the exact verification results. Synthetic fixtures cover a user-independent local workflow and real PostgreSQL persistence. Live source probes are recorded separately; fixtures cannot establish third-party uptime or a user's paid/free account state.

## Deliberate limits

- Single owner/workspace per database; not a multi-tenant service.
- Local state is limited to 15 MB serialized UTF-8. Cloud state is limited to 3.5 MB to stay below the host's function payload limits. Exceeding the cap rejects the whole write and preserves prior data. Export to local storage or a separate workspace before reaching the limit. No automatic deletion of old records.
- Automatic source acquisition is bounded and source-specific; unsupported platforms require host research/import. No bypass of access restrictions and no all-platform completeness promise.
- The repo cannot create a real Codex/Claude task in another person's host, verify their account, or observe their future trigger from a generic download. The shipped prompt performs and records those steps in that environment.
- Local PDF generation requires Chromium; cloud uses authenticated printable HTML rather than bundling Chromium into a serverless function.

These are explicit operational boundaries. Users do not need to implement a missing dashboard, storage layer, resume handler or scheduler loop to use the shipped core.

## Review corrections and migration boundary

The independent review of the initial 0.2 release found gaps that its original tests did not cover. Regression coverage now includes:

- A changed JD, profile or capability invalidates the current fit assessment. Its previous score and rationale remain available as history; the list excludes stale scores from sorting and minimum-score filters. New assessments must carry the JD/profile/confirmed-capability hashes issued by `evaluate` or the UI editor. The server rejects late results after any bound input changes. Older assessments without those bindings are shown as stale until reassessed.
- Positive opening evidence expires after 7 days; positive qualification evidence after 30 days. Missing or future timestamps cannot produce verified icons. Expiration does not clear a closed/excluded finding. These are fixed product defaults, not platform guarantees.
- Explicit Applied decisions create a separate submission record that survives moving to Passed or archiving. `recordedAt` records the user's report, not a guessed application date. An older workspace's still-Applied decisions are retained as `legacy` records on its next mutation; already overwritten decisions cannot be reconstructed.
- Automatic drafting keeps current pending/approved versions. Missing, stale and changes-requested drafts can produce new versions. Users can explicitly edit a resume to create a revision.
- Newly imported research runs store a canonical payload hash. Retrying the same run ID with the same content is a no-op; changed content is rejected. Old runs without a hash remain conservatively non-retryable. This is not a full immutable research-bundle archive.

These fixes do not establish drop-in compatibility with another job tracker. Before migrating an existing installation, use the [migration checklist](migration.md). In particular, this version has no importer for legacy tracker schemas, stored original PDF bytes, interview preparation packs or full research ledgers. It stores the criteria supplied for a role; it does not enforce a user's complete required-check set. A confirmed icon is evidence for that one supplied criterion, not proof of every hiring requirement.

Structural hashes use sorted JSON object keys in both the browser and server, so a PostgreSQL JSONB round trip does not change an input binding. Existing resume versions with older incompatible digests are retained and require regeneration/review; the system does not silently reapprove them.
