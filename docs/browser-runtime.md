# Browser runtime

Role Trail uses native browser modules and a Node API. No React or Next.js runtime is involved.

`web/app.js` coordinates current state and effects. Page factories in `web/views-*.mjs` receive the same controller context. `controls.mjs` owns shared DOM controls and progress feedback; `editor.mjs` owns dirty state and submission; `navigation.mjs` owns validated URL state; `transport.mjs` owns requests; `snapshot.mjs` derives stale-document flags before atomically committing a snapshot. `score-popover.mjs` presents the same assessment evidence to pointer, keyboard and touch users.

`web/modules.json` is the module allowlist used by the local server, deployment asset copier and build. Build also validates the shared JSON catalogs and hashes every browser module into the entry version. Styles import explicit foundation, workbench, reader, feedback and shell files from `src/ui.css`, retaining one shared token system.

## State transfer

`GET /api/state` returns a private, no-store response with a content ETag. An authenticated request with the matching `If-None-Match` receives 304 and no body. Authentication runs before the ETag comparison.

Mutation clients can opt into `X-Role-Trail-Response: delta`. The version-1 envelope contains `baseRevision`, `revision` and changed entities/records. The browser merges only against the exact base revision. A malformed or incompatible delta triggers an unconditional read, never a repeated write. A slower old response cannot replace a newer revision. Existing clients and exports retain the full-state contract; database storage and revision conflict rules are unchanged.

A synthetic 150-job workspace measured 1,233,343 bytes for a full state response and 346 bytes for one review delta. The unchanged response body was zero bytes. These measurements demonstrate transfer reduction, not lower database-read cost: initial/changed reads and underlying JSON database access remain whole-workspace operations.

## Navigation and editing

Supported query parameters are `view`, `decision`, `q`, `sort`, `direction` and `fit`. Values are normalized against UI configuration. Typing replaces the current history entry; changing views/filters creates a navigable entry. Personal decisions remain server data. Unsaved editor close, Escape and browser navigation require discard confirmation; browser unload uses its native warning. Failed writes preserve input and show the error inside the editor.

## Interface verification

Automated checks cover 390px mobile and 1000/1440/1920px desktop geometry, viewport-centered navigation, cell padding, label/count grouping, overflow and score targets. Chromium and WebKit exercise shared mobile flows; a WebKit case also checks score tapping and persistent language selection. English/Traditional Chinese keys and interpolation parameters must match. JD headings/lists and user evidence are rendered from their source content without translation.

The checks use synthetic fixtures. They do not prove every device size, assistive technology, external job source or future scheduled agent run will succeed.
