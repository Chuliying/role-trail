# Set up a user's workspace

Use `../../../BOOTSTRAP.md` as the entry checklist and `../../../docs/vercel.md` for deployment commands. Finish the setup work the user authorized; don't hand back instructions that require them to rebuild the app.

## Establish preferences and evidence

Ask only for missing information, in small groups. Record target roles and seniority, legal work location, remote/relocation rules, languages, working-hour overlap, compensation, travel, product interests, company restrictions and preferred sources. Use the profile's structured fields plus `searchNotes` for details. Turn hard requirements into `requiredChecks` entries with stable `key` and readable `label`. Use criteria that fit this person; do not impose an AI/frontend/Taiwan profile.

Ask for authorized portfolio/resume URLs and local repositories with exact author identities. Use the bounded Git scanner and `../../../docs/agent-workflow.md` to review actual contributions. Read authorized LinkedIn or resume links with available host tools; request text/export if access fails. Confirm claims with the user before saving them as confirmed capabilities. Save source citations and master-resume notes outside Git.

Run the app locally with synthetic data first, then initialize a separate real workspace. Existing workspaces must be preserved. Show the saved preferences to the user so they can correct them. Later edits in the app become the next run's inputs.

## Connect the user's Vercel and database

Follow the deployment guide with their accounts. Keep secrets in their private environment or secret manager. Ask for login/MFA or a missing authorization only when needed. Do not claim a connection is working because an env variable name exists.

Verify the deployed URL, unauthenticated API denial, authenticated read/write, reload persistence and access from a second client. Keep outer Deployment Protection enabled. Use the same authoritative API for future agent sessions. A real profile/backup belongs in private storage, never in the public fork.

## Register an LLM task

Discover the host's actual scheduling capability. Configure one task that launches an LLM session with this skill and the resolved version of `../../../prompts/daily.md`. The task needs the trusted checkout, an accessible private run directory, and the configured API credentials through its runtime environment. It must work when the user is not interacting with the browser; use public HTTP/APIs before relying on a logged-in UI.

Reuse an existing matching task. Verify its saved prompt, checkout/working directory, timezone, time, enabled state and available tools. Never assume a Claude CLI flag, host scheduler or unattended credential exists. If this host cannot schedule LLM sessions, report that specific missing capability. The feed daemon/cloud tick is an optional collector, not a replacement for the promised LLM workflow.

Run the exact daily prompt once manually. Check its writes and completion report. Record the actual task/service ID, next run, pause method and manual result in a private `setup-report.md`. Keep timed execution marked unverified until a real scheduled run is observed. A prompt file, a successful collector or a manually started chat is not proof of a timed trigger.

The setup report should separate working, blocked and not-yet-observed items. Include the user's URL and concrete next action for each remaining item. Do not call the full installation ready while required accounts, API access or the LLM task are missing.
