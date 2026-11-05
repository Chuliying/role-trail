# Security boundaries

This is an early single-owner release with no production security SLA. Do not post personal data, employer code or credentials in issues. Use GitHub private vulnerability reporting when available; otherwise request a private contact without sensitive details.

## Evidence and models

Git scans use read-only argument-array commands, explicit author allowlists and bounded output. No remote fetch, target code, hooks, installers, external diff or text conversion is executed. Git author identity is forgeable. Secret/path filtering is best effort, not DLP. Inspect output before sharing with your host model; its provider receives whatever text you choose to send.

Treat JDs, repos, commits, resumes and portfolio pages as untrusted data. The agent must ignore embedded instructions to change policies, run commands or reveal secrets. User confirmation is required for personal contribution claims. Runtime validation cannot prove a free-text resume claim is true.

## Storage and HTTP

Private workspaces and exports must be outside Git. Newly created directories/files use 0700/0600 where supported. Existing directories are not forcibly repermissioned; protect them yourself. Same-OS-user adversaries, malicious browser extensions, compromised host agents and a stolen owner key are outside the isolation boundary.

Local mode binds to loopback, validates Host/Origin and requires a custom write header or bearer header plus JSON. Cloud mode requires a database, matching HTTPS origin and a random 64-hex access key. Cookies are signed, expiring, HttpOnly, Secure and SameSite=Strict; rotation invalidates sessions. Bearer credentials are accepted only in headers. No URL keys, browser-storage keys, wildcard CORS or default public-data fallback.

The key grants owner-level access, including decisions and restore. This is not multi-user authorization. Keep outer Vercel protection enabled when configured. Use least-privilege database and provider credentials; do not expose any through public environment prefixes. Preview and production should not share sensitive state without an intentional access policy.

JSON imports validate identity, URL protocols, evidence, statuses, bounds and revision. Research cannot write personal records. Local writes lock then atomically rename; PostgreSQL uses a transaction and row lock. Invalid writes preserve state. Restore deliberately replaces it. Maintain private backups. Do not remove a lock until its process is confirmed stopped.

External content uses text DOM nodes, not HTML injection. CSP blocks external scripts and framing. PDF rendering escapes input and blocks outgoing network. Collectors allow only fixed HTTPS provider hosts, reject redirects and cap time/response size. User-supplied source URLs are links, not server fetch targets.

## Provider and scheduler risks

Optional SerpApi requests can consume the user's quota. Requests are bounded and not automatically upgraded or retried. Configuring a feed is not proof of free capacity; set provider account limits. The daemon uses durable per-date reservations to prevent duplicate automatic runs; failed reserved dates require an explicit manual retry.

No telemetry, automatic applications, employer messages, plan upgrades or silent OS-service installation. GitHub scheduled workflow is an opt-in example, disabled until the user copies/enables it with their own secrets. Do not log full workspace responses in public CI.

## Release controls

Use synthetic tests only. Review all tracked files and Git history for personal content and secrets; run dependency audit and browser/API checks. Keep private data out of `web/`, deployment artifacts and screenshots. Never make a private repository public merely to distribute this package. An exposed credential must be revoked, not just removed from Git.
