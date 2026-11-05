# Role Trail

Your private job-search workbench, operated with Claude Code or Codex.
Use your own field, portfolio, location and working languages. Keep **ability fit**, **verified eligibility**, and **your application decision** separate.

This repo now includes the runnable dashboard, local storage, PostgreSQL adapter, API, collectors, resume workflow and daily runner. Your agent configures them; it does not need to rebuild the core. Role Trail is self-hosted, single-owner software, not a hosted recruiting service.

## Try the complete local demo

Requires Node.js 22+ and Git. All demo people, companies, roles and evidence are synthetic.

```sh
git clone https://github.com/Chuliying/role-trail.git
cd role-trail
npm ci --ignore-scripts
node bin/role-trail.mjs demo --workspace "$HOME/.local/share/role-trail-demo"
node bin/role-trail.mjs serve --workspace "$HOME/.local/share/role-trail-demo"
```

Open **http://127.0.0.1:4318**. Open a JD, shortlist it, add and check a preparation task, generate a resume, read its adjustments and approve it. Refresh: your work is retained. Use a separate workspace for real data.

## Set up your own workspace with one prompt

Open this checkout in your coding agent and paste:

> Read BOOTSTRAP.md and set up my own Role Trail workspace using the shipped CLI, dashboard and API. Ask only for missing job preferences, resume/portfolio links, authorized repositories and exact Git authors. Review my contribution evidence with me; don't infer skill from repository dependencies or commit counts. Configure my sources, import and assess a bounded real search, and generate resumes with adjustment notes for the jobs I shortlist. Set up my chosen local or private Vercel/PostgreSQL deployment and supported schedule using my own accounts. Verify the actual workflow, preserve decisions, and give me the URL and setup report. Never apply to jobs automatically, invent credentials, or publish my private data.

[BOOTSTRAP.md](BOOTSTRAP.md) is the execution contract. Your existing host model does the qualitative analysis; no separate model API key is needed for this path. Search providers and cloud hosting can require your own accounts. Never paste secrets in chat.

## What ships

| Capability | Implementation | Boundary |
| --- | --- | --- |
| Goals and contribution evidence | Interactive profile setup; exact-author Git scanning with SHA/file citations and optional bounded patches; proposed/confirmed/rejected claims | Your agent interprets evidence; you confirm attribution. Authorship does not prove proficiency. |
| Job discovery | Himalayas, configured Greenhouse and Lever boards, optional SerpApi Google Jobs; research JSON import for other sources | Bounded source runs, not exhaustive web search. Blocked platforms are not marked complete. |
| Fit and gaps | Persistent 1–10 assessment, evidence and explanation; gaps shown for 7+; agent assessment packet | Human/agent judgment, not an offer probability. The CLI does not invent scores. |
| Decisions and preparation | To Review / Shortlisted / Applied / Passed; manual archive/restore; persistent todo checkboxes | Research never changes personal decisions. Confirmed closures and exclusions stay archived until newer positive evidence. |
| Resume workflow | Draft one job or all shortlisted jobs from confirmed claims; editable versions, adjustment notes, review/approval, stale detection, printable HTML and local PDF | Automatic drafts rank claim tags against JD words. Your agent can rewrite them using confirmed facts. Review is required; no invented work history. |
| Shared storage and updates | Atomic local JSON; PostgreSQL transactions and revision checks; authenticated API; backup/restore; daily timezone-aware runner | Local runner needs an awake process; cloud/host scheduling must be activated in your account. |
| Responsive workbench | Tailwind build with semantic design tokens; structured JD dialog, source links, filters, score explanation, research coverage, profile and feed configuration | Default order: newest search, then highest fit. Long URLs wrap on mobile. |

Original JD text, source, completeness and posting kind are retained. First publication, update and repost are distinct. Eligibility facts need a source, evidence and actual checked date. Unknown remains unknown.

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

# All shortlisted roles; creates pending-review versions
node bin/role-trail.mjs draft --workspace "$HOME/.local/share/role-trail"

# Local PDF renderer (one-time browser installation)
npx playwright install chromium
node bin/role-trail.mjs resume-pdf --workspace "$HOME/.local/share/role-trail" \
  --job JOB_ID --output "$HOME/.local/share/role-trail/resume.pdf"

node bin/role-trail.mjs help
```

For agents, `init --profile /private/profile.json` replaces the interactive interview. Use `action --file`, `import --file`, `evaluate --job`, `export --output` and `restore --file --revision` to operate the same store. Cloud data commands accept `--remote` with runtime environment credentials. [Data contract](docs/data-contract.md).

## Deploy and schedule

- [Vercel frontend + API + your PostgreSQL](docs/vercel.md): actual entry point, migration, environment configuration, authentication, deployment and verification steps.
- [Source configuration](docs/sources.md): query settings, limits, free public routes and optional credentials.
- [Daily scheduling](docs/scheduling.md): working daemon, existing host automation, or optional GitHub Actions calling your private cloud API.
- [Agent evidence and resume workflow](docs/agent-workflow.md): contribution confirmation, LinkedIn fallback and tailoring instructions.
- [Verified scope](docs/setup-parity.md): tested behavior versus deployment/account-specific acceptance.

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

This is an early release with no uptime or job-board access guarantee. Optional accounts, a user's Vercel deployment and a future scheduled trigger require installation-specific verification. Those are environment checks, not unimplemented dashboard features.

## 繁中

現在已內建可執行的工作台、職缺匯入與搜尋、三種獨立狀態、準備待辦、履歷版本與審閱、本機／PostgreSQL 儲存，以及每日 runner。其他人只需用自己的條件、repo、履歷與帳號設定，不用重做核心功能。

能力判斷與履歷文字潤飾由使用者既有的 Claude Code／Codex 協作，個人貢獻仍需本人確認。排程程式已提供，但必須真的啟動 runner 或建立 host task；文件與設定檔本身不代表已啟用。資料來源成功與否會保留真實範圍，不把受阻或零筆裝成完成。

## Attribution

The paste-JD review entry and human application decision were inspired by
[career-ops](https://github.com/career-ops-hq/career-ops) by Santiago Fernández de Valderrama.
This implementation is original; no career-ops code is copied. Credits do not imply endorsement.
[Himalayas](https://himalayas.app) supplies attributed listings when configured. Preserve its source and application links. Dependency licenses are retained by npm. Project source: [MIT](LICENSE).
