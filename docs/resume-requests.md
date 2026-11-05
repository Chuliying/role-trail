# Agent-made resume requests

The website stores work; Codex or Claude writes the resume. No LLM API key is needed for this path. Clicking **Request resume** does not start a model session, a background worker, or a paid API call.

1. The authenticated button saves a `requestResume` action to the current shared store using its revision. Duplicate queued requests for the same job are kept as one request. No resume, capability confirmation, application decision or task completion is created.
2. On its next manual or scheduled run, the user's connected agent runs `workflow --mode shortlist` or `workflow --mode daily`. Both packets include `resumeRequests`, including explicit requests outside Shortlisted. The queue is portable across agents that use the same store.
3. The agent reads the JD and evidence and writes the resume with its host LLM. Previously approved resumes can help check existing facts; they do not make every proposed claim true. Missing personal contribution or contradictory evidence requires a specific clarification. Save the request as `blocked` with that question instead of inventing facts or marking all capabilities confirmed.
4. Save the new resume through the `resume` action with current JD hash, confirmed capability IDs and concrete adjustment notes. Inspect and save the PDF using the existing PDF workflow. Mark the request completed only after the new saved draft exists; reference its version. Completion is **draft ready for review**, not user approval or application.

## Request states

| Stored state | Meaning |
|---|---|
| `queued` | Saved and waiting for an agent. This does not mean a model is running. |
| `blocked` | The agent recorded a concrete missing input or execution failure in `note`. |
| `completed` | A newer current resume with adjustments is saved and linked by `resumeVersion`. |
| `canceled` | The user no longer wants this request processed. Existing resumes remain. |

The loading spinner covers the short request-save operation only. It stops when the server responds. Waiting for an agent is a static state. Refresh reads the latest queue/draft state; this is not a live streaming UI.

## Agent commands and actions

Use the configured private workspace or remote installation. Paths below are placeholders outside Git.

```sh
node bin/role-trail.mjs workflow --remote --mode shortlist --output /PRIVATE/request-work.json
node bin/role-trail.mjs action --remote --file /PRIVATE/action.json
node bin/role-trail.mjs work-check --remote --file /PRIVATE/request-work.json --output /PRIVATE/check.json
```

Check `help` for your installed CLI. Read/export fresh state before each write. The action CLI reads the current revision and uses compare-and-swap; direct API clients send their observed revision. On conflict, reread and reconcile; do not blindly replace the revision. Request actions are:

```json
{"type":"requestResume","jobId":"JOB_ID"}
{"type":"resumeRequestStatus","id":"REQUEST_ID","status":"blocked","note":"The project evidence does not identify your contribution. Please confirm the feature you owned."}
{"type":"resumeRequestStatus","id":"REQUEST_ID","status":"completed","resumeVersion":2}
{"type":"resumeRequestStatus","id":"REQUEST_ID","status":"canceled"}
```

Completion rejects an old version, stale source bindings or missing adjustment notes. `work-check` reports queued or blocked requests from the original packet. Research imports preserve the queue. It remains separate from personal preparation checkboxes and To Review/Shortlisted/Applied/Passed.

## Connect execution

Onboarding must register or reuse one supported host LLM schedule and point it at this installation. Include the shipped daily and shortlist skills; both now cover the request queue. A saved prompt alone does not create a scheduler. When no host schedule is available, give the user a manual prompt:

> Read skills/role-trail/SKILL.md and references/shortlist.md from this trusted checkout. Read a current workflow packet from my configured shared workspace and process its queued resume requests with your model. Check the JD and my source evidence, save tailored drafts and adjustment notes, inspect/save PDFs, and leave them for my review. If information is missing, record the specific question on the request. Do not submit applications or mark proposed claims confirmed without evidence of my confirmation.

Keep scheduled/manual execution claims distinct from saving a request. If the host is offline or its credentials fail, the queued request stays queued. The generic UI does not guess a schedule time.

The legacy CLI `draft` and `/api/draft` remain deterministic starting-template helpers for compatibility and tests. They do not call an LLM. The website no longer uses them or labels them as AI generation.
