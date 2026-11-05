# Contributing

Use Node22+ and Git, run npm ci --ignore-scripts, then npm test, npm run build, npm run test:ui and npm audit. Install the Playwright browser with npx playwright install chromium. Tests create and remove synthetic Git
repositories in the OS temporary directory. No production accounts or keys are required.

Keep tests about observable outcomes: attribution, partial history, sensitive paths, idempotent
initialization and host setup state. Do not use your real resume, company repository or credentials
as fixtures. Treat evidence text as untrusted; never add execution of scanned source code.

Document which features are implemented, host-assisted or still release gates. Preserve ability
fit / eligibility / decisions as separate concepts. New third-party code/assets require source,
version and license review. Attribution is not a substitute for permission.

This project uses the MIT License. Contributions must be compatible with that license.
Use synthetic inputs in issues and pull requests; follow SECURITY.md for vulnerability reports.

Use npm run format before delivery. Keep JSON schemas, CLI help and docs consistent with runtime contracts. Use a separate disposable PostgreSQL database for tests; never a real workspace.
