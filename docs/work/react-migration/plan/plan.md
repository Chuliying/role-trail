# Plan: React workbench migration

## Plan

- Format: canonical-v2
- Concurrency: 1
- Intent: Replace imperative frontend rendering with React and typed reusable components; fix clipped Shortlisted actions.
- Scope: Public runtime frontend, build/static distribution, regression tests, private dependency pin and protected deployment.
- Non-goals: Backend rewrite, new database, changing user data or decisions, new scheduler, public portfolio deployment.

## Sources

- user: 2026-11-06 approved full React migration, Shortlisted action fix and final Claude Code review.
- local: AGENTS.md
- local: web/modules.json
- repo: runtime@/Users/Chuliying/role-trail
- repo: deployment@/Users/Chuliying/chuliying-job-board

## Tasks

### T01 | React runtime and regression parity

- Status: completed
- Depends On: []

#### Intent

Use React and TypeScript to own shell, jobs, detail tabs, filters, score popovers, preparation, profile, research and editors. Preserve existing API contracts and shared state. Remove old imperative view renderer after migration. Route all frontend GET and POST operations through TanStack React Query; separate API/cache, navigation, shared UI and feature responsibilities.

#### Expected Result

One frontend source for CLI and protected Vercel deployment. Common controls handle focus, pending, errors and responsive layout. Shortlisted decisions remain readable beside resume and source links.

#### Definition of Done

- React components and lifecycle own UI rendering; no DOM-to-React wrapper around old views.
- GET queries and POST mutations share one revision-safe workspace cache; writes have immediate pending feedback, synchronous duplicate guards and no automatic retry.
- File boundaries express responsibilities without duplicating domain logic or backend contracts.
- All current user flows survive; mobile/desktop theme and language support preserved.
- No changes to private state or secrets; synthetic tests only.
- Files: frontend sources, web generated assets/module manifest, build scripts, dependency manifests, UI styles, tests, architecture documentation and project manifest as needed.

#### Verification

- Observe Shortlisted regression fail before fix; test Chinese and English decision labels with multiple actions.
- Typecheck, npm test, npm run build, npm run test:ui, format check and npm audit.
- Spec compliance review, then code quality review; preserve behavioral assertions.

### T02 | Claude Code review and delivery

- Status: in_progress
- Depends On: [T01]

#### Intent

Obtain requested Claude Code review of final code and fixes, then deliver one shared runtime.

#### Expected Result

Public code pushed and private wrapper pinned to reviewed runtime; protected deployment READY with validated asset and state parity.

#### Definition of Done

- Reviewer findings resolved or explicitly documented; no false claim of CC review if unavailable.
- Scoped commits and secret scan; private unrelated files preserved.
- Fixed private URL serves new bundle without changing authentication or user records.

#### Verification

- Actual CC response and independent review evidence.
- Public tests, private build/test/audit, deployment receipt and authenticated asset/read-only state checks.

## Change Log

- 2026-11-06: Created migration plan. Baseline public commit 293b8be; 85 Node / 53 browser checks from preceding delivery. Current Shortlisted fixed-width actions can squeeze the decision label.

- 2026-11-06: Added user requirements for React Query reads/writes, pending states, duplicate-write protection and concise SOLID frontend structure. Pre-query spec review passed; final review must include the added scope.

- 2026-11-06: User requested removal of obsolete files with Git recovery. Confirmed all 12 retired browser modules exist in baseline history; added private generated-output cleanup and exact file-inventory regression. CC review completed; addressing its concrete findings before frozen-candidate rerun.

- 2026-11-06: Frozen candidate passed Node85/browser69, typecheck/build/format/audit and clean install. Requested CC Opus5.5 high rereview reports no blockers; delivery proceeds under existing user authorization to synchronize public runtime and private deployment.
