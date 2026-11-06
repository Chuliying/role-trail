# Role Trail manifest

## Stack

- framework: vanilla
- package_manager: npm
- source_roots: config,src,bin,web,api,scripts,tests,docs,examples,.github,skills,prompts
- source_extensions: mjs,js,json,md,yml,html,css
- has_ui: true
- typed_contracts: false
- test_cmd: npm test
- dependency_audit_cmd: npm audit

## Git Workflow

- base_branch: main
- remote: origin
- branch_prefix: codex/
