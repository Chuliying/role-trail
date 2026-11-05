# Plan: Personal agent onboarding

## Plan

- Format: canonical-v2
- Concurrency: 1
- Intent: A new user configures preferences and Vercel, then their scheduled LLM executes the documented job-search workflow.
- Scope: Trusted skill, onboarding and daily prompts, current-state work packets and completion checks, persisted interview preparation, natural user documentation, synthetic end-to-end verification.
- Non-goals: Copy private data or credentials, switch the maintainer's production installation, claim a third-party account or future trigger was verified without observing it.

## Sources

- user: onboarding-preferences-vercel-llm-schedule-clarification
- local: ../../../../BOOTSTRAP.md
- local: ../../../agent-workflow.md

## Tasks

### T01 | Persist and check the agent's work

- Status: done
- Depends On: []

#### Intent

Give the host model current inputs and verify saved results rather than treating a prompt as completed work.

#### Expected Result

CLI emits bounded work packets, checks coverage and shortlist deliverables, and stores versioned preparation with source bindings.

#### Definition of Done

- Synthetic end-to-end run saves research, assessments, resumes and preparation while preserving decisions.
- Missing results and changed sources are detected; private outputs stay outside Git.

#### Verification

- npm test
- npm run test:ui

#### Verification Evidence

- PASS | local:../implement-report.md | npm test
- PASS | local:../implement-report.md | npm run test:ui

### T02 | Ship onboarding and scheduled skill

- Status: done
- Depends On: [T01]

#### Intent

Make the existing host LLM perform the workflow after deployment and scheduling setup.

#### Expected Result

A bundled skill and readable prompts cover user preferences, authorized sources, deployment, real host registration, daily research, resumes, preparation and completion checks.

#### Definition of Done

- No maintainer-specific identity, preference, account or secret is copied.
- Docs distinguish host LLM scheduling from feed-only collection and actual installed trigger evidence.
- Humanizer preserves commands, constraints and factual limits.

#### Verification

- npm run build

#### Verification Evidence

- PASS | local:../implement-report.md | npm run build

### T03 | Independently exercise the workflow

- Status: done
- Depends On: [T02]

#### Intent

Have a fresh agent run the shipped instructions with synthetic inputs.

#### Expected Result

Behavioral review validates saved outputs and reports unsupported environment claims.

#### Definition of Done

- Independent findings resolved; tests and secret preflight pass.
- Report real execution separately from untested deployment/account/trigger setup.

#### Verification

- npm test
- npm run test:ui
- npm audit

#### Verification Evidence

- PASS | local:../implement-report.md | npm test
- PASS | local:../implement-report.md | npm run test:ui
- PASS | local:../implement-report.md | npm audit

## Change Log

- 2026-11-05: Scope clarified around onboarding and host LLM operation, not migration of existing private data.
