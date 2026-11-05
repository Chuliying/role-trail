# Implementation evidence

## Scope

The public installation now has a bundled host-agent workflow: preferences and confirmed evidence → private Vercel/PostgreSQL setup → real host LLM task registration → research, assessment and shortlisted preparation → persisted results for review. The feed runner remains a separate collector. No private installation was migrated or changed.

## Changes

- Added `searchNotes` and `requiredChecks` to user profiles and collector unknown checks.
- Added `workflow` packets from current state and `work-check` reports for saved runs, coverage, personal-state changes and shortlist deliverables.
- Added versioned preparation documents bound to the exact JD, resume and confirmed evidence snapshot; displayed them in the job dialog with staleness checks.
- Added the onboarding/daily/shortlist skill and daily prompt. Humanized README and setup documentation while retaining limits and operational requirements.

## Executed checks

- Node22: `npm test` — 36 passed, zero skipped, including an isolated PostgreSQL 17 cluster. Preparation survives a second DB client with canonical JSON hash bindings.
- `npm run test:ui` — 5 passed. Includes preparation display and stale state after a new resume version, mobile overflow, tasks, decisions, safe JD rendering and existing review flows.
- `npm run build` and `npm run format:check` — exit 0.
- `npm audit` — zero known vulnerabilities.
- Skill creator `quick_validate.py skills/role-trail` — valid. PyYAML was installed only in a temporary validation virtualenv after the initial environment lacked it.
- Secret preflight — exit 0 across manifest roots including new skills/prompts. Three existing suppressed synthetic-test candidates remain; scanner is heuristic, not a security guarantee. Auth code was not changed.

## Independent sandbox run

A fresh agent followed the public onboarding/daily/shortlist instructions in a temporary workspace using a synthetic London data-analyst profile, exact-author Git history and JD. It used shipped CLI/API commands, then inspected the browser and rendered PDF. The primary agent checked the saved reports, API responses, PDF image and app screenshot.

- Initialized user-specific preferences and scanned only the selected synthetic Git author; saved explicitly synthetic confirmed evidence.
- Saved one research run and role, bound assessment, two resume versions (starting draft and tailored version), one preparation document and tasks. Both daily and shortlist completion checks passed; source coverage remained partial/not_run, and allSourcesSearched remained false.
- Repeated import preserved one run/role. Changing the payload under an existing run ID was rejected. Existing completed tasks stayed complete; the resume stayed pending and submissions stayed empty.
- API checks returned 409 for an old revision and 400 for stale assessment/preparation bindings. A mixed valid/invalid import left state unchanged. A 501-job payload was rejected.
- The actual app showed the saved resume and preparation after reload without page errors. Chromium PDF output was one A4 page; text extraction and visual inspection succeeded.
- Found and fixed a documentation gap: direct local API writes require `X-Role-Trail: 1`. The reviewer followed the corrected curl example and received HTTP 200; a same-content retry kept revision 11.
- Test servers were stopped. Artifacts remain in the private temporary sandbox, not in public Git. No real user credentials, accounts, research, deployments or recurring services were used. These are isolated test data/workspaces, not an operating-system security sandbox.

## Execution checklist

- [x] Current-state packet, persisted preparation and completion checks implemented and tested.
- [x] Onboarding, daily and shortlist skill validated; documentation wording and relative links reviewed.
- [x] Independent synthetic forward test completed; its one documentation finding corrected and independently retested.
- [x] Tests, build, format, dependency audit and scoped secret preflight executed.
- [ ] Real new-user cloud accounts and timed host trigger: per-installation acceptance, not claimed here.

## Limits

Local/DB/browser tests cannot establish a user's Vercel configuration, source-account availability, actual host scheduling capability or a future timed trigger. Those stay per-installation checks. Work-check validates stored records and bindings, not factual truth, PDF appearance or exhaustive platform search. Original PDF bytes and full research payload history are not archived in the database; existing private tracker migration remains a separate project.
