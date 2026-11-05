# Setup parity and release acceptance

The private installation is the product target, not a dependency of this release.
No maintainer account, database, author email or deployment identifier is reusable by users.

| Capability | This candidate | Required before claiming equivalent setup |
| --- | --- | --- |
| User-specific field, portfolio, languages, location and sources | Working setup/init CLI | Interactive host onboarding usability trial |
| Selected repo + commit evidence | Working bounded local CLI; synthetic Git tests | User-reviewed attribution and privacy check |
| Master / per-JD resume and adjustment notes | Host-agent instructions | Both hosts produce and visually inspect a real synthetic PDF |
| Fit / eligibility / personal decision separation | Agent contract | Generic persistent dashboard implementing all three |
| List, lightbox, shortlist, applied, archive, todo, resume review | Private system only | Portable UI + local/DB adapters + cross-adapter behavior tests |
| Source collectors | Not bundled in this candidate | Parameterize geography, language, field and sources; include schema, provider adapters and tests |
| Claude Code / Codex schedules | Generated brief and activation contract | Real task creation, manual trial, timed trigger, disable and idempotent reconfiguration on each host |
| Vercel + PostgreSQL / cross-agent sync | Not bundled | Generic migrations, own-project setup, authentication, CAS imports, backup/restore and concurrent-write tests |
| Public repo / license / hosted demo | Standalone MIT preview; no hosted demo | See docs/release-check.md for shipped scope and checks; full workflow rehearsal remains open |

## Delivery decision: prompt first

Engineering users run [BOOTSTRAP.md](../BOOTSTRAP.md) in their existing coding agent.
A dedicated wizard, automatic cloud provisioner and universal scheduler installer are not
release requirements. The agent can build missing pieces and configure supported tools.
The resulting workflow still needs an actual clean-environment rehearsal; a well-written
prompt alone does not establish functional parity. Cloud is optional, and the user's local
working system is the first acceptance target. Keep generated code and its verification
visible in setup-report.md. The capability inventory above describes shipped code only.

## Target installation flow

1. Download standalone package, verify Node22/Git, run tests and setup.
2. Confirm profile and selected repository evidence; draft resume, review factual claims.
3. Follow BOOTSTRAP.md to reuse shipped components and implement the missing local dashboard,
   storage and source integration in a user-owned implementation directory. This package does
   not currently ship those components; verify generated implementation before claiming setup.
4. For cross-agent cloud use, create the user's own private Git, Vercel project and PostgreSQL
   database. Keep authentication enabled. Provide only runtime-scoped secrets to trusted agents.
   Do not point a new user at the maintainer's infrastructure. The provisioning command does not
   exist in this preview; steps must not be reported as automated or verified.
5. Configure selected sources with the user's geography/language. Prefer official public ATS/API.
   Optional provider accounts require that user's keys and quota monitoring. Provider success
   must be measured by actual usable descriptions, not HTTP200 or listing counts.
6. Configure host scheduling only after a successful bounded manual search and validated save.
   Require a task receipt and subsequent actual timed run, then monitor failures and usable JDs.

## Lessons retained from private acquisition trials

- Search language matters. A successful empty English query does not prove missing jobs or
  broken authentication. Support per-source query rotation and preserve the actual query.
- A cloud scraper may return only listing snippets. Keep these as leads, not full JD coverage.
- A key being configured does not prove the collector works. Test account, request, parser,
  completeness and provenance separately. Fixture tests do not establish live platform uptime.
- Separate disabled optional services from missing configuration and upstream failure.
- Avoid free-tier guarantees in code or docs: users must check current provider terms. Do not
  auto-upgrade, bind a card or retry a potentially billed request without a bounded policy.

## Release rehearsal

Use a new synthetic user with a non-frontend field and a non-Taiwan timezone. Copy only this
candidate directory into an empty location; no parent Git history, node_modules or credentials.
Run npm test. On each host, complete interview → selected Git evidence → reviewed resume →
manual search → stored result → task registration → actual trigger → pause. Record command,
artifact, timestamp and any unsupported step. The current automated tests cover only the local
onboarding/scanner and standalone command chain; other rows remain open release gates.
