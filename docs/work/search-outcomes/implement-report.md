# Search outcomes and application-package review

The work adds a seven-calendar-day outcome view and a per-role application-package overview. Fit, qualification, personal decisions, resume review and submission remain separate. There is no automatic application or decision change.

Outcome counts use canonical job identities, explicit discovery provenance for partial history and dated supporting facts. Repeated observations and imports do not become new opportunities. Each metric expands into its supporting roles. Current shortlist counts are not conversion rates. Legacy history without observations is marked incomplete.

Application overview links to resume adjustments, interview preparation, tasks and the application source. Missing or stale content is listed. The public PDF route offers print/save export but does not track the saved file; that requirement remains unverified. This limitation is intentional rather than inferring a PDF from HTML.

## Verification

- RED: outcome functions absent; new assertions failed. GREEN: shared outcome/readiness tests pass.
- `npm test`: 42 tests pass, none skipped, including isolated PostgreSQL tests.
- `npm run build`: passes.
- `npm run test:ui`: 6 tests pass, including 390px layout, package navigation, historical state and outcomes.
- `npm audit`: zero known vulnerabilities.
- Independent review reproduced a duplicate URL import crash and partial-history discovery inflation. Both received regression tests and an independent recheck (10 targeted tests passed). Public PDF existence is no longer inferred from a renderable resume.
- The consuming private installation separately passed 85 Node tests, isolated database integration, and synthetic browser checks at 390px and 1440px. Its data remains outside this repository.

Deployment and final source synchronization are recorded after release verification.
