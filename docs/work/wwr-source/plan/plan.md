# Plan: WWR source

## Plan

- Format: canonical-v2
- Concurrency: 1
- Intent: Add an opt-in public WWR RSS collector and enable the selected categories in the existing private schedule.
- Scope: Bounded RSS parsing, source configuration, conservative provenance, documentation, shared preferences and deployment.
- Non-goals: Freelance marketplaces, automatic eligibility decisions, changing personal progress.

## Sources

- user: go-add-wwr-20261106
- external: https://weworkremotely.com/remote-job-rss-feed
- repo: private-wrapper@../chuliying-job-board

## Tasks

### T01 | collect-and-enable

- Status: done
- Depends On: []

#### Intent

Fetch configured WWR categories without login and preserve unverified status.

#### Expected Result

A tested collector used by the private profile and existing daily automation.

#### Definition of Done

- Bounded feeds, attribution, deduplication and partial/error coverage tested.
- Source-only preference changes preserve prior assessment freshness and document bindings without refreshing factual evidence.
- Activation commands and preservation requirements are documented; private installation records its actual shared configuration and deployment receipt separately.

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

- 2026-11-06: Created for the approved WWR source addition.
