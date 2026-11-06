# Review completion — 2026-11-06

This change closes the four findings from the earlier site review and includes the user's subsequent layout and language requests. It changes the shared runtime; private deployments consume the same package.

## Behavior

- Editors guard unsaved input on close, Escape and browser navigation. Cancel keeps the input; failed submissions keep the editor open and show the error inside it. Saving disables duplicate submission and close. A checkbox rollback now finds the exact task ID, including when other tasks have different completion states.
- View, decision filter, search, minimum fit, sort and direction round-trip through validated URLs. Search typing replaces history instead of adding one entry per character. Browser back/forward restores view state.
- Conditional state reads return ETags and empty 304 bodies. Opt-in mutation responses carry revision-bound entity deltas; old clients and exports retain full state. A bad delta triggers a read, not another mutation. Authentication, revision conflicts and canonical storage remain unchanged. Optional migration metadata is included; a failing round-trip test caught and verified its update/removal fix.
- The entry module coordinates effects; page renderers, shared controls, editor lifecycle, navigation, transport, snapshot derivation and score explanations have separate modules. One JSON manifest drives local serving, deployment copying, syntax checks and release hashing. Styles have five explicit files. The consolidation removed 44 shadowed declarations and eight empty rules; later polish also removed unused score-tooltip rules.
- Desktop navigation centers on the viewport. Search controls occupy a compact right-aligned group. Table cells have 20px horizontal padding, verification glyphs align with titles, and tab counts sit 8px from their labels. Work-mode details stay inside the job dialog. Header remains sticky, and tool-menu dividers have equal top/bottom spacing.
- Mobile score circles are 25.6px (80% of 32px) inside 44px controls. Hover, click, keyboard and touch open saved scoring reasons/evidence. Historical scores stay muted; explanations identify their historical status. No score or qualification data is changed.
- English and Traditional Chinese messages have matching source JSON packs. The tools menu switches language persistently; saved JD, resume, evidence and profile content remain verbatim. Status IDs and API contracts remain stable.

## Verification

Before implementation, three navigation/editor tests failed and two transfer-protocol tests failed. They passed after the fixes. The CSS characterization passed both before and after the structural consolidation. The geometry fixture was then updated for the separately requested layout changes, with direct assertions for centering, padding, counts, score size and overflow.

Final full run: 85 Node tests and 42 browser tests passed. After the last locale/default-filter adjustments, the 85 Node tests and 11 affected navigation/layout/language cases passed again. The browser suite includes Chromium and WebKit, slow/failed requests, keyboard/touch interactions, IME input, PDF/resume/task flows, source Markdown, research archives and reduced motion. Desktop and mobile evidence-popover screenshots were inspected.

Build and formatting pass. Dependency audit reports zero known vulnerabilities at this run. The separate heuristic secret preflight passes, with the same six suppressed synthetic/example candidates and reviewed unchanged vendored-parser log heuristic (`web/vendor/marked.mjs:82`). This is not a penetration test.

A synthetic 150-job workspace measured a 1,233,343-byte full response, 346-byte review delta and zero-byte unchanged body. The initial/changed read and underlying JSON database access remain full workspace operations. Unsaved guards do not provide crash recovery or persistent draft autosave. Tests do not establish external-provider availability or future scheduled-agent execution.

## Delivery

Runtime commit `7ce0d355fd3831edb95a0d2647867d0e3caa196d` was pushed and installed as the private wrapper’s exact dependency. Its asset parity test passed. Guarded deployment reached READY at 2026-11-06 02:17 UTC with all-deployment authentication retained. Authenticated live checks matched all 20 browser modules, CSS, entry versions and the brand font; conditional state reads returned 304 with an empty body. Shared revision and job/research/task/review/resume/preparation/submission/migration data matched the earlier read-only baseline. Anonymous API access remained protected.

No research import, resume approval or application occurred during UI acceptance. Deployment IDs, operational schedule diagnosis and live receipts stay with the private installation. This final documentation update does not change the installed application assets.
