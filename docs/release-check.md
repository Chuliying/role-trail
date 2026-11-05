# Preview release checks — 2026-11-05

This repository starts with a new Git history containing only the public package. No private
application history, database exports, resumes, deployment configuration, credentials, fonts
or binary assets are part of the release.

## Verification performed

- Node22 local tests: 6/6 pass. Tests exercise actual synthetic Git histories and a standalone
  copied package, including author filters, coauthor labels, merge exclusion, bounded export,
  redaction, path containment, idempotent initialization and CLI workflow.
- npm audit: zero vulnerabilities; the package has no external npm dependencies.
- Heuristic secret scan: scanned mjs/js/json/md/yml, checked staged changes and .env exclusion.
  Two placeholder candidates were manually reviewed as synthetic test data. The initial
  non-obvious test token was renamed to an explicitly fictional example; its redaction
  assertion remains in place. No real credentials were found in the examined candidate.
- Manual review includes file allowlist, local paths, contact data, account/deployment IDs,
  Git metadata, examples, Markdown and hidden configuration. Example identities are fictional.
- CI runs tests and audit with read-only repository permission, no repository secrets, and
  commit-pinned checkout/setup-node actions. Package scripts do not execute scanned repos.

Automated scanning is heuristic, not a guarantee against every possible secret representation.
The scanner's evidence redaction is likewise best effort; users must inspect their own exports.

## Not claimed

No hosted service, full dashboard, production cloud deployment, automatic scheduler installer,
PDF-rendering acceptance or successful end-to-end Claude Code/Codex build is claimed. See
setup-parity.md and BOOTSTRAP.md. This is an MIT-licensed preview with a prompt-first build path.
