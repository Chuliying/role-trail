# Plan: Shared verification UI

## Plan

- Format: canonical-v2
- Concurrency: 1
- Intent: Use one verification component in public and private workbenches.
- Scope: Evidence gates, icon vocabulary, accessible controls, shared CSS and pinned delivery.
- Non-goals: Changing stored qualifications, personal preferences, decisions or databases.

## Sources

- user: unify-public-private-verification-icons
- local: ../../../setup-parity.md

## Tasks

### T01 | Share and integrate verification presentation

- Status: done
- Depends On: []

#### Intent

Remove separate icon implementations without hardcoding a user's preferences into the public app.

#### Expected Result

Both apps use the same component, evidence gate and styles; custom checks keep their labels.

#### Definition of Done

- Known checks map to semantic icons; custom keys remain visible and accessible.
- Positive dated evidence is required; future, unknown, excluded and expired facts are not badges.
- Mouse, keyboard and touch can open the corresponding evidence.

#### Verification

- npm test
- npm run test:ui
- npm run build

#### Verification Evidence

- PASS | local:../implement-report.md | npm test
- PASS | local:../implement-report.md | npm run test:ui
- PASS | local:../implement-report.md | npm run build

### T02 | Synchronize and verify protected delivery

- Status: in_progress
- Depends On: [T01]

#### Intent

Make the verified common source available in both repositories and the private deployment.

#### Expected Result

Pinned source/hash checks cover the shared component and CSS; protected live assets match.

#### Definition of Done

- Public and private changes pushed; private alias READY and protected.
- No personal-state changes or private artifacts committed.

#### Verification

- npm audit

## Change Log

- 2026-11-05: User identified that the private icons and public generic checkmarks were not unified.
