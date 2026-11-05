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
