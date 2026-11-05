# Existing-installation migration

Role Trail can start a new private workspace. It is not yet a lossless replacement for an existing tracker with a different schema or artifact store. Keep that installation authoritative until the following gates pass. Do not feed an unrelated export to `restore`: restore replaces a Role Trail workspace; it is not a migration adapter.

## Preserve before transforming

Inventory the current schema and all relationships. Back up the authoritative database and original artifacts, including every resume PDF version, review/decision records, submission reports, preparation documents, evidence snapshots, task completion and research bundles. A metadata-only JSON export is insufficient when files or history live elsewhere. Test that the backup restores into isolated storage.

Do not put real backup data, credentials or migration fixtures in this public repository. Use synthetic fixtures for tests and a private directory outside Git for the real inventory and migration manifest.

## Build and test an explicit adapter

- Map source job IDs to Role Trail IDs; report URL collisions and every orphan reference. Never discard a duplicate record silently.
- Preserve closed, excluded, language exclusions, manual archive, decisions and completed tasks independently. An approved resume is not an application.
- Preserve original PDF bytes and per-version hashes. Regenerating a PDF does not preserve the original artifact.
- Preserve preparation packs, their source evidence and JD/resume bindings. Todo text alone cannot replace a preparation pack.
- Preserve complete research payloads and provenance. Run metadata and a content hash cannot reconstruct old research bundles.
- Enforce the original required criteria and freshness rules. Role Trail's supplied-check array is not a complete policy engine.
- Measure the complete target representation as compact UTF-8, including artifact encoding costs. Cloud currently caps a single workspace at 3.5 MB. Do not delete history to fit; separate artifact/ledger storage and pagination are required before migrating larger data.

The current release does not provide this adapter or original-PDF/preparation-pack storage. These gates describe required migration work, not shipped capabilities.

## Verify operations before switching

Test the adapter against an isolated, protected staging database. Compare counts, ID maps, orphan reports, hashes and all version histories. Exercise restore and rollback. Do not dual-write personal records during comparison.

Match source coverage and actual retrieval depth. Built-in collectors cover Himalayas, configured Greenhouse and Lever boards and optional SerpApi Google Jobs. Host research/import can add other sources; selecting them in a profile does not implement an automatic collector.

Verify authentication on every route and deployment, including exports and printable resumes. Preserve existing deployment protection. Verify a real timed trigger, timezone and failure handling; only one scheduler should write the authoritative workspace after cutover. Keep the old installation available for rollback until acceptance is complete.
