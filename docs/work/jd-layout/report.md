# JD structure and mobile layout review

## Findings

The previous reader converted every heading to `h3` and every list to `ul`. It rendered ordinary lines as separate paragraphs and did not support nested lists or inline Markdown. The provider converter also discarded ordered-list semantics and heading ranks. Formatting cannot recover a source page that was already flattened; those records need a scoped source reread.

Mobile rows spread verification, dates and decisions across separate bands. The revised layout groups verification and dates into one metadata row, keeps the role title across the available width and aligns the decision and source action below it. Secondary actions retain 44 px targets without a full-width outlined control in every row. Score, eligibility and personal decision remain independent.

## Implementation

- Marked supplies tokens. A DOM allowlist renders relative heading hierarchy, paragraphs, emphasis, ordered and unordered nested lists, blockquotes, tables and code. Raw HTML stays inert, embedded images do not load, and links accept only HTTP(S) and mailto URLs without credentials.
- Turndown preserves structure from provider HTML. Navigation, footer, forms, scripts and embedded media are removed. Selecting the correct role fragment remains the collector or research agent's responsibility; this is not a universal careers-page extractor.
- The research skill now requires scoped Markdown and accurate full/excerpt labels. Existing flattened records are not silently relabelled or assigned invented structure.
- Public deployment assets include the Markdown module, parser and its license. Private installations consume the same package.

## Validation

The new collector and browser tests first reproduced the lost heading/list semantics. After the fix, 69 Node tests and 12 browser tests pass. The browser suite checks nested numbered lists, unsafe markup, 320/390 px alignment, long text, keyboard-accessible controls and the existing review/resume/task workflows. Screenshots use synthetic data. `npm audit` reports zero vulnerabilities for the installed dependency lockfile; this is not a guarantee of overall security.

The portable CLI test exposed an eager provider dependency; conversion now loads its dependency only when HTML conversion is requested, preserving offline help/onboarding.

## References

- [W3C: content structure](https://www.w3.org/WAI/tutorials/page-structure/content/) — semantic paragraphs and ordered/unordered lists.
- [W3C: headings](https://www.w3.org/WAI/tutorials/page-structure/headings/) — readable and navigable section hierarchy.
- [NN/g: defer secondary content on mobile](https://www.nngroup.com/articles/defer-secondary-content-for-mobile/) — prioritize essential scanning information.
- [Marked documentation](https://marked.js.org/using_advanced) and [Turndown](https://github.com/mixmark-io/turndown) — parser and converter contracts.

## Follow-up: record boundaries and stale open clients

The flat mobile list still made consecutive roles look like one record. Rows now have separate surface backgrounds, a complete border and a 16 px gap. Company/score, role title, evidence/time and the action footer have stable positions. Source links, timestamps, existing resumes and recorded submissions use labelled icons; absence of a resume does not add another line. Personal decisions remain an explicit select. Desktop keeps its table layout.

The header refresh previously fetched state without replacing the current JavaScript. An already-open client could therefore show old layout and text even after a successful deployment. Refresh now performs a full navigation reload; the existing no-store headers, versioned entry assets and BFCache handling remain in place. Existing old tabs must navigate to the new page before they can use this updated handler. No claim is made that server deployment can replace JavaScript already running on a phone.

Before the fix, the new browser checks observed zero inter-record spacing, text-based source/time controls and a client sentinel surviving Refresh. After the fix, all 69 Node tests and 14 browser tests pass, including Chromium and WebKit at 320/390 px. Tests verify equal modal side margins, JD-before-preparation order, close icon, reading focus, no horizontal overflow, icon destinations and complete client reload. WebKit is a Safari-engine check, not a physical iPhone test. Synthetic screenshots show the complete centered dialog and adjacent cards.

Consolidated the competing mobile row CSS blocks. Static heading focus no longer draws WebKit's interactive-looking focus outline; keyboard focus styling remains on interactive controls. No workspace data or personal decisions changed in this follow-up.

## Dialog footer and preparation shortcuts

Original job and Archive/Restore now live in a fixed dialog footer outside the scrolling body. The header and footer remain visible without overlaying the last content item. Preparation uses one row of three icon-and-label shortcuts (Resume, Interview, Tasks); the duplicate external application link was removed. Each shortcut moves reading focus to its destination.

Chromium and WebKit tests cover the footer before/after body scrolling at 320, 390 and 1280 px, archive persistence, shortcut alignment and all three destinations. A visual check found preceding text leaking into the padding above sticky section tabs; the failing WebKit measurement showed a 20 px gap. The body padding was moved to its first content item so the tabs attach directly below the header. Verification remains 69 Node and 14 browser tests, with synthetic screenshots.

## Card triage and restrained motion

The card supports one decision: whether to open a role. Its top-right area now shows a current score, a single Reassess action for a stale assessment, or nothing for an unrated role. The previous score remains in the action's accessible name and tooltip, and the action opens the fit evidence. Unknown remote markers no longer compete with the score. Verified checks remain in the icon strip; the dialog retains unknown and excluded evidence. Ability fit, eligibility and personal decisions remain separate.

Search dates show month/day, with the full time retained in accessible labels and tooltips. Mobile cards keep their boundaries and bottom action row. No workspace data or decisions changed.

Shared motion tokens define 120 ms control, disclosure and notification feedback and 180 ms page/tab and dialog fades. Source-link arrows move one pixel on precise-pointer hover; enabled buttons have a one-pixel press response. Search typing, sorting and same-view state updates do not replay page animations. There are no staggered card entrances, loops, animated layout dimensions or new animation dependencies. Reduced-motion mode disables CSS animation/transitions and JavaScript view animation. Dialog centering, fixed footer and immediate navigation are preserved.

The stale-score test first failed on the visible old number; the view-transition test first observed no animation. Subsequent failures identified test assertions racing asynchronous state loading after navigation; they now wait for the relevant UI. Final verification: 69 Node tests, 14 browser tests including Chromium and WebKit, build and dependency audit (zero reported vulnerabilities). Browser checks cover normal/reduced motion, no animation replay while searching, compact dates with full-time labels and absence of remote/unrated placeholders. Synthetic screenshots were inspected for card spacing, long titles and stale scores. These checks do not substitute for a physical iPhone test.
