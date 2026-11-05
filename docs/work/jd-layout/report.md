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
