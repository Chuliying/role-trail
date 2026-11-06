# Independent review brief

Review baseline: 293b8be43b95deb855f56f592a24d88d1096c07f. Candidate branch: codex/react-workbench.

User approved full React frontend migration and requested Claude Code Opus 5.5 at high effort after completion. A new Claude session was successfully initialized with that exact model on 2026-11-06; review has NOT occurred yet.

Review the actual diff, runtime ownership and behavior. Prioritize concrete bugs and lost features over preferences. Check src/client, build packaging/static allowlist, generated asset consistency, original browser tests, stale response ordering, failed mutations, queue/approval/application separation, unsafe JD handling, data exposure, keyboard/touch/focus and Shortlisted action width with Chinese labels and extra icons. The user additionally requires TanStack React Query for GET/POST and a concise SOLID file structure. Inspect stale cache rejection, synchronous double-submit guards, retry:false for writes, cancellation, pending/error recovery and responsibility boundaries. See acceptance.md for complete behavioral checklist.

No production writes, credentials, personal data or deployment changes are needed for review. Do not edit code during the independent pass. Report each finding with severity, file/line, reproduction and consequence; explicitly distinguish verified test results from inspection. If no blockers, say so and list unverified areas.
