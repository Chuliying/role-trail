# Plan: Complete the four site review findings

## Plan

- Format: canonical-v2
- Concurrency: 1
- Intent: Finish the four remaining findings with regression evidence and shared delivery.
- Scope: Editor recovery, conditional reads and mutation deltas, modular frontend/styles, URL navigation, requested layout polish and bilingual interface packs.
- Non-goals: Framework or database migration, changes to personal records, automated job applications.

## Sources

- user: continue-all-four-review-fixes-2026-11-06
- local: ../../site-review/implement-report.md
- repo: private-wrapper@../chuliying-job-board

## Tasks

### T01 | Protect edits and restore navigation

- Status: done
- Depends On: []

#### Intent
Keep unsaved input until explicit discard and make view/filter/sort URLs restorable.

#### Expected Result
Close, Escape and navigation respect unsaved changes; reload and back/forward restore the selected view.

#### Definition of Done
- Dirty editor close prompts; cancel preserves values; successful save clears the guard.
- Supported URL fields are validated, normalized and reflect browser history.

#### Verification
- npx playwright test tests/browser/navigation-editor.spec.mjs

#### Verification Evidence

- PASS | local:../implement-report.md | npx playwright test tests/browser/navigation-editor.spec.mjs

### T02 | Reduce repeat payloads

- Status: done
- Depends On: [T01]

#### Intent
Avoid retransmitting unchanged workspace data and whole collections for small writes.

#### Expected Result
Conditional GET returns 304 and opt-in mutation delta responses merge safely against the exact base revision. Full API/export remains compatible.

#### Definition of Done
- Delta paths preserve all untouched entities and reject mismatched bases.
- A synthetic large workspace records full versus conditional versus mutation bytes.
- Authentication and revision protections are unchanged.

#### Verification
- node --test tests/sync.test.mjs

#### Verification Evidence

- PASS | local:../implement-report.md | node --test tests/sync.test.mjs

### T03 | Separate frontend responsibilities and consolidate styles

- Status: done
- Depends On: [T02]

#### Intent
Extract transport/state, editor, navigation, shared DOM primitives and page renderers. Remove shadowed CSS declarations without changing computed layout.

#### Expected Result
Application entry coordinates modules; styles have explicit layers/files and preserve mobile/desktop behavior.

#### Definition of Done
- No circular dependencies or duplicated renderer implementation.
- Computed style characterization matches before/after cleanup.
- Modules are in local/deployed asset allowlists and entry version hashing.

#### Verification
- npm run test:ui
- npm run build

#### Verification Evidence

- PASS | local:../implement-report.md | npm run test:ui
- PASS | local:../implement-report.md | npm run build

### T04 | Deliver the shared runtime

- Status: done
- Depends On: [T03]

#### Intent
Verify, document and synchronize the public runtime and protected private deployment.

#### Expected Result
All four findings have code, regression evidence and a matching live runtime.

#### Definition of Done
- Full tests, formatting, audit and secret preflight pass.
- Public push, private pin/parity and protected deployment checked.

#### Verification
- npm test
- npm run format:check
- npm audit

#### Verification Evidence

- PASS | local:../implement-report.md | npm test
- PASS | local:../implement-report.md | npm run format:check
- PASS | local:../implement-report.md | npm audit

## Change Log

- 2026-11-06: User authorized finishing all four findings, retaining the existing shared-runtime delivery path.

- 2026-11-06: Added viewport-centered sticky header, compact right-aligned filters, grouped counts, cell/icon alignment, smaller mobile scores with interactive evidence, and persistent English/Traditional Chinese packs. Existing daily-trigger failure was diagnosed read-only and documented privately.
