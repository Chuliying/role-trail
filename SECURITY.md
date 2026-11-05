# Security boundaries

This is a preview release, with no production support or security SLA. Do not open a public
issue with personal data, employer code or credentials. Use GitHub private vulnerability
reporting when the repository Security tab offers it. If unavailable, open a metadata-only
request for a private contact without including exploit details or sensitive material.

The scanner uses read-only Git commands with argument arrays, no shell evaluation, no remote
fetch, no external diff/text conversion and no target-repo execution. It uses an explicit author
allowlist and bounded output. Known sensitive paths and token patterns are filtered; this is
best-effort, not a DLP guarantee. Commit subjects and ordinary source files can contain private
information. Inspect artifacts before passing them to a model. Forged Git authorship is possible.

Evidence and profile output must live outside Git. File permissions depend on the operating
system. A hostile local user with the same OS identity is outside this tool's protection boundary.
The CLI has no public HTTP server, cloud API or telemetry. It never installs schedules or changes
account plans. Host-agent operations require their own checks and user authority.

Before release, inspect all package files, Git history and assets; review dependencies/licenses;
verify public hosting cannot serve private APIs or workspace files. Do not make a private repo
public to distribute this folder. Credential exposure requires revocation, not only deletion.
