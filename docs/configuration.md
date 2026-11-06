# Application configuration

Shared settings are versioned JSON, validated before build and consumed by the server and agent workflow. Build generates `web/configuration.mjs` for the browser. Edit the source files, then run `npm run build`; do not edit the generated module.

| File | Owns |
| --- | --- |
| `config/sources.json` | Twelve discovery source IDs, display labels, homepages, host-agent routes and eight built-in feed definitions/options |
| `config/ui.json` | Brand/title, navigation, tool menu, decision labels, score filters, page size and default sort direction |
| `config/verification.json` | Verification icons, aliases, fallback icon and freshness windows |
| `config/locales/zh-TW.json` | Existing interface literal translations; source JDs/evidence stay verbatim |
| `src/tokens.css` | Semantic colors, spacing, motion, shared width and typography tokens |

Each installation's private profile still chooses its sources, feeds, roles, language and eligibility rules. The catalog neither selects all sources nor changes a saved profile. Keys stay in runtime environment variables; never add credentials or personal preferences to these public files. Catalog text is trusted build-time source, not user-editable API input. Validation checks shape, IDs, allowed adapters and bounds; it is not a general secret detector.

Adding a source with an empty `feedTypes` list documents a host-assisted research route. It does not create a scraper. New executable adapters require code, request/host limits and tests. Unknown user source IDs remain valid manual coverage targets. Request security, authentication, revision checks, transition rules and archive evidence protections remain executable policy. Status IDs remain stable; configuration can change their labels/order, not invent a new state machine.

Run `npm run build`, `npm test`, `npm run test:ui` and `npm run format:check` after configuration changes. `tests/configuration.test.mjs` checks malformed settings, adapter boundaries, custom source preservation and generated browser parity. Private deployments consume the same generated files through the asset allowlist.

The logo uses the Latin subset of **M PLUS U** by Coji Morishita, locally served with its [SIL Open Font License](../web/fonts/MPLUS-U-OFL.txt). Source: [Google Fonts metadata](https://github.com/google/fonts/blob/main/ofl/mplusu/METADATA.pb). Body fonts remain Manrope and Noto Sans TC. Font family, width and spacing changes belong in the shared tokens; layout rules consume those tokens.
