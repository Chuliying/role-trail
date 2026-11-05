# Role Trail

Turn your own project evidence into a job-search brief. Choose your field, portfolio,
location and sources; keep capability fit, eligibility checks and personal decisions separate.

**Open-source preview, not a hosted service.** This directory runs independently
of the maintainer's private repository. It currently supplies onboarding and Git evidence
commands plus a host-agent workflow. The private cloud dashboard, PDF pipeline and automatic
schedule installation are not bundled yet. See [the parity checklist](docs/setup-parity.md).

## Start with one prompt

Clone the repository, open it in Claude Code or Codex, then paste the prompt below:

```sh
git clone https://github.com/Chuliying/role-trail.git
cd role-trail
```

> Read BOOTSTRAP.md and execute it to build my own Role Trail workspace. Use the code in this
> repo, ask only for missing preferences and authorized sources, and implement missing local
> components when needed. My target field and portfolio are my own; do not use the maintainer's
> settings. Inspect my selected repositories and commits as evidence, confirm my contribution,
> prepare resumes for review, and configure my chosen search schedule when supported and
> authorized. Verify the actual workflow and give me the working URL, setup report and any
> remaining blockers. Do not stop at a plan or generated setup instructions.

[BOOTSTRAP.md](BOOTSTRAP.md) is the complete execution and acceptance contract. You do not
need an installation wizard or a separate model API key just to use your existing coding agent.
The agent uses its available tools and your accounts. Optional search providers and cloud hosting
may still require your credentials. Do not paste keys into the chat.

This is an **agent-built setup path**: some components must currently be implemented by your
agent. It is not a tested one-command installer or a claim of full feature parity. The actual
outputs, persistence, source retrieval and scheduler activation must pass the prompt's checks.

## Manual commands (optional)

Requirements: Node.js 22+ and Git. No npm dependencies, API keys or account required for these
local commands. Clone this repository, then
run the following from this directory. There is no published npm package to install yet.

```sh
node --version
git --version
npm test
node bin/role-trail.mjs setup --workspace "$HOME/.local/share/role-trail"
```

1. **Answer the setup questions.** Name, target roles, location, remote rules, timezone,
   languages, ownership policy, search platforms, portfolio and optional resume source.
   No AI/frontend/Taiwan preference is imposed on other users.
2. **Select your repository and author email(s).** The command never scans the entire disk:

```sh
node bin/role-trail.mjs scan \
  --workspace "$HOME/.local/share/role-trail" \
  --repo /absolute/path/to/your/project \
  --author you@example.org \
  --since 2025-01-01 --max-commits 50
```

   Repeat `--author` for your aliases. Repeat the command for each authorized repository.
   Default output includes commit SHA, subject and selected code paths, but no patches.
   Add `--include-patches` only when you may share those code fragments with your agent.
   Metadata alone is not enough to confirm implementation skill.
3. **Prepare your agent brief.** Choose `codex` or `claude`:

```sh
node bin/role-trail.mjs brief \
  --workspace "$HOME/.local/share/role-trail" --host codex
```

4. **Open this package in Claude Code or Codex and paste:**

> Follow AGENTS.md and docs/agent-workflow.md. My private workspace is
> ~/.local/share/role-trail. Read agent-brief.md. Help me review my selected Git evidence,
> confirm what I personally built and what work I want. Then draft my master resume from
> confirmed facts and my authorized portfolio/resume sources. Show unsupported claims and
> questions before using them. Keep job fit, eligibility and my application decision separate.

5. **Review before scheduling.** Ask the agent to configure your preferred time, timezone,
   sources and available host scheduler using the contract below. A brief does not create
   a schedule. Require a real task ID, next run and one completed trial before accepting setup.

> Prepare my daily job search from the confirmed profile. Show which scheduler is actually
> available in this host and its machine/network requirements. Configure one task using my
> chosen time and sources, then run a bounded trial. Save the task ID and trial report in my
> private workspace. Do not mark setup complete if activation or execution is unverified.

For noninteractive agents, create a profile JSON outside the repository, then use:

```sh
node bin/role-trail.mjs init --workspace /absolute/private/workspace \
  --profile /absolute/private/profile.json
```

[examples/profile.json](examples/profile.json) is fictional and uses a different field and
location to demonstrate portability. `init` preserves an existing profile. `brief` refuses
to overwrite a previous brief; review/remove that generated file explicitly before rebuilding.

## What the commit command can establish

| Observation | What it does not establish |
| --- | --- |
| Exact Git author identity, SHA and date | Identity authenticity, sole authorship or skill level |
| Selected changed source paths | Ownership of the whole repository or its whole technology stack |
| Optional bounded textual diffs | Production usage, design rationale, business impact or test success |
| Co-authored-by marker | Whether unmarked commits were actually solo work |

Only HEAD history is read. Merge commits are excluded. At most the latest 1,000 non-merge
commits are examined; at most 200 matching commits can be exported per run. Shallow/truncated
history is disclosed. No fetch, hooks, package installation or repository execution occurs.
Each commit exports at most 30 code paths; optional patches cover at most 3 files and 6,000
characters per file. These are bounded review samples, not a complete audit.

Read [the evidence and resume contract](docs/agent-workflow.md) for confirmation, LinkedIn
fallbacks, JD tailoring and the required adjustment explanation.

## Privacy and safety

Evidence stays in an explicit directory outside Git, created with restricted filesystem
permissions (subject to operating-system semantics). No cloud credentials are bundled.
Known sensitive paths and common token patterns are filtered, but redaction can miss secrets
or proprietary information. Inspect the output before asking a model to analyze it.
The CLI makes no network/model calls. Your coding agent may send selected text to its configured
model provider. Do not scan employer repositories without permission.

[SECURITY.md](SECURITY.md) covers remaining boundaries. [CONTRIBUTING.md](CONTRIBUTING.md)
explains synthetic tests and release checks. Sharing this folder is not permission to share
any private repository, history or workspaces. Source code is available under the [MIT License](LICENSE).

## 繁中快速使用

執行 `setup` 回答自己的領域、地點、語言與作品集。用 `scan --repo ... --author ...`
產出自己指定作者的 commit 證據；可選 `--include-patches` 提供有限差異片段。
再執行 `brief`，讓 Claude Code／Codex 依上述指令核對貢獻、補問問題、製作履歷草稿。
commit 數量不等於能力，履歷完成不代表已投遞，產生排程指令不代表排程已啟用。

## Attribution

The paste-JD review entry and human application decision were inspired by
[career-ops](https://github.com/career-ops-hq/career-ops) by Santiago Fernández de Valderrama.
This repository's onboarding/scanner implementation is original; it does not copy career-ops
code. Credits do not imply endorsement. A release must retain licenses for any later copied
code, fonts or assets.
