# Plan: Review corrections

## Plan

- Format: canonical-v2
- Concurrency: 1
- Intent: Fix reproduced misleading review signals and destructive workflow behavior.
- Scope: Stale scores and facts, application record retention, safe resume batch regeneration, tests and migration limits.
- Non-goals: Production migration, private records, new providers or automatic applications.

## Sources

- user: requested-independent-review-and-migration-assessment
- local: ../../../setup-parity.md

## Tasks

### T01 | Correct reproduced regressions

- Status: done
- Depends On: []

#### Intent

Preserve history without treating stale evidence as current.

#### Expected Result

Changed JD/profile/evidence invalidates scores; positive facts expire; Applied records survive decision changes; batch drafts keep current pending/approved versions.

#### Definition of Done

- Synthetic regressions fail before changes and pass afterward.
- Independent reviewer checks the final diff.
- Document migration boundaries without claiming parity.

#### Verification

- npm test
- npm run build
- npm run test:ui
- npm audit

#### Verification Evidence

- PASS | local:../implement-report.md | npm test
- PASS | local:../implement-report.md | npm run build
- PASS | local:../implement-report.md | npm run test:ui
- PASS | local:../implement-report.md | npm audit

## Change Log

- 2026-11-05: Created after independent review reproduced missing regression coverage.
