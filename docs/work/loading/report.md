# Scoped loading feedback

Initial workspace and archived-research reads use content-shaped skeletons. Shapes appear after 180 ms, breathe over 1.6 seconds and use existing neutral tokens. Reduced-motion uses static placeholders. Research content fades in over 150 ms. Modal controls stay available; closing still aborts the fetch.

Manual refresh preserves visible content. It reads the deployed entry document without cache and reloads only when the app version differs. Otherwise it refreshes shared state in place. A failed refresh keeps the previous content and shows the error. The refresh icon rotates only while that request is running.

Async buttons and forms use a shared delayed, centered indicator, without adding width. Controls reject duplicate submissions and recover after errors. A boolean successful action can display a brief check if the original control remains mounted; re-rendered controls show the saved state. Queued resume work remains a static disabled status, not a perpetual loading animation. This UI does not start an LLM or fabricate progress.

References: [Atlassian skeleton usage](https://atlassian.design/components/skeleton/usage) and [Carbon loading patterns](https://www.carbondesignsystem.com/building-blocks/core/patterns/loading). Durations are local design choices, not claims from these references.

Verification: observed failing loading tests before implementation; final 75 Node tests, 20 browser tests, build and dependency audit passed. Chromium/WebKit mobile tests cover delayed reads, reduced motion, overflow, constant refresh width, old content during refresh, error recovery, changed-version navigation, research placeholders and queued-state semantics. Synthetic screenshots were visually inspected. No schema or stored-data changes.
