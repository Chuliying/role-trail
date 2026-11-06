# React migration review

Baseline: `293b8be43b95deb855f56f592a24d88d1096c07f`.

## Spec inspection

Independent review passed after one correction: the Research and tools-menu collection controls now disable while another workspace mutation is pending. A cross-view regression exercises both entrypoints, failure recovery and zero collection requests during that interval.

The reviewer checked React ownership, query/mutation coverage, revision ordering, conditional GET and delta recovery, cancellation, navigation/editor guards, feature extraction, resume/PDF/task semantics and the static distribution contract. The reviewer independently ran strict typecheck; browser results are separate implementation evidence.

## Independent checks

- Root strict typecheck passed.
- Root Node suite: 85 passed, zero failures or skips.
- Root final frozen browser suite: 69 passed in 49.6 seconds, including Chromium and WebKit cases.
- Root visually inspected synthetic Chinese Shortlisted screenshots at 390 and 1280 px; labels and three action icons remain readable.
- Dependency audit including React Query: zero known vulnerabilities.
- Clean production-only installation with `--ignore-scripts`: passed; canonical static assets copied byte-for-byte without frontend development dependencies.
- Secret preflight passed. Its generated-bundle log warnings resolve to bundled React/Scheduler error reporting and Marked parser diagnostics; client source contains no credential logging.

The React entry measured about 128 KB gzip, compared with about 62 KB summed gzip for the previous browser modules. These are local compression measurements, not network or rendering benchmarks. React and Query add runtime weight in exchange for shared component lifecycle and cache management. Do not describe the migration as a proven speed improvement.

## Claude Code review

Claude Code completed a read-only review using the requested Claude Opus 5.5 model at high effort. It found no migration blocker, but identified filter/history restoration, incomplete synchronous guards on selects/checkboxes, an initial stale-status flash and a focus-test event mismatch. All actionable findings were corrected and covered by regressions. The same requested model completed a focused rereview against the frozen candidate and reported no blockers. It confirmed the filter/history fix, synchronous select/checkbox guards, pending preparation binding, meaningful focus test, deployment-hook extraction, expanded widths, dirty native-close handling and login credential lifetime/type fix. The root reran the complete suite on that frozen candidate.

The reviewer confirmed actual React ownership, canonical revision-safe Query cache, query/mutation coverage, safe Markdown, separate resume/application decisions and shared static packaging. It ran typecheck; the root independently owns full-suite and deployment verification. Intermediate-width action wrapping is intentional to preserve readable labels. Body hydration can recover from extension-injected markup; no real-device or external-job-source reliability claim follows from these tests.

## Boundaries

Tests use synthetic data. No research import, personal decision, resume approval or application is part of this frontend change. Disabled controls and synchronous locks prevent duplicate UI submissions; revision checks reject stale writes. They do not establish exactly-once delivery across clients or networks.

## Cleanup

Twelve replaced browser renderer/control modules are removed and no live source references them. Their previous contents remain recoverable from the baseline Git commit. Shared pure policies used by the CLI/domain remain. The private wrapper clears only its dedicated ignored web output before rebuilding; a regression seeds an obsolete asset and requires the final file inventory to equal the canonical public allowlist.

## Final acceptance

A final independent agent found no material blocker, independently passed strict typecheck with Node 22 and diff validation, checked the frozen 69/69 browser log and CC verdict, and confirmed the private cleanup directory is ignored and distinct from data/backups. Staged security and live deployment verification are completed by the release owner separately.
