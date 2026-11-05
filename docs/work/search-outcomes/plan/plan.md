# Plan: Search outcomes and application packages

## Plan

- Format: canonical-v2
- Concurrency: 1
- Intent: Show useful weekly search outcomes and complete, reviewable shortlisted application packages.
- Scope: Shared calculation rules, historical provenance, readiness checks, both workbench adapters, private-site deployment.
- Non-goals: Repo/database migration, changing personal decisions, automatic applications, inventing missing artifacts or verification.

## Sources

- user: clarified-items-1-2-search-quality-and-complete-application-packages
- local: ../../../data-contract.md

## Tasks

### T01 | Compute honest outcomes and package readiness

- Status: done
- Depends On: []

#### Intent

Count unique opportunities and evidence progress instead of touched rows; identify missing application deliverables.

#### Expected Result

Reusable pure calculations with synthetic tests, used by the public and private workbenches.

#### Definition of Done

- Seven local-calendar-day window, historical imports excluded, repeated observations deduplicated, unknown/negative progress separate.
- Resume/PDF, adjustment notes, preparation, tasks, qualification and application status remain independent.

#### Verification

- npm test

#### Verification Evidence

- PASS | local:../implement-report.md | npm test

### T02 | Expose outcomes and packages in the workbenches

- Status: done
- Depends On: [T01]

#### Intent

Let the user inspect the evidence behind counts and review each shortlisted role in one place.

#### Expected Result

Research summary and package overview with working links, tasks and missing-item reasons.

#### Definition of Done

- Browser tests cover desktop/mobile and stale/missing/ready states.
- Private integration references the released shared calculation module.

#### Verification

- npm run test:ui
- npm run build

#### Verification Evidence

- PASS | local:../implement-report.md | npm run test:ui
- PASS | local:../implement-report.md | npm run build

### T03 | Verify and synchronize the private deployment

- Status: in_progress
- Depends On: [T02]

#### Intent

Ship the requested features while retaining all existing records and protection.

#### Expected Result

Public source pushed and private site verified on the fixed URL; no personal decision/progress changes; authorized missing draft artifacts may be added.

#### Definition of Done

- Protected deployment points to tested code; live counts and links verified.
- Existing dirty work and database records preserved.

#### Verification

- npm audit

## Change Log

- 2026-11-05: User corrected scope to search quality and application packages, not repository/database consolidation.
