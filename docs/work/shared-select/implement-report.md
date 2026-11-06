# Shared selection controls and mobile alignment

Desktop decision tabs now meet the table without a second border or a gap. The adjustments control sits at the right end of that row; on phones it remains beside the page title.

All three native select instances use `selectControl` from `web/controls.mjs`. One CSS rule owns the arrow and its 16px inset, with 44px reserved for the arrow gutter. Decision-specific rules only change the surface and vertical spacing. Native keyboard selection, mobile pickers, pending feedback and failure rollback remain intact.

Mobile cards share a 16px content gutter between their body and footer. The score circle, dates and source-link glyph align to the right content edge. The score and link retain 44px targets. A negative half-difference between glyph and target widths aligns the link's visible icon without reducing its target.

Unrated roles show a clickable em dash with a localized explanation. Missing scores remain missing; no zero, rating or eligibility is inferred. Existing scores and stale treatment are preserved.

## Verification

- RED: desktop gap measured 16px in Chromium and WebKit; missing-score trigger absent; mobile score inset differed by 9.203125px.
- Focused browser checks: five passed, including 320/390/720px mobile geometry, native selection and filter application in both engines.
- Synthetic screenshot reviewed: long title, three verification icons, posting date, search date and source link. No private data used.
- First full browser run exposed test-state leakage in the new mobile case and the expected old geometry snapshot. Isolated synthetic state now prevents cross-test mutations from changing the role under inspection; reviewed layout baseline was updated.
- Full verification and delivery results recorded below after execution.

No server, database, authentication or personal-progress code changed. Tests use synthetic state; dependency versions unchanged.

Final local checks: Node 22 build, 85 Node tests, 51 browser tests, formatting and whitespace checks passed. Dependency audit reports zero vulnerabilities. Secret preflight passed; its six existing synthetic-fixture suppressions and unchanged vendored marked log heuristic were reviewed. No auth surface changed. Chromium/WebKit rendered the same aligned card edges within 1px; targets remain at least 44px.

Delivery scope: controls, filter and job-list rendering, score explanation/locales, their stylesheet sources/generated assets, the geometry fixture and five regression cases. The private installation receives the exact public commit through its existing pinned runtime, without database writes.
