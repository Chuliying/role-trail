# Full research record reader

The research action opened a generic binary artifact in a new tab. A mobile browser could display a blank page even when the saved bundle existed. Read-only checks of the existing installation found 27 referenced archives with matching hashes and valid run/job structures.

The action now opens a modal reader, full screen on mobile, using the archived run notes, coverage and job snapshots. It does not substitute current job records for history. The authenticated `/api/research?run=ID` endpoint verifies the referenced hash and bundle identity. `download=1` returns the exact bytes with a JSON MIME type and safe attachment filename. No shared state is changed.

Loading, no saved jobs, missing archives and invalid archives have explicit states. Retry remains inside the reader. Closing aborts loading and restores focus to the originating button. Stored Markdown uses the existing safe renderer; raw fields remain available as escaped text.

Validation: 75 Node tests, 18 browser tests, build and dependency audit passed. New Chromium and WebKit mobile cases cover rendering, full-screen sizing, overflow, focus restoration, JSON download, missing data and retry, and a valid zero-job record. API tests cover authentication, byte-exact responses, download headers, missing and corrupt artifacts. Screenshots use synthetic data only.

## Consistent close control and focus styling

The research header now uses the same quiet 44 × 44 X button and compact header spacing as the opportunity reader. Opening focuses the reading heading rather than automatically highlighting the close button. All CSS outlines were removed, including shared verification controls; keyboard focus uses an inset underline, with an inverse color on primary actions. Regular control boundaries are preserved. Chromium/WebKit checks cover close size, transparent border, no outline and a visible keyboard-focus alternative. No data changes.
