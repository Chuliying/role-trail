# Browser runtime

Role Trail uses React and TypeScript for the browser workbench and the existing Node API for data and workflows. It does not require Next.js.

`src/client/App.tsx` composes the providers and shell. Feature components render keyed React trees. Shared controls own pending feedback, native select semantics, dialog lifecycle and focus restoration. Filters keep draft values local until Apply and only apply filter fields, preserving navigation made while the dialog was open. Markdown renders an allowlist of parsed tokens as React elements; source HTML and remote images remain inert.

```text
src/client/
  App.tsx, main.tsx       Application composition and hydration
  workspace.tsx          UI coordination: dialogs, editors and scoped notices
  navigation.ts          Validated URL state, history and unsaved-navigation guards
  types.ts, domain.ts    Typed data contracts and pure presentation policies
  api/
    client.tsx           Stable QueryClient, shared keys and defaults
    workspace.ts         Workspace query, mutations and revision-safe cache commits
    research.ts          Abortable archive queries
    deployment.ts        Explicit deployment-version probes
  components/            Shared controls, editor and safe Markdown rendering
  features/
    jobs/                Table/cards, filter dialog and score popover
    opportunity/         Detail shell, fit evidence, resume and preparation sections
    preparation/         Shared task controls and shortlisted preparation overview
    profile/             Preferences, capability editors and private backup controls
    research/            Search history and full archive reader
```

Features depend on the workspace interface and shared components. Query hooks depend on transport and domain helpers. The API/domain layer does not import features. There are no imperative view factories or DOM-to-React wrappers.

## Queries and mutations

TanStack React Query owns all programmatic server reads and writes. One workspace cache entry holds the state and its derived resume-binding flags; there is no competing component copy of server state. `WorkspaceProvider` adds UI coordination rather than a second store. Archive reads use cancellable queries, and version checks use an event-driven query. Native source, PDF and backup links remain normal browser navigation/downloads.

Workspace actions, source collection, login, logout and restore use named mutations with `retry: false`. Shared mutation controls use `isPending` to disable competing writes. A shared synchronous invocation guard prevents duplicate button, select and checkbox events before React renders pending state. This prevents duplicate UI submissions; it is not a claim of backend idempotency. The server still enforces revision compare-and-swap.

Window focus and reconnection do not silently refetch private data. Refresh remains an explicit action. Opening an archive revalidates its availability and authorization; closing its reader aborts the request. Failed reads expose Retry. Failed writes preserve input, re-enable controls and are not automatically retried. Preparation readiness remains unresolved while its binding hashes are being checked; it does not show a stale or ready outcome before the check finishes.

The API adapter retains the data-only transport, delta merge, snapshot and verification policies. Snapshot acceptance checks the revision before and after asynchronous binding calculations, then guards the cache commit again. A late read cannot undo a successful mutation. Mutation callers that need a returned state receive the accepted cache result, not an obsolete response payload.

## Build and distribution

`npm run build` uses esbuild to generate the committed `web/app.js` bundle and a matching static React shell. `hydrateRoot` preserves the first-paint skeleton while loading the private workspace. Interface localization starts after hydration, preserving identical initial markup for English and Chinese browser preferences. No workspace data is included in that shell.

`web/modules.json` remains the allowlist used by the local server, deployment asset copier and build. The CLI and private Vercel wrapper copy the same built assets, including when installing with `--ignore-scripts`; users do not need a frontend build server in production. The build validates JSON catalogs and hashes every shipped browser module plus CSS into the entry version. `src/ui.css` retains the shared design tokens and component styles. Full runtime licenses for React, React DOM, Scheduler and TanStack Query ship alongside the existing Marked license.

## State transfer

`GET /api/state` returns a private, no-store response with a content ETag. An authenticated request with the matching `If-None-Match` receives 304 and no body. Authentication runs before the ETag comparison.

Mutation clients can opt into `X-Role-Trail-Response: delta`. The version-1 envelope contains `baseRevision`, `revision` and changed entities/records. The browser merges only against the exact base revision. A malformed or incompatible delta triggers an unconditional read, never a repeated write. A slower old response cannot replace a newer revision. Existing clients and exports retain the full-state contract; database storage and revision conflict rules are unchanged.

A synthetic 150-job workspace measured 1,233,343 bytes for a full state response and 346 bytes for one review delta. The unchanged response body was zero bytes. These measurements demonstrate transfer reduction, not lower database-read cost: initial/changed reads and underlying JSON database access remain whole-workspace operations.

## Navigation and editing

Supported query parameters are `view`, `decision`, `q`, `sort`, `direction` and `fit`. Values are normalized against UI configuration. Typing replaces the current history entry; changing views/filters creates a navigable entry. Personal decisions remain server data. Unsaved editor close, Escape, native dialog close and browser navigation require discard confirmation; browser unload uses its native warning. Failed writes preserve input and show the error inside the editor.

## Interface verification

At desktop widths of 1000px and above, the next-step column reserves space for the decision select and up to three action icons on one line. Narrower table layouts may wrap the icons to preserve readable decision labels. Mobile cards retain their existing footer layout. The Shortlisted regression checks both languages from 320px to 1440px, including the maximum action count.

Decision selects share a 16px leading inset and a faint surface tint on desktop and mobile. The arrow keeps its separate 16px trailing inset. Mobile footers wrap actions only when their combined minimum widths cannot fit; labels never lose their padding to make room. Chromium and WebKit check the focused control as well as its resting geometry.

Focus indicators have no outline or inset ring. Keyboard focus uses a quiet fill and text underline; primary controls retain their dark action fill. Select regressions verify that focused controls have neither outline nor box shadow.

Automated checks cover 390px mobile and 1000/1440/1920px desktop geometry, viewport-centered navigation, cell padding, label/count grouping, overflow and score targets. Chromium and WebKit exercise shared mobile flows; a WebKit case also checks score tapping and persistent language selection. English/Traditional Chinese keys and interpolation parameters must match. JD headings/lists and user evidence are rendered from their source content without translation.

The checks use synthetic fixtures. They do not prove every device size, assistive technology, external job source or future scheduled agent run will succeed.

The style baseline keeps fixed geometry and design tokens exact. Text-sized brand/title/navigation widths and the JD’s `ch` reading measure use containment and font-relative assertions, because macOS and Linux font metrics differ. The CI browser environment is version-and-digest pinned; see [CI verification](ci.md).
