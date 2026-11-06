# Full research record reader

The research action opened a generic binary artifact in a new tab. A mobile browser could display a blank page even when the saved bundle existed. Read-only checks of the existing installation found 27 referenced archives with matching hashes and valid run/job structures.

The action now opens a modal reader, full screen on mobile, using the archived run notes, coverage and job snapshots. It does not substitute current job records for history. The authenticated `/api/research?run=ID` endpoint verifies the referenced hash and bundle identity. `download=1` returns the exact bytes with a JSON MIME type and safe attachment filename. No shared state is changed.

Loading, no saved jobs, missing archives and invalid archives have explicit states. Retry remains inside the reader. Closing aborts loading and restores focus to the originating button. Stored Markdown uses the existing safe renderer; raw fields remain available as escaped text.

Validation: 75 Node tests, 18 browser tests, build and dependency audit passed. New Chromium and WebKit mobile cases cover rendering, full-screen sizing, overflow, focus restoration, JSON download, missing data and retry, and a valid zero-job record. API tests cover authentication, byte-exact responses, download headers, missing and corrupt artifacts. Screenshots use synthetic data only.
