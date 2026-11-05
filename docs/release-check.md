# Version 0.2 release evidence — 2026-11-05

The public repository has an independent history. This update contains original generic code and synthetic fixtures, not the private installation's database, resumes, credentials, deployment IDs or source history.

## Executed verification

- 23 Node22 tests pass and cover actual Git histories, standalone CLI copying, profile/feed preservation, state validation, old-JD preservation, decisions/closures, resume staleness, provider success/failure shapes, daily scheduling and HTTP authentication.
- Real PostgreSQL 17 isolated temporary cluster: two client writes at one revision produce one success; invalid action rolls back; state persists across clients; restore increments revision.
- 3 Playwright desktop/mobile tests pass: JD rendering and safe text, default ordering, shortlist, archive, checkbox persistence, resume generation/approval, profile navigation and long-URL wrapping. Screenshots inspected at 390 px width.
- Synthetic resume rendered by Chromium to A4 PDF. Poppler confirmed one page, selectable text and no PDF JavaScript; page image inspected. This is a fixture result, not an assertion that arbitrary long resumes fit one page.
- Build entry checks and npm audit run before release. See CI for the exact pushed revision.

## Live source probes (not fixtures)

- Himalayas: two search pages, 40 returned roles with description content accepted. Country/eligibility and fit were not inferred. Findings were not imported into a real person's workspace.
- Greenhouse: a valid public employer board returned 145 postings; the configured cap accepted the first 100 with full content. The board endpoint is unfiltered; this is not 100 recommended opportunities.
- Initial invalid/unavailable employer identifiers were recorded as blocked. Lever probes for the attempted identifiers returned 404; they do not prove a valid live Lever board currently works. Parser behavior remains covered by fixture tests.
- SerpApi: tested with synthetic provider responses. No private maintainer API key was copied into this release or used as public setup evidence.

Live probes are point-in-time retrieval tests, not job recommendations or guarantees of ongoing access. A provider key being present is not a successful search.

## Per-installation checks

No newly provisioned Vercel/Neon deployment, user account activation, real Claude Code/Codex host task or future timed trigger is claimed by this release. Those require the installing user's accounts and environment. The executable API, DB adapter, migration, daily loop and cloud workflow template are included and tested within the boundaries above.

Local storage supports 15 MB serialized state; the cloud adapter supports 3.5 MB to fit function payload limits. A rejected import keeps previous data. This version is single-owner, not multi-tenant.

## Publication gate

Before push: all tests/build/browser checks pass, dependency audit reports no known vulnerabilities, a scoped secret scan and manual private-data review pass, and only source/config/docs/synthetic tests are staged. Scanning is heuristic, not proof that every possible secret representation can be detected. CI uses read-only permissions, synthetic database data and pinned checkout/setup-node actions.

Final secret preflight examined the public source/config/docs/tests. Three suppressed candidates were manually reviewed in synthetic CLI/onboarding tests; no real key was identified. The working tree was also checked for private paths, deployment identifiers and personal source data.

## Independent-review corrections — 2026-11-05

The original release's passing tests did not cover stale assessment reuse, Applied-history loss, evidence expiry, repeated drafting or import retries. Subsequent independent review also caught late assessment input bindings and PostgreSQL JSON key-order differences. These issues were reproduced, fixed and independently rechecked.

Verification at that correction: 31/31 Node tests (including real isolated PostgreSQL), 4/4 browser tests, build and formatting pass; npm audit reports zero known vulnerabilities. See [correction evidence](work/review-corrections/implement-report.md) and [migration limits](migration.md). This replaces neither per-installation acceptance nor a full lossless-migration test.


## Agent onboarding and preparation — 2026-11-05

The bundled skill now connects personal preferences, deployment guidance, host LLM scheduling and persisted daily/shortlist work. Current automated checks: 36/36 Node tests (zero skipped, including isolated PostgreSQL), 5/5 browser tests, build, formatting and skill validation pass. Dependency audit reports zero known vulnerabilities.

A separate agent exercised a synthetic London data-analyst installation with a fresh workspace and Git history. It saved research, assessments, tailored resumes and preparation, rendered a one-page A4 PDF, and checked browser persistence. Failed/unexecuted sources remained visible. Retry/conflict/stale-binding/invalid-batch checks preserved state. One missing direct-API header in the documentation was found and corrected. See [implementation and sandbox evidence](work/agent-onboarding/implement-report.md).

These are isolated local tests. No new Vercel account, live search-provider account or real timed LLM trigger was verified, and no existing private installation was changed.
