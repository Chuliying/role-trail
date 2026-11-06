# CI verification

`Tests / test` runs on pushes and pull requests. A passing local run is not a passing GitHub run. Check the workflow for the exact commit before calling a release CI-verified.

## Environment and checks

- Node 22 and `npm ci --ignore-scripts` use the committed lockfile.
- The official Playwright 1.64.1 Noble container is pinned by digest in `.github/workflows/test.yml`. It already includes Chromium, WebKit and their Linux dependencies. The workflow checks the installed Playwright version against the image version before testing; update both together.
- A separate PostgreSQL 17 service holds synthetic test data. Container jobs address it as `postgres`, not `localhost`. Never supply a real workspace database.
- Typecheck, formatting, dependency audit, Node/PostgreSQL tests, build and all browser tests must pass. Tests do not automatically retry failures.
- The job limit is 15 minutes; installation and browser-test steps each have a five-minute limit. A newer run cancels obsolete work on the same ref.
- Browser HTML reports, failure screenshots and retained traces upload as `browser-results` for seven days. They use synthetic fixtures, not private workspaces.

To inspect a failure, open the failed job and download `browser-results`. Open its HTML report, or use `npx playwright show-trace <trace.zip>`. Fix the underlying failure before rerunning; do not update layout fixtures only to turn the check green.

## Layout portability

`tests/fixtures/ui-layout.json` keeps exact fixed dimensions, spacing and style tokens. The brand, title, navigation and JD reading column have text-dependent widths. Their tests assert visible content, parent containment, no clipping and the JD's current font-relative maximum instead of comparing a macOS font measurement against Linux. Dedicated tests still cover navigation centering, mobile alignment, touch targets, select widths and overflow.

After an intentional layout change, inspect the affected widths, then use `RECORD_LAYOUT=1 npx playwright test tests/browser/style-parity.spec.mjs`. Review the fixture diff and run again without `RECORD_LAYOUT` before committing. Never record a baseline as part of CI.

## November 6 incident

[Run 42163767879](https://github.com/Chuliying/role-trail/actions/runs/42163767879) failed after approximately 48 minutes. Browser/system installation consumed 46m28s; the Ubuntu mirror delivered 106 MB in 45m33s at 38.6 kB/s. Browser tests then finished in about 70 seconds: 68 passed and one failed.

The failure was the style baseline's exact comparison of text/ch-based widths recorded on macOS with Linux results. Earlier pushes also failed that comparison. Node tests and build passed. The old workflow skipped audit after the browser failure.

The correction removes repeated apt/browser installation from CI, adds bounded execution and retained diagnostics, and replaces only intrinsic-width equality with layout constraints. README now describes the current controls, fonts and verification boundaries. No application behavior, data schema or production deployment changes are required for this CI correction.

Verification status: the GitHub run for the exact commit is authoritative for CI. [Release evidence](release-check.md) records dated local and installation checks; those do not imply hosted success.
