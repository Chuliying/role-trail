# Plan: One Role Trail runtime

## Plan

- Format: canonical-v2
- Concurrency: 1
- Intent: One maintained application for public installations and the existing private workspace.
- Scope: Storage parity, migration, providers, deployment wrapper and existing scheduler.
- Non-goals: Publishing personal data, changing user decisions or applying to jobs.

## Sources

- user: fully-merge-private-and-public
- local: ../../../setup-parity.md

## Tasks

### T01 | Preserve artifacts and full research history in the canonical runtime

- Status: done
- Depends On: []

#### Intent

Preserve artifacts and full research history in the canonical runtime.

#### Expected Result

The public source owns the behavior; private configuration and records remain private.

#### Definition of Done

- Synthetic preservation and conflict checks pass.
- Existing PDFs, history, decisions, review states, task relationships and evidence remain available.
- Delivery reports distinguish tested code from live cutover.

#### Verification

- npm test
- npm run test:ui

#### Verification Evidence

- PASS | local:../implement-report.md | npm test
- PASS | local:../implement-report.md | npm run test:ui

### T02 | Convert the legacy workspace without losing records

- Status: done
- Depends On: [T01]

#### Intent

Convert the legacy workspace without losing records.

#### Expected Result

The public source owns the behavior; private configuration and records remain private.

#### Definition of Done

- Synthetic preservation and conflict checks pass.
- Existing PDFs, history, decisions, review states, task relationships and evidence remain available.
- Delivery reports distinguish tested code from live cutover.

#### Verification

- npm test

#### Verification Evidence

- PASS | local:../implement-report.md | npm test

### T03 | Make the private installation a pinned deployment wrapper

- Status: in_progress
- Depends On: [T02]

#### Intent

Make the private installation a pinned deployment wrapper.

#### Expected Result

The public source owns the behavior; private configuration and records remain private.

#### Definition of Done

- Synthetic preservation and conflict checks pass.
- Existing PDFs, history, decisions, review states, task relationships and evidence remain available.
- Delivery reports distinguish tested code from live cutover.

#### Verification

- npm run build
- npm run test:ui

### T04 | Migrate, deploy, update the existing scheduled workflow and verify

- Status: pending
- Depends On: [T03]

#### Intent

Migrate, deploy, update the existing scheduled workflow and verify.

#### Expected Result

The public source owns the behavior; private configuration and records remain private.

#### Definition of Done

- Synthetic preservation and conflict checks pass.
- Existing PDFs, history, decisions, review states, task relationships and evidence remain available.
- Delivery reports distinguish tested code from live cutover.

#### Verification

- npm audit

## Change Log

- 2026-11-05: Expand from shared UI modules to one canonical runtime; retain legacy data as a rollback backup.
