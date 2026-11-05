# Workspace layout review

Scope: shared Role Trail UI, both desktop and mobile. Review used frontend-design and the Web Interface Guidelines (https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Fixtures contain synthetic data only.

## Findings and changes

- `src/ui.css` — Mobile list metadata used absolute positioning and repeated separators. Long company names competed with fit and remote indicators. Replaced this with explicit grid rows and shared left edges. Dates occupy one compact line; decision and source controls share a baseline and 44px height.
- `web/app.js` — Empty date and resume placeholders repeated on every row. Omit absent list metadata; keep existing resumes, recorded applications and stale-score labels. The detail view still exposes missing information. Posting-kind semantics remain present on desktop.
- `web/app.js` — Application-package instructions preceded the actual role title. Show identity first, then distinct material/review/eligibility statuses and navigation. Remove repeated non-submission explanations; retain actual submission state.
- `web/app.js` — Preparation acceptance criteria and dependencies dominated task names. Keep the checkbox/title visible and move supporting details into a native disclosure. Each repeated shared task gets a unique control/label ID; expanding criteria cannot toggle the checkbox.
- `web/app.js` — Research logs exposed raw query strings and long run notes by default. Keep source, status and screening/full-JD counts visible. Put original notes and query evidence in disclosures without deleting them. Keep source-bundle access.
- `src/ui.css` — Card titles, action rows and detail sections used unrelated spacing. Apply shared section/group/item spacing, consistent card padding, wrapping action grids and aligned profile field/value pairs.
- `web/index.html` / `src/ui.css` — Add a keyboard skip link, focus styles for disclosure summaries, a matching browser theme color, and space for bottom navigation during focus scrolling.

## Verification

- Node: 68 tests passed; browser suite: 11 tests passed.
- Browser coverage includes 320/390/1280px, long company names and queries, title-before-package order, independent checkbox/disclosure interaction, shared-task updates, and desktop/mobile profile layout.
- Browser screenshots inspected for jobs, preparation, research, detail, and profile. Build, format and dependency audit passed.
- Existing warm-neutral hover, touch behavior, keyboard focus, sort order, personal decisions, source evidence, PDFs and draft approval are retained. No schema, API or private-data changes.

## Limits

This is a layout and interaction pass, not a claim of full accessibility certification. Tests use Chromium, not physical iOS Safari. JSON editors, provider setup and URL-state navigation remain existing product behavior. Schedule execution and private-data accuracy are not established by a visual review. No research was performed or imported.

## Score and dialog follow-up

- Historical fit uses a compact score with a clock icon and dotted underline. Its accessible label/title identifies it as previous fit requiring reassessment; clicking opens the stale assessment. The extra text row is removed without presenting the old score as current.
- Company, fit and remote indicators align vertically on mobile. The score control remains 44px tall.
- Dialogs use automatic margins to stay centered. The detail close control is a labelled 44px icon button. Initial focus goes to the role heading, retaining keyboard focus indicators on interactive controls.
- The JD precedes fit/evidence and application preparation. Three navigation controls jump to JD, fit/checks or preparation and move keyboard focus to the destination.
- Fresh build, 68 Node tests, 11 browser tests, formatting and audit passed. Added checks for stale-score interaction, dialog centering, initial focus and JD-before-package order. Inspected synthetic score and mobile-dialog screenshots.
