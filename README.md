# Role Trail

Role Trail is a private job-search workspace operated by your Claude Code or Codex agent. You set your preferences and provide your resume, portfolio or selected repositories. The agent helps deploy your workspace, registers a recurring LLM task, then researches roles and prepares the applications you shortlist.

Vercel hosts the app and API; PostgreSQL keeps shared records. Your coding agent does the research, fit assessment, resume writing and interview preparation. The app keeps ability fit, eligibility evidence and your application decision separate.

Start with the demo below, or give your agent the setup prompt. Each installation uses its owner's accounts and data.

## Try it locally

Requires Node.js 22+ and Git. All demo people, companies, roles and evidence are synthetic.

```sh
git clone https://github.com/Chuliying/role-trail.git
cd role-trail
npm ci --ignore-scripts
node bin/role-trail.mjs demo --workspace "$HOME/.local/share/role-trail-demo"
node bin/role-trail.mjs serve --workspace "$HOME/.local/share/role-trail-demo"
```

Open http://127.0.0.1:4318. Read a JD, shortlist it, check off a preparation task, and generate a resume. You can review the wording changes before approving it. These records survive a reload. Keep the demo separate from your real workspace.

## Set up your own workspace with one prompt

Open this checkout in your coding agent and paste:

> Read BOOTSTRAP.md and skills/role-trail/SKILL.md. Set up Role Trail for my job search. Help me define my preferences, review my resume/portfolio and authorized Git contributions, and deploy my own private Vercel/PostgreSQL workspace. Create one recurring LLM task in my supported Claude Code or Codex environment using the bundled daily skill. Run it once manually, verify the saved results, and give me the URL and setup report. Ask only for missing information or account steps I need to handle. Don't apply to jobs, invent experience, publish private data or change paid plans.

The [onboarding guide](BOOTSTRAP.md) and [bundled skill](skills/role-trail/SKILL.md) tell the agent what to execute and how to check the result. The host model provides the reasoning; this workflow needs no separate model API key. Hosting and optional search providers use your own accounts. Keep credentials in their secret settings or your runtime environment.

## What it does

| Part of the workflow | What happens |
| --- | --- |
| Preferences and experience | Save target roles, location, languages, company restrictions, search notes and required criteria. Scan only authorized Git authors and repositories; confirm personal contributions before using them in a resume. |
| Research | The agent searches the selected platforms and original employer pages. Built-in Himalayas, Greenhouse, Lever and optional SerpApi feeds help collect data. Source coverage records what was actually read, including failures. |
| Fit and eligibility | The agent saves a 1–10 assessment with evidence and gaps. Eligibility needs its own sources and dates. A high score is not permission to work in a country or a prediction of an offer. |
| Your decisions | Move roles through To Review, Shortlisted, Applied and Passed. Archive manually and keep preparation todos. Research does not make these decisions for you. |
| Resumes | For shortlisted jobs, the agent tailors confirmed experience to the JD and explains the edits. The app keeps versions and review status, with printable HTML and local PDF output. Current pending/approved drafts aren't regenerated on every run. |
| Interview preparation | The agent writes role-specific project examples, possible concerns, practice questions and questions for the employer. The app saves versions and evidence snapshots, and flags changed JD/resume/evidence bindings. |
| Shared workspace | Use local JSON or your own PostgreSQL and authenticated API. Agents read the same current state. Revision checks prevent silent overwrites. |
| Scheduled work | A real host LLM task loads the skill, researches, assesses, prepares and saves results. `workflow` supplies current inputs; `work-check` checks saved deliverables and personal-state changes. The feed-only runner is available separately. |

The workbench has a responsive table, structured JD dialog, source links, filters, fit explanations and research history. The default order is newest search, then highest fit. Original JD text, completeness, sources and posting/update/repost distinctions are retained.

A scheduled task needs a host that can start LLM sessions with the right tools and credentials. Onboarding verifies that environment; a downloaded prompt cannot activate it by itself.

## Useful commands

