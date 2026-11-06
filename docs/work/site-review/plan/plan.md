# Plan: Site review, configuration and desktop layout

## Plan

- Format: canonical-v2
- Concurrency: 1
- Intent: Review actual application boundaries, fix reproduced interaction errors, separate settings from logic and improve desktop scan density.
- Scope: Shared public runtime, JSON catalogs, desktop layout, synthetic tests and private wrapper pin.
- Non-goals: Framework migration, private data changes, credential changes, new searches or automatic applications.

## Sources

- user: 2026-11-06-site-review-and-json-configuration-desktop-layout
- local: ../../../../AGENTS.md
- local: ../../../../docs/single-runtime.md
- repo: private-wrapper@../chuliying-job-board

## Tasks

### T01 | Interaction integrity

- Status: done
- Depends On: []

#### Intent
Repair failed-save controls, modal errors, IME composition and out-of-order snapshots.

#### Expected Result
The UI reflects persisted state and preserves editing input.

#### Definition of Done
- Five reproduced failures pass in Chromium and WebKit.

#### Verification
- npx playwright test tests/browser/state-integrity.spec.mjs
- npx playwright test tests/browser/state-integrity.spec.mjs --browser webkit

#### Verification Evidence

- PASS | local:../implement-report.md | npx playwright test tests/browser/state-integrity.spec.mjs
- PASS | local:../implement-report.md | npx playwright test tests/browser/state-integrity.spec.mjs --browser webkit

### T02 | Declarative configuration

- Status: done
- Depends On: [T01]

#### Intent
Centralize public source definitions, feed options, UI vocabulary, verification presentation and translations with validation.

#### Expected Result
Server, browser and agent packets consume the same catalogs. Private preferences and credentials remain separate.

#### Definition of Done
- Twelve discovery sources are declared; no default personal preferences are introduced.
- Browser configuration is generated and included in versioning and deployment assets.
- Invalid catalogs fail build; unknown adapters cannot execute.
- Settings documentation states what remains executable policy and code.

#### Verification
- node --test tests/configuration.test.mjs
- npm run build

#### Verification Evidence

- PASS | local:../implement-report.md | node --test tests/configuration.test.mjs
- PASS | local:../implement-report.md | npm run build

### T03 | Desktop layout

- Status: done
- Depends On: [T02]

#### Intent
Use a centered maximum width and compact toolbar, while retaining the mobile card layout.

#### Expected Result
Header and content share edges; text columns have useful widths and controls remain accessible.

#### Definition of Done
- Desktop 1440/1920 and mobile 390 layouts have no overflow.
- Desktop toolbar fits one row, table retains readable role titles.
- Synthetic screenshots are inspected.

#### Verification
- npx playwright test tests/browser/desktop-layout.spec.mjs

#### Verification Evidence

- PASS | local:../implement-report.md | npx playwright test tests/browser/desktop-layout.spec.mjs

### T04 | Verification and delivery

- Status: in_progress
- Depends On: [T03]

#### Intent
Record honest review findings, verify shared runtime and deliver the same version to the private installation.

#### Expected Result
Public source and private deployed runtime match, with no user-data writes.

#### Definition of Done
- Full suites, formatting, audit and scoped secret scan succeed.
- Review report distinguishes fixed bugs, residual debt and framework-specific N/A.
- Private wrapper verifies exact assets and guarded deployment receipt.

#### Verification
- npm test
- npm run build
- npm run test:ui
- npm run format:check
- npm audit

## Change Log

- 2026-11-06: Review expanded by user to declarative source/site configuration and desktop layout.

- 2026-11-06: Added M PLUS U branding, shared tool popover, bidirectional historical-score sorting and immediate decision-save feedback. T01–T03 verified; delivery remains T04.
