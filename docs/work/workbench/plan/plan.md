# Plan: Complete portable workbench

## Plan

- Format: canonical-v2
- Concurrency: 1
- Intent: Ship working configurable core features instead of delegating their implementation to users.
- Scope: Generic state contracts, atomic local and PostgreSQL storage, authenticated API, responsive workbench, source collectors, resumes/PDF, recurring runner, Vercel setup and verification.
- Non-goals: Automatic applications, paid account changes, publishing private data, guaranteed access to third-party job boards.

## Sources

- user: complete-public-workbench-2026-11-05
- local: ../../../../AGENTS.md
- local: ../../../../docs/setup-parity.md

## Tasks

### T01 | Executable portable workflow

- Status: done
- Depends On: []

#### Intent

Implement and verify the usable local workflow, with shared cloud adapter and deployment instructions.

#### Expected Result

Users configure preferences and their own accounts; no core feature rewriting is required.

#### Definition of Done

- Isolated synthetic tests prove storage conflicts, invalid imports, research/personal separation, resume staleness, auth and source failures.
- Browser workflow supports JD, filtering, decisions/archive, tasks, resume review and history at mobile/desktop sizes.
- CLI supports data import/export, collection, resume generation and recurring manual/daemon operation.
- Vercel adapter and setup are shipped; unavailable external environment checks remain explicit.

#### Verification

- npm test
- npm audit
- npm run build
- npm run test:ui
- Standalone clean installation, real PostgreSQL transaction tests and synthetic PDF visual inspection

#### Verification Evidence

- PASS | local:../implement-report.md | npm test
- PASS | local:../implement-report.md | npm audit
- PASS | local:../implement-report.md | npm run build
- PASS | local:../implement-report.md | npm run test:ui
- PASS | local:../implement-report.md | Standalone clean installation, real PostgreSQL transaction tests and synthetic PDF visual inspection

## Change Log

- 2026-11-05: Execute full workbench scope; retain actual platform limitations.

- 2026-11-05: Implementation and local acceptance complete; account-specific deployment and actual future schedule triggers remain explicitly scoped installation checks.