```sh
# Real profile and local workspace
node bin/role-trail.mjs setup --workspace "$HOME/.local/share/role-trail"
node bin/role-trail.mjs serve --workspace "$HOME/.local/share/role-trail"

# Only repositories and author aliases you authorize
node bin/role-trail.mjs scan --workspace "$HOME/.local/share/role-trail" \
  --repo /absolute/path/to/your/project --author you@example.org --max-commits 50

# Execute the configured source feeds and save their actual coverage
node bin/role-trail.mjs collect --workspace "$HOME/.local/share/role-trail"

# Missing, stale or changes-requested shortlisted drafts
node bin/role-trail.mjs draft --workspace "$HOME/.local/share/role-trail"

# Local PDF renderer (one-time browser installation)
npx playwright install chromium
node bin/role-trail.mjs resume-pdf --workspace "$HOME/.local/share/role-trail" \
  --job JOB_ID --output "$HOME/.local/share/role-trail/resume.pdf"

node bin/role-trail.mjs help
```

For agents, `init --profile /private/profile.json` replaces the interactive interview. Use `action --file`, `import --file`, `evaluate --job`, `export --output` and `restore --file --revision` to operate the same store. Cloud data commands accept `--remote` with runtime environment credentials. [Data contract](docs/data-contract.md).

## Deployment and the daily workflow

- [Vercel frontend + API + your PostgreSQL](docs/vercel.md): actual entry point, migration, environment configuration, authentication, deployment and verification steps.
- [Source configuration](docs/sources.md): query settings, limits, free public routes and optional credentials.
- [Daily scheduling](docs/scheduling.md): register a host LLM task; optional daemon/GitHub Actions collectors support source collection.
- [Agent evidence and resume workflow](docs/agent-workflow.md): contribution confirmation, LinkedIn fallback and tailoring instructions.
- [What is verified](docs/setup-parity.md): code tests, agent work and checks needed in your own installation.
- [Source playbook](docs/source-playbook.md): agent routes for 104, Job-Frog, Wellfound, LinkedIn, Indeed, Google Jobs, Japan Dev, TokyoDev, Wantedly, Himalayas and employer pages. Choose the sources relevant to you.

## Reliability and protection

Research, decisions, tasks and resumes use separate records. Stale writes fail with a revision conflict. Invalid imports do not partially modify state. PostgreSQL uses a locked transaction; local writes use a lock and atomic rename. Back up before restoring or upgrading.

The local server binds to loopback and rejects unexpected Host/Origin values. Cloud APIs fail closed without a database, HTTPS origin and a random 256-bit access key. Browser sessions use signed, expiring HttpOnly/Secure/SameSite cookies; machine clients use a bearer header. No keys in URLs or browser storage. Rotating the access key invalidates sessions. Treat anyone with the key as the workspace owner.

External text is rendered as text, not executable HTML. Public collectors use fixed provider hosts, bounded responses, timeouts and no redirects. Resume PDFs are generated with outgoing network requests blocked. Workspaces and generated files must be outside Git. The public static directory contains only application assets.

Git scans do not fetch or execute repository code, hooks, tests, installers or external diffs. They inspect HEAD non-merge history, at most 1,000 commits, at most 200 selected commits, and bounded optional patches. Secret filtering is best effort. Review evidence before sharing it with a model. See [SECURITY.md](SECURITY.md).

## Verification and contribution

```sh
npm test                 # unit, API, workflow; real PostgreSQL when available
npm run build            # static and serverless entry validation
npx playwright install chromium
npm run test:ui          # browser workflows at desktop and mobile widths
npm audit
```

The PostgreSQL test starts an isolated temporary cluster if local PostgreSQL tools are available. CI supplies a separate test database. Never point `ROLE_TRAIL_TEST_DATABASE_URL` at a real workspace. [Release evidence](docs/release-check.md).

This is an early release with no uptime or job-board access guarantee. Optional accounts, a user's Vercel deployment and a future scheduled trigger require installation-specific verification. Check those in your own installation before relying on unattended runs.

## 繁中

你先設定想找的工作、地點、語言與其他條件，再提供履歷、作品集或允許讀取的 repo。Claude Code／Codex 會引導你建立自己的 Vercel、資料庫和 LLM 排程。之後排程讀取最新喜好，搜尋與查證職缺，替你標成 Shortlisted 的工作準備履歷和面試資料，存回工作台讓你審閱。

