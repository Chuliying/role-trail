# Concurrent editor save

## Root cause

The workspace action mutation uses the latest local cache revision, but the profile/capability editor holds a full opening record and does not re-read external changes. A stale cache causes a server 409; a newer cache alone could permit overwriting fields using the old full record. A generic refresh recommendation is therefore insufficient.

## Scope and contract

Keep the server CAS unchanged. Capture an immutable editable record at opening. Read an unconditional latest workspace through React Query before saving, recursively compare objects and atomically compare arrays, and bind the payload to the compared revision. Conflicts keep the original draft and require explicit per-field choices. After choices, the latest compared record becomes the base; the next save re-reads again. A racing 409 performs a fresh comparison without another automatic POST.

Capability IDs stay fixed, including a generated-once ID for new records. Deletion is a root conflict when there are local changes. Confirmation concurrent with changed capability content requires whole-record review. Unavailable latest reads and failed writes keep the draft. No private state is used in tests.

## Evidence

- RED: all four initial browser cases failed on the previous runtime: disjoint merge, same-field comparison, racing CAS recovery and failed latest read.
- GREEN: 11 focused browser cases passed, including capability identity/deletion/confirmation, second updates after selection, nested objects/array conflicts and narrow Traditional Chinese comparison UI.
- Full verification: 85 Node tests and 80 browser cases passed, plus strict typecheck, production build, formatting and dependency audit (zero vulnerabilities).
- Mobile Traditional Chinese comparison was visually inspected with synthetic data at 390px; values wrap inside the editor. Authentication errors do not unmount the editor.
- Secret preflight: mandatory checks passed; bundled-log candidates were reviewed without finding credentials.
- Public CI and private deployment are subsequent delivery checks, recorded in the GitHub run and private wrapper respectively.

## Skill execution

- Execution mode: bug-fix. User report and observed RED supply the contract; no PRD/spec required.
- Manifest and tokens read. Existing React Query, editor guard and native controls retained.
- RED → GREEN → full regression completed; self-review checked fresh-read revision binding, no automatic POST retry, stable capability identity, deletion and confirmation races, and draft retention on errors.
- Runtime behavior is documented in README.md and docs/browser-runtime.md. The server CAS and private data are unchanged.
