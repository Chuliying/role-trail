# What to expect from an installation

Role Trail provides the app, storage, CLI and a skill for the user's coding agent. It can support the same sequence as an agent-operated personal job search: set preferences, deploy a private workspace, schedule an LLM session, research roles, and prepare shortlisted applications for review. You do not need the maintainer's account or private database.

There are three parts to check:

| Part | Provided here | Check in your installation |
| --- | --- | --- |
| App and data | Local/PostgreSQL storage, authenticated API, JD reader, decisions, todos, resume/preparation versions, input bindings and backup/restore | Deployment URL, authentication, persistence and access from another client |
| Agent workflow | Onboarding/daily/shortlist skill, source playbook, current-state packets and completion checks | The agent can read authorized sources, use its search tools, save results and produce a usable PDF |
| Recurring execution | A daily LLM prompt and host setup instructions; a separate feed daemon/tick is also available | A real LLM task is registered with the correct environment, timezone and scope; then observe a timed run |

The host model interprets evidence and writes assessments, resume text and interview preparation. The built-in resume drafter ranks claim tags against JD words to give it a starting draft. It does not understand an entire career or replace the user's factual review.

## Checks that are built in

A fit assessment is tied to the JD, profile and confirmed capability evidence used to produce it. Changed inputs make the old assessment stale. A late result with old bindings is rejected. Previous scores and reasons remain visible as history, but stale scores do not affect current filtering or sorting.

Positive opening checks expire after 7 days; other positive qualification checks expire after 30 days. Missing or future dates don't produce verified icons. Closed/excluded evidence stays in effect until newer positive evidence replaces it. Each icon refers to one supplied criterion. The agent must check the user's full set of requirements, including `requiredChecks` and `searchNotes`.

An explicit Applied decision creates a separate report that survives later bucket changes. `recordedAt` is the report time, not an inferred application date. Older still-Applied decisions can be retained as legacy records; already lost history cannot be reconstructed.

Current pending/approved resumes are kept. Missing, stale or changes-requested drafts can produce new versions. Preparation records retain their capability snapshot and bind to the JD and resume version/content. Changed sources make the preparation stale. Neither document creation nor approval implies an application.

Research imports preserve personal records. New run IDs carry a canonical content hash: the same payload can be retried, while changed content at the same ID is rejected. Old runs without a hash remain non-retryable. Object-key order is normalized so PostgreSQL JSONB doesn't change bindings. Older incompatible resume digests remain stored but require regeneration/review.

`work-check` detects missing run coverage, missing/stale shortlist documents and changes to protected personal state during a run. It cannot establish that a web observation is true, a resume is well written, a PDF was inspected or a scheduled task actually ran. The agent must provide that evidence separately.

## Limits to account for

- One owner/workspace per database. This is not a multi-tenant recruiting service.
- Local state has a 15 MB serialized UTF-8 cap; cloud state has a 3.5 MB cap. An oversized write is rejected without deleting old data. PDFs and full source bundles are stored separately; page-state limits still apply.
- Built-in collectors cover configured Himalayas, Greenhouse, Lever, Job-Frog, optional SerpApi, and explicitly configured Taiwan Indeed/104 adapters. The LLM uses host tools and the source playbook for other selected platforms. Access can fail; the report must retain that scope.
- Local PDF output requires Chromium. Cloud provides authenticated printable HTML. Original PDF bytes are saved as immutable artifacts through `resume-pdf` or `pdf-save`.
- New full research payloads are archived. A one-time converter supports the legacy job-board PostgreSQL schema; unrelated tracker formats still need a converter. See [migration](migration.md) before moving existing data.
- Account access and LLM scheduling depend on the user's environment. When the host cannot schedule an LLM session, say so. Don't substitute a feed-only cron job and claim full agent operation.

See [release evidence](release-check.md) for executed tests. Synthetic runs establish behavior under those inputs; live provider access, real deployment and future timed execution require their own checks.
