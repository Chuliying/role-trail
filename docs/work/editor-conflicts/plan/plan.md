# Plan: Safe profile and capability edits

## Plan

- Format: canonical-v2
- Concurrency: 1
- Intent: Preserve drafts while reconciling concurrent workspace changes.
- Scope: Profile/capability editors, fresh reads, field comparisons, conflict UI and regression tests.
- Non-goals: Server CAS removal, automatic write retries, changes to personal decisions or other editors.

## Sources

- user: profile-capability-revision-conflict-20261106
- local: ../../../browser-runtime.md

## Tasks

### T01 | Safe editor save

- Status: done
- Depends On: []

#### Intent

Compare the opening base, draft and fresh record; preserve edits and surface conflicts before writes.

#### Expected Result

Disjoint changes merge; conflicting fields require explicit selection; a racing 409 keeps the draft.

#### Definition of Done

- Browser regressions cover merge, conflict selection, repeated races, failed reads and identity/deletion safety.
- Server compare-and-swap remains unchanged. Deployment acceptance is recorded separately in the private wrapper.

#### Verification

- npm test
- npm run typecheck
- npm run build
- npm run test:ui
- npm audit

#### Verification Evidence

- PASS | local:../implement-report.md | npm test
- PASS | local:../implement-report.md | npm run typecheck
- PASS | local:../implement-report.md | npm run build
- PASS | local:../implement-report.md | npm run test:ui
- PASS | local:../implement-report.md | npm audit

## Change Log

- 2026-11-06: Created from the user's concrete concurrency report.
