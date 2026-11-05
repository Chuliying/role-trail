# WWR collector verification

Mode: personal-feature. Uses existing Node 22 collector, profile validation and node:test conventions. No UI layout, schema migration, new dependency or auth change.

- RED: two WWR tests failed with unsupported feed configuration and zero collected rows. Source-routing regression also failed because changing feeds marked an existing assessment stale.
- GREEN: 3 WWR tests pass. Fixtures cover three category URLs, cross-category deduplication, structured Markdown excerpts, attribution, unknown eligibility/publication semantics, 100-item cap, unavailable category, malformed RSS, DTD rejection and partial category failures.
- Source-only profile updates rebind prior matching profile hashes, preserving stale flags, dates, content, approvals and personal decisions. Location and other substantive changes still invalidate; prior mismatched resume bindings remain stale.
- Full checks (Node 22): `npm test` 74/74; `npm run build` exit 0; `npm run test:ui` 16/16; `npm audit` zero vulnerabilities. No private records used in tests.
- Secret preflight: shared security scan of `src`, exit 0; no hard-coded secrets, sensitive client env or secret logs found. Auth review N/A; no authorization changes. `git diff --check` clean.
- Live unauthenticated Node fetch: three category requests succeeded. First 10 frontend, first 100 full-stack and 26 product items; 132 unique listing URLs. This is bounded ingestion, not screening 132 suitable roles, official JD verification or a new recommendation count. A mortgage role in the frontend category demonstrates why manual relevance verification remains necessary. Raw responses and collector output are outside Git.

## Installation activation

After pushing the runtime, update the private wrapper's exact commit pin, install/build/test, and use its guarded deploy command. Read fresh shared state and append `we-work-remotely` to platforms plus the three categories to feeds using compare-and-swap. Preserve all other profile fields and personal records. Update the existing host automation in place, with one WWR coverage entry retaining per-category and deduplicated counts. Do not add another scheduler. Record actual activation and deployment evidence in the private wrapper, not personal exports in this public repository.

Step 1 environment: PASS, existing package scripts and public agent contract used.
Step 2 RED/GREEN: PASS, failures observed before implementation.
Step 3 verification: PASS, checks above. Type-check N/A (JavaScript); UI layout N/A; no dependency added.
