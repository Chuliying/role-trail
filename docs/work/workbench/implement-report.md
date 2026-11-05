# Portable workbench implementation

## Outcome

Shipped the reusable local workbench and cloud adapter rather than leaving implementation to each installing agent. Profiles, job research, eligibility, assessments, user decisions, tasks, resumes and schedules use explicit independent records.

## Changes

- Atomic local JSON and PostgreSQL row-lock transactions with revision conflicts and restore validation.
- Generic evidence-preserving research imports, canonical URL identities, closure/exclusion retention and full-JD preservation.
- Responsive Tailwind-built UI with semantic tokens, structured JD dialog, recent-search/score ordering, source links, shortlist/archive, todo and resume review.
- Confirmed-claim resume drafting, adjustment notes, versioning, stale JD/profile/capability detection, authenticated print view and local PDF command.
- Bounded source adapters, truthful coverage, daily timezone-aware runner, concurrency reservation and opt-in cloud workflow template.
- Authenticated Vercel API, migration and own-account deployment instructions; independent clean-install demo.

## Verification

- 23 Node tests pass, including isolated real PostgreSQL 17 and cloud-mode HTTP authentication.
- 3 browser tests pass, covering desktop decisions/resume flow, mobile URL wrapping and hostile JD text rendering.
- Build and dependency audit pass; synthetic A4 PDF rendered and visually inspected.
- Clean copy without installed modules or provider/cloud credentials installs and passes tests/build/audit.
- Live Himalayas retrieval accepted 40 descriptions; valid Greenhouse board accepted the first 100 of 145 rows under its configured cap. These are acquisition checks, not suitable-job counts.
- Secret preflight and explicit private-path/content review performed. Three suppressed candidates were inspected in synthetic tests; none were real credentials.

## Boundaries

No actual new Vercel/Neon provisioning or future host-scheduler trigger is claimed. Live Lever availability and a user's SerpApi account still need installation-specific checks. The code paths and failure behavior ship; external success is not fabricated. Cloud state limit is 3.5 MB, local 15 MB, single owner per workspace.

No private application data, histories, deployment resources or provider credentials were imported. No applications, messages or paid plan changes were made.