公開版提供這套流程的 skill、指令和介面。實際搜尋與文字判斷由你的 agent 完成；純抓資料的 runner 只是輔助。Onboarding 會分別確認部署、API、排程登記與手動試跑。跨日排程是否真的觸發，要等實際執行後才算驗證。職缺是否符合資格、是否想投與是否已投遞始終分開，系統不代替你投遞。

## Moving an existing tracker

A new installation uses the workflow above. Moving an existing tracker also requires preserving its records and files. Role Trail includes a one-time converter for the legacy job-board PostgreSQL schema, preserving original PDFs, full research bundles and record relationships. Other tracker formats still need an explicit converter. Don't pass an unrelated backup to `restore`. Follow the [migration checklist](docs/migration.md) before changing your source of truth.

## Attribution

The paste-JD review entry and human application decision were inspired by
[career-ops](https://github.com/career-ops-hq/career-ops) by Santiago Fernández de Valderrama.
This implementation is original; no career-ops code is copied. Credits do not imply endorsement.
The interview preparation method adapts [How to Get an Offer](https://github.com/AIPMAndy/how-to-get-offer) by AIPMAndy / AI 酋长 Andy under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), adding cited experience, separate eligibility and decisions, and versioned records. No upstream application code is included.

[Himalayas](https://himalayas.app) supplies attributed listings when configured. Preserve its source and application links. Dependency licenses are retained by npm. Project source: [MIT](LICENSE).

## Search outcomes and application packages

Research shows a rolling seven-calendar-day window in your configured time zone. Expand each count to see the roles behind it: unique newly discovered high-fit roles, those currently meeting all checks, those you currently shortlisted/applied to, and unknown or stale checks resolved positively or negatively. These are not application conversion rates or newly posted-job counts. Repeated observations and historical imports do not count as new opportunities. Legacy runs without snapshots are explicitly incomplete; revisits do not become new discoveries.

Each role has an application-package overview with resume adjustments, interview preparation, tasks and the original application link. It separates missing materials, resume approval, eligibility and user-reported submission. Stale content requires regeneration. Original PDFs can be saved per resume version and opened through an authenticated link. Saving a file does not approve it or submit an application. Inspect the PDF before applying manually.

The calculation rules live in `web/outcomes.mjs`; integrations can use that data-only module without adopting another workspace's profile or private records.

Verification badges use a shared component and stylesheet (`web/verification.mjs` and `web/verification.css`). Common checks—remote work, AI product work, frontend/backend/full-stack/design responsibility, language, working hours, compensation, employment and ownership—have semantic icons. Other checks show a generic icon **with the user's label**, not an unexplained checkmark. Only supported, positive, current facts get badges (7 days for openings; 30 for other checks). Click or tap a badge, or focus it and press Enter, to read the evidence. An icon never means the whole job meets every requirement.

## One application, separate installations

The public repository owns the UI, domain rules, API, PostgreSQL/local storage, collectors and agent CLI. A private installation can depend on a reviewed Git commit and use a small deployment wrapper; it does not copy or patch application source. `buildDeployment` copies only the canonical static asset allowlist. Preferences, credentials, data and the host scheduler belong to each installation. See [single-runtime setup](docs/single-runtime.md).

PDF bytes and full research bundles live in content-addressed artifact storage, outside the page-state JSON. `resume-pdf` renders and saves a version; `pdf-save` attaches an externally rendered PDF without changing its review status. `backup` exports the state and referenced artifacts. Job-Frog expands bounded company groups; Taiwan Indeed uses the optional JobSpy bridge; 104's optional capped Apify trial yields summaries, not verified complete JDs. No provider or paid quota is enabled just by installing the app.

The existing private installation now uses this runtime without copied application code. Acceptance covered 67 Node tests, eight browser flows, exact deployment-asset parity, original PDF downloads, retained artifact hashes, database write guards, origin checks and revision conflicts. These are bounded checks of this release; the next scheduled LLM invocation and each provider’s ongoing availability still need operational observation.
