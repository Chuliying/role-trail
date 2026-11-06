# React migration implementation

Status: implemented; final review and delivery belong to T02. No private database, deployment or user records were changed by this implementation task.

## Runtime

The workbench now renders through React and strict TypeScript components in `src/client`. React owns the shell, job list, detail tabs, filter dialog, score popovers, preparation, profile, research reader and structured-data editors. The previous imperative view modules were removed. There is no wrapper that mounts the old renderer inside React.

`api/workspace.ts` uses TanStack React Query to own the single workspace snapshot cache and all workspace mutations. `WorkspaceProvider` coordinates UI state and notices. The API adapter retains the existing transport, delta merge, ETag and revision safeguards. It rejects an older snapshot before and after asynchronous binding calculations. The UI preserves login, deployment-version refresh, back/forward-cache reload, validated URL state, unsaved-editor guards and notices scoped to the open editor or job dialog.

Shared controls retain native select, dialog and popover behavior. Pending actions lock synchronously before invoking a write, keep their dimensions while showing delayed progress, permit retries after failure and cancel pending display timers on unmount. Dialog cleanup restores focus after React removes the dialog so WebKit does not move it to the document body. Filter reset clears only filter values; it preserves the selected personal-decision tab.

Markdown uses parsed tokens and React elements. Heading hierarchy, ordered and nested lists, code, links and tables remain structured. Source HTML and images are inert; links accept only supported protocols without credentials.

The build emits a committed `web/app.js` and matching public-only static shell. `hydrateRoot` keeps the initial skeleton rather than replacing it. Initial markup is language-neutral English until hydration completes, then applies the saved interface locale. The generated body is excluded from HTML whitespace reformatting to preserve hydration equality. The existing Node API, CLI and private-wrapper asset contract remain in place. Full React, React DOM, Scheduler and TanStack Query MIT notices ship in `web/vendor/runtime-LICENSE.txt`; the existing Marked notice remains distributed.

## Query integration and module boundaries

The follow-up user requirement added TanStack React Query for all programmatic GET/POST operations. Workspace, archive and deployment-version reads use queries. Action, collect, login, logout and restore use mutations with no automatic POST retry. Mutation `isPending` disables write controls, alongside the synchronous pre-effect click lock. This does not replace the server revision guard or claim server-side idempotency. Native PDF/export/source links retain browser download/navigation behavior.

There is one query-cache snapshot with revision checks before/after binding hashes and at cache commit. Readers abort on close and revalidate on open. Module responsibilities are now grouped under `api`, `components` and `features`; the opportunity shell delegates fit evidence, resume and preparation to separate feature modules. URL/history logic is independent in `navigation.ts`. The architecture and dependency direction are documented in `docs/browser-runtime.md`.

## Shortlisted layout correction

The regression fixture includes a Shortlisted role with resume, source and recorded-application actions in English and Traditional Chinese. The old table left only 8 px for the selected label. The corrected action cell reserves readable select width and wraps the action links together when needed. Tests cover 320, 390, 720, 769, 1024, 1280 and 1440 px without horizontal overflow.

The geometry fixture changed only the intended desktop action-cell values: width 162 to 186 px, select width 110 to 134 px and wrap gap 8 px to 4 px / 8 px. The recorded mobile geometry stayed unchanged. One existing animation check now records native animation creation after the React commit instead of sampling a brief running interval; it still requires one animation, and zero with reduced motion. Three repeated Chromium/WebKit runs passed.

## Verification evidence

- Observed RED: Shortlisted selected-label available width was 8 px before the fix.
- Observed RED: two same-task button clicks sent two POST requests before the action-lock fix.
- Targeted GREEN: Shortlisted labels in both languages, filter reset on Shortlisted, WebKit focus restoration and single-request/retry behavior.
- `npm run typecheck`: passed with strict TypeScript; no `any` declarations in the React source.
- `npm test`: 85 passed, 0 failed.
- `npm run build`: passed; generated bundle and server entry syntax validated.
- `npm run test:ui`: final frozen complete suite passed 69/69 after the CC fixes. Root independently ran this suite in 49.6 seconds.
- `npm run format:check`: passed.
- `npm audit --json`: 0 vulnerabilities across all severities.

The additional query lifecycle cases cover shared reads, explicit refresh policy, pending write controls across views and the tools menu, non-retried failed POSTs, reader cancellation, and login pending through its authenticated refresh. Login mutation variables are reset after either result with immediate garbage collection; the synthetic access key is not written to browser storage.

All checks use synthetic workspaces. The browser suite includes Chromium and WebKit, English/Traditional Chinese, first-paint hydration identity, loading/reduced motion, deltas and revision conflicts, pending failures and rollback, navigation/editor guards, structured JD safety, archived state, PDF access and preparation workflows. Automated coverage does not establish correctness on every device or external source. CC review, public delivery and the private deployment are separate acceptance steps.

## Focused Claude Code review corrections

The read-only CC review found no blockers, but identified concrete edge cases. These were corrected before delivery:

- Filter Apply now submits only query/minimum/sort/direction/limit. Browser Back while the filter dialog is open is preserved.
- A shared synchronous invocation guard now protects decision select and task checkbox writes as well as buttons. Forced same-task change events issue one POST; a failure restores retry access.
- Preparation binding state begins unresolved, not stale. Materials and interview status show `Checking…` until hashes settle, and neither a ready outcome nor a stale-preparation task is presented early.
- The focus-policy test dispatches the actual window `visibilitychange` event against a stale query. A temporary mutation enabling focus refetch made it fail with 2 reads instead of 1; the original no-refetch configuration was restored and rebuilt.
- Deployment-version querying now has its own `api/deployment.ts` module.
- Native editor close now runs the dirty-input guard. Canceling discard reopens the editor and restores the edited field's focus. Non-cancelable cancel events delegate to that close guard, avoiding duplicate prompts.
- Shortlisted label checks now include 320 and 720 px. At intermediate desktop widths the action group may use a second line to preserve the complete decision label and full-size icon targets; this is intentional.

Observed RED evidence: `/tmp/rt-cc-red.log`, `/tmp/rt-cc-close-red.log`, `/tmp/rt-focus-mutation.log`. Targeted final verification passed 22/22 browser tests, strict typecheck, build and format checks, recorded in `/tmp/rt-cc-green.log`; root owns the frozen final full-suite run and focused CC rereview. No commits, deployments or private data changes were made by this implementation task.

## Frozen candidate verification

Root independently ran the final candidate after the CC fixes: strict typecheck, Node 85/85, full browser 69/69 in 49.6 seconds, formatting and audit (zero known vulnerabilities). Rebuilding produced identical generated assets. A fresh production-only `npm ci --ignore-scripts --omit=dev` installation passed exact static-copy verification. CC Opus 5.5 high focused rereview returned no blockers and confirmed the actionable findings resolved. Production deployment remains a separate step.
