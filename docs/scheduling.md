# Daily updates that actually run

Choose one scheduler for a workspace. Avoid duplicate host tasks. A saved schedule alone does not create a background process.

## Built-in local runner

```sh
node bin/role-trail.mjs schedule --workspace "$HOME/.local/share/role-trail" \
  --time 09:00 --timezone Europe/London --status active
node bin/role-trail.mjs daemon --workspace "$HOME/.local/share/role-trail"
```

The foreground runner checks each minute. It uses the chosen IANA timezone, including daylight-saving changes. After the daily time, it reserves that local date under a revision lock and performs at most one automatic collection for that date. Two runners cannot reserve it twice. A sleeping/offline/stopped machine cannot run; when resumed later that same day it catches up once. It does not replay every missed day.

Ctrl+C stops the process. To pause the saved schedule, run `schedule` again with `--status paused`. You may use an OS service manager you control to keep the daemon running, but Role Trail never silently installs one. `tick` executes only if due; `collect` is a manual run regardless of schedule.

A failed or interrupted reserved run is not automatically repeated that day, preventing duplicate optional provider charges. Research shows partial failures; schedule fields record running, partial, completed or failed plus run ID and timestamps. After correcting a failure, run `collect` manually. A leftover local lock requires the recovery procedure in [data-contract.md](data-contract.md).

## Claude Code / Codex host task

Ask the host to use its actual scheduling tool, after authorizing the time and scope:

> Create or update one recurring Role Trail task for my chosen timezone and time. Read my current shared state and profile. Run the configured collection; use available search tools for selected sources that lack a feed. Verify official opening, location and language constraints. Import a run with actual coverage and only checked fields. Assess new candidates against confirmed capability evidence; never modify my personal decisions. Generate pending resumes and adjustments for shortlisted roles lacking a current draft. Preserve tasks and resume reviews. Do not apply, email or upgrade accounts. Record the real task ID, next run, manual test and later actual timed result.

If the host lacks a scheduler, use the executable daemon or a user-owned cloud runner. Don't pretend a prompt or `schedule-receipt.json` installs a host task. Record actual account/tool limitations. Host-model research and deterministic feed collection are different: the built-in runner collects configured feeds; it does not invoke a model or assign new ability scores.

## Private cloud runner

The API has authenticated `POST /api/tick` and `POST /api/collect`. The former uses the saved daily schedule; the latter performs a manual collection. Both read server-side provider credentials. Clients send `Authorization: Bearer <workspace key>` and `Content-Type: application/json` with `{}`. Never include keys in URLs or logs.

For a user-owned GitHub repository, `examples/search-workflow.yml` is a runnable template:

1. Configure and verify your private Vercel API first. Do not turn off outer Deployment Protection; if it blocks the runner, use an approved access route before continuing.
2. After authorizing recurring work, copy the template to `.github/workflows/workspace-search.yml` in your own repo.
3. Set repository secret `ROLE_TRAIL_ACCESS_KEY`, secret `ROLE_TRAIL_URL`, and variable `ROLE_TRAIL_SCHEDULE_ENABLED=true`. No source-provider key is needed in GitHub; those stay in Vercel.
4. Configure the active daily time in Role Trail. Run the workflow manually, inspect the returned run receipt and Research coverage, then verify one actual scheduled trigger.
5. Pause by setting the variable to false or disabling that workflow. Pause the workspace schedule too when appropriate.

GitHub schedules can be delayed and are not an exact-time SLA. The template checks twice an hour; the workspace's timezone determines when a daily run is due. It is a feed collector, not a host-model session. Keep the scheduled repo private if its metadata is sensitive; job and resume data are never printed by the template.
