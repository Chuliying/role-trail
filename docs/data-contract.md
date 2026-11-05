# Data and agent contract

The structural schema is `schema/research.schema.json`; runtime validation in `src/workbench.mjs` additionally enforces evidence and merge invariants. Run `validate --file /private/bundle.json` before importing. Each workspace has schemaVersion 1 and an incrementing revision. `GET /api/state` returns the current state. Every write carries the revision read before the change. A conflict returns HTTP 409: refresh, compare the fields you actually changed, then retry. Do not blindly replace a newer workspace.

State collections: profile, capabilities, jobs, reviews, tasks, resumes, runs, schedule. Research cannot write reviews, tasks or resumes. `restore` intentionally replaces all collections and requires the current revision; keep a backup first.

## Research bundle

Save outside Git and import with `import --workspace DIR --file FILE`, or POST `/api/action` with `{revision,action:{type:"research",...bundle}}`.

```json
{
  "run": {
    "id": "your-unique-run-id",
    "kind": "daily",
    "coverage": [{"source":"official","status":"partial","query":"Your actual search","screened":1,"fullJd":1,"note":"Actual scope, limits and failures"}]
  },
  "jobs": [{
    "company":"Example company",
    "title":"Example role",
    "url":"https://example.com/jobs/one",
    "source":"official",
    "description":"## Responsibilities\n- Example task",
    "descriptionKind":"full",
    "posting":{"date":null,"kind":"unknown","raw":"First publication not established"},
    "remoteMode":"unknown",
    "location":"Not confirmed",
    "availability":{"status":"unknown","source":null,"evidence":"","checkedAt":null},
    "checks":[{"key":"location","label":"Location eligibility","status":"unknown","source":null,"evidence":"Verify the user's legal work location","checkedAt":null}]
  }]
}
```

Use actual ISO timestamps for `searchedAt`, `firstSeenAt` and checked facts; defaults are the current import for manually supplied data, not a claimed external check. A job ID is derived from its URL. For the same job across multiple URLs, resolve the canonical employer URL before importing; different URLs are not automatically company/title deduplicated.

Coverage statuses: searched, partial, blocked, not_run, empty. `screened` counts examined rows; `fullJd` counts complete descriptions and cannot exceed screened. A bounded automatic source run is partial, even if every returned row was read. Keep selected sources with zero results or failures in coverage.

Job description kinds: full, excerpt, summary, unknown. Posting kinds: posted, updated, reposted, unknown. Work modes: remote, hybrid, onsite, unknown. Availability: open, closed, unknown. Checks: confirmed, excluded, unknown. Positive or exclusion/closure facts require an HTTP(S) source URL, nonempty evidence and a checked timestamp. Future evidence is rejected.

Closed roles, expired listings, excluded checks and manual archives appear in Archive. Unknown or older facts cannot remove an existing exclusion or closure. A newer positive fact can reopen it; manual archive still remains. Availability and remote eligibility are separate.

## Other actions

Send one action via `action --workspace DIR --file FILE`, or API `/api/action`:

- `profile`: `{type,profile}`. See `examples/profile.json` and source configuration. No provider keys in profiles.
- `capability`: `{type,id?,claim,tags:[],evidence:[],status}`. Evidence is a list of cited observations/URLs/SHA paths. Status is proposed, confirmed or rejected. Only the user may authorize confirmation.
- `assessment`: `{type,jobId,score,reason,evidence:[],gaps:[],checkedAt}`. Score is an integer 1–10; nonempty evidence required. `evaluate --job ID` prepares the evidence packet for your host agent. It does not fabricate a model result.
- `review`: `{type,jobId,status}` where status is review, shortlisted, applied or passed.
- `archive`: `{type,jobId,archived:true|false}`.
- `task`: `{type,jobId,text,done:false}` creates; `{type,id,jobId,done:true}` updates. Text can also be changed.
- `resume`: `{type,jobId,content,capabilityIds:[],adjustments:[],jdHash}`. Creates a new pending version. `draft` fills this shape using confirmed claims. Host agents may rewrite content but must keep claims grounded.
- `resumeReview`: `{type,jobId,version,status:"approved"|"changes_requested"}`. Rejects a changed JD, profile or capability evidence.
- `schedule`: `{type,schedule:{status:"active"|"paused",time:"09:00",timezone:"Europe/London"}}`. This saves timing, not an installed runner.

Research imports preserve decisions, tasks, resume versions and manual archives. Do not use `restore` as a daily research importer. Archive restoration does not override a factual exclusion. Resume approval is independent of Applied.

## Private files and recovery

Local state: `workspace.json`; short-lived writer lock: `workspace.lock`. A crash may leave the lock. Confirm no server, CLI writer or daemon still uses that workspace, back up `workspace.json`, then remove only the stale lock. Never delete a lock merely to force a concurrent write.

PostgreSQL: `role_trail_state`, one workspace per database/schema deployment. This is a single-owner application, not a tenant-isolated SaaS. Cross-agent access uses the same API and revision contract. Backups contain sensitive data; `export` refuses paths inside Git and refuses to overwrite files.
