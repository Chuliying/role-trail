# React migration acceptance

This is a frontend replacement, not a change to stored user records or workflow semantics.

## Required parity

| Area | Verify |
| --- | --- |
| Delivery | CLI and Vercel receive the same committed bundle through the static allowlist. Entry cache revision includes bundle/CSS. No private profile or environment values in compiled output. |
| Initial state | Static skeleton before JavaScript; React loading has no bare text flash. Refresh keeps current content, conditional GET and revision monotonicity. |
| Decisions | Chinese/English labels readable with source, resume and application actions. Immediate pending UI, duplicate guard, saved selection rollback on failure; no silent Applied conversion. |
| Jobs | Default recency then fit; all column sort directions; unrated last; stale historical numbers visible; Passed unifies factual/manual archives without rewriting their reasons. |
| Score/checks | Score hover/tap/keyboard evidence; fresh/stale/unrated distinct. Generic sourced checks and eligibility stay independent of fit and decisions. |
| Navigation | Query/fit/order/view survive reload and history. Dirty editor cancellation restores URL; accepts discard explicitly. IME input remains mounted. |
| Detail | Full-screen mobile dialog, bounded desktop, retained tabs/footer, correct title/focus restoration. JD headings/lists/tables with inert raw HTML, images and unsafe URLs. |
| Preparation | Shared task updates across cards; failed checkbox restore targets exact task. Queue resume requests rather than fabricate immediate LLM output. Draft/version/review/PDF/staleness/application evidence remain separate. |
| Research | Full artifact reader, byte-exact download, empty/error/retry states, long query wrapping. Fetched is not reviewed; no count inflation. |
| Profile | Edit profile/capability/feed/schedule/import/backup flows retained. Failed save preserves edits; no automatic capability confirmation. |
| Controls | Shared native/select component arrow inset; 44px touch targets; proper keyboard focus; equal modal chrome, live notices, no translation hover on source link. |
| Filters | Desktop anchored popover/mobile sheet; local draft Apply/Reset/cancel; safe exit animation, focus restoration and reduced motion. |
| Data/cache | All frontend GET/POST paths use queries/mutations, including research artifacts, versions, authentication and restore. One authoritative workspace cache; late reads cannot replace newer revisions. Preserve conditional GET and transport delta merging. |
| Mutations | Synchronous duplicate guard before side effects; explicit retry:false. Pending controls disable immediately and recover after failure. Server revision conflict checks remain; UI disable alone is not a server idempotency guarantee. |
| Structure | Separate transport/query keys and hooks, navigation, common controls and feature sections. No competing server-state copies or monolithic detail component. |
| Lifecycle | React owns UI tree and state. Effects clean event listeners, async reader fetches and transient timers. No legacy renderer mounted inside React. |

## Viewports

Exercise 320, 390, 720 mobile and 1024/1280 desktop, including Shortlisted rows with a resume and prior application. Check Chinese and English. Existing Playwright Chromium and WebKit cases remain the baseline. Compare intentional action-column changes visually before updating geometry fixtures.

## Delivery evidence

Record actual test counts, typecheck, formatting, audit, security preflight, reviewer findings and deployment separately. A local passing test is not evidence of a deployed build. Production verification is read-only; never use production state for test fixtures.
