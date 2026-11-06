# Site review — 2026-11-06

The shipped application is vanilla JavaScript, Tailwind and a Node API. React hooks, RSC, Next.js routing and SolidJS reactive primitives do not apply. This review used SOLID responsibility boundaries and the transferable input, request, layout, accessibility and performance guidance. It did not migrate frameworks or claim framework certification.

## Fixed behavior

- Failed decision and task writes restore the persisted control state. Decision saves immediately show an adjacent spinner, disable duplicate selection and keep dimensions stable. Reduced motion retains a static progress indicator. Keyboard focus uses an even inset boundary instead of a single bottom edge.
- Editor validation errors stay inside the active modal.
- Chinese IME composition keeps the input mounted until commit.
- Resume-derived flags and workspace data commit together. A slow older GET cannot overwrite a newer successful mutation. Hash derivation uses job/capability maps rather than nested searches.
- Table headers toggle both directions with `aria-sort`, spaced arrows and meaningful numeric ordering. Historical scores remain visibly stale but sort/filter by the displayed value; unrated jobs remain last. Eligibility and personal decisions are unchanged.
- Desktop content shares a 1160px inner axis with the header. Search, score and sorting controls share a row on wide screens. Mobile cards remain separate surfaces. The five workspace tools share a trigger-anchored popover with dismissal and keyboard behavior.
- Logo uses locally served M PLUS U. Shared JSON owns discovery metadata, feed options, labels, tool menu, sorting and verification presentation. CSS tokens own visual values. See [configuration](../../configuration.md).

## Evidence

The five state failures and four layout/sort/menu checks were reproduced before their fixes. Final synthetic validation: 79 Node tests, 31 browser tests, and an additional 11-test WebKit layout/state run. Browser cases include Chromium and WebKit, 320/390px layouts, 1440/1920px desktop layouts, delayed/failed requests and reduced motion. Screenshots inspected: centered desktop, mobile cards and decision-save progress. Build, formatting and dependency audit pass; audit reports zero known vulnerabilities at this run. The heuristic secret scan passed after two new synthetic credential fixtures were named explicitly as test tokens. It reported six suppressed test/example candidates and one reviewed log heuristic in the unchanged vendored Markdown parser (`web/vendor/marked.mjs:82`). This is separate from dependency and authentication checks.

These are regression checks, not a claim that every possible behavior or external platform was benchmarked. No live profile, decision, task, application or research data was changed for acceptance.

## Remaining review findings at the original review

These four findings were subsequently addressed in [review completion](../review-completion/implement-report.md). The original observations below remain as the review record; full-workspace database reads and lack of crash-recovery autosave are still documented limits.

- **P2 — editing recovery:** the generic editor still lacks an unsaved-change guard on close. This pass fixes visible errors but does not add draft recovery.
- **P2 — payload growth:** state reads and mutations return the full workspace. PostgreSQL stores one revision-locked JSON state with a 3.5 MB limit. Frontend pagination limits rendered rows, not transferred state. Measure realistic larger workspaces before splitting payloads; no scaling benchmark was run here.
- **P3 — responsibilities:** `web/app.js` still combines rendering, forms and controller logic. CSS retains historical overrides. Configuration extraction reduces coupling but does not finish a component/controller split.
- **P3 — navigation:** view/filter state is not represented in URLs, so direct links cannot restore an exact filtered view.

Store injection, shared transition contracts and collector fetch/clock injection already provide useful boundaries. Store tests cover intended local/cloud behavior, including explicit size limits; they do not prove universal Liskov substitution. Adding React or Next.js alone would not address these findings.

Existing protection paths were inspected: safe DOM/Markdown construction, external URL validation, fail-closed cloud configuration, authenticated same-origin writes, parameterized database queries, revision checks, artifact hashes and bounded collectors. No full penetration test or external provider uptime test was performed.

## References

- [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md)
- [React: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) — transferable state derivation principles; React APIs N/A.
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — framework boundary reference; APIs N/A.
- [shadcn Select](https://ui.shadcn.com/docs/components/base/select) and [Spinner](https://ui.shadcn.com/docs/components/base/spinner) — interaction/composition reference. CLI confirmed a manual, non-React project; no React component runtime was installed. Native selection preserves mobile platform behavior.

Graph freshness: `repo_map.py status --root .` returned `state=missing`; this review used scoped searches and direct source reads.

## Delivery

Runtime commit `dd20c2d4f11c03a6d478e649cbe362d5db8f3671` was pushed. The private wrapper pins that commit; its byte-for-byte asset test and dependency audit passed. Its guarded deployment reached READY on 2026-11-06 at 01:15 UTC with all-deployment authentication retained. Authenticated checks matched the entry versions, app, CSS, generated configuration, status module and M PLUS U font against the installed package. Deployment identifiers and receipts stay with the private installation. This documentation-only follow-up does not change the pinned runtime.
