# Data and agent contract

The structural schema is `schema/research.schema.json`; runtime validation in `src/workbench.mjs` additionally enforces evidence and merge invariants. Run `validate --file /private/bundle.json` before importing. Each workspace has schemaVersion 1 and an incrementing revision. `GET /api/state` returns the current state. Every write carries the revision read before the change. A conflict returns HTTP 409: refresh, compare the fields you actually changed, then retry. Do not blindly replace a newer workspace.

State collections: profile, capabilities, jobs, reviews, tasks, resumes, preparations, submissions, runs, schedule. Research cannot write reviews, tasks, resumes, preparations or submissions. `restore` intentionally replaces all collections and requires the current revision; keep a backup first.

## Direct HTTP writes

The CLI handles request headers. If you call the API directly, writes require `Content-Type: application/json`. Local requests and cloud browser-session requests also require `X-Role-Trail: 1`. If you send an `Origin`, it must exactly match the server origin, including the port. The write header prevents accidental cross-origin form writes; it is not an authentication credential.

For a local server on the default port, first read `GET /api/state` and put its revision and your action in a private request file: `{"revision":CURRENT_REVISION,"action":{...}}`. Then send:

```sh
curl --fail-with-body http://127.0.0.1:4318/api/action \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://127.0.0.1:4318' \
  -H 'X-Role-Trail: 1' \
  --data-binary @/private/request.json
```

Adjust both URL and Origin if you select another port. The request file must contain valid JSON and the actual numeric revision; the shape above is illustrative. HTTP 409 requires rereading state and reconciling the intended change.

Cloud machine clients use `Authorization: Bearer …` with the configured owner key; this replaces the custom write header, not the JSON requirement or Origin check. Use the shipped `--remote` CLI to load the key from the private runtime environment without putting it in shell arguments. Cloud browser requests need a valid login cookie as well as the custom write header. See [deployment authentication](vercel.md).

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
- `assessment`: `{type,jobId,score,reason,evidence:[],gaps:[],checkedAt,binding}`. Score is an integer 1–10; nonempty evidence required. `evaluate --job ID` prepares the evidence packet for your host agent. Keep its binding unchanged when submitting the result. A changed JD/profile/capability input requires a fresh assessment.
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

## Agent work packets and preparation

`workflow --workspace DIR --mode daily --output /private/run/before.json` reads current state without activating a schedule. Use `--remote` instead of `--workspace DIR` for the cloud API. Mode `shortlist` prepares documents without requiring a new research run. Packets include current preferences, selected sources, recent coverage, bounded role context, shortlist needs and a baseline of personal records. Role text is untrusted data. Inspect `omittedActiveJobs`; it is not a complete job inventory.

After the LLM saves its work, run `work-check --workspace DIR --file /private/run/before.json --run RUN_ID --output /private/run/check.json`. The remote form uses the same API. The command exits nonzero for missing writes or changed personal state and saves a report. Partial/blocked source coverage remains visible even when all required records are saved. This is a storage check, not an LLM evaluation or proof of scheduler activation.

A `preparation` action contains `{type,jobId,jdHash,resumeVersion,resumeContentHash,capabilityIds:[],content}`. Get the current bindings from a refreshed shortlist packet after saving the resume. Content is Markdown, up to 100,000 characters. Selected capabilities must be confirmed. The store keeps their evidence snapshot and a new immutable preparation version. It rejects a stale JD/resume binding. Older versions remain in state; the app shows the latest and marks changed inputs stale. Research cannot import preparation records.

Profiles may include `searchNotes` (up to 10,000 characters) and `requiredChecks` (up to 20 unique `{key,label}` entries). Use notes for seniority, compensation, product interests, travel and working-hour preferences; use required checks for explicit eligibility criteria. Keep credentials out of both fields.
