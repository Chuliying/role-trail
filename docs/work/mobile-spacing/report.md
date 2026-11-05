# Touch behavior, spacing and long text

User request: remove the duplicate shown/total count, use a trash icon for Archive, remove the broken-looking title hover, separate buttons from content, and wrap long research text.

Root causes reproduced in a synthetic touch browser: unqualified `:hover` rules remained active after tapping; task acceptance/dependency `<small>` elements stayed inline; the preparation button had zero gap after the last task; only coverage paragraphs wrapped long tokens, leaving the run summary and task flex contents able to expand the page.

Changes stay in the canonical UI. The jobs heading no longer repeats counts; decision-tab counts remain. The trash icon retains the accessible Archive label and navigates to the existing archive without deleting records. Hover styles apply only to fine pointers with hover capability; title hover uses an underline rather than a filled bar, and keyboard focus remains visible. Task notes form separate blocks, preparation buttons have 20px spacing, research bundle links have 24px before source coverage, and long text wraps without clipping. The private installation only updates its dependency pin.

RED observed: header count present, missing SVG, filled title hover, inline task note, 0px button gap and horizontal overflow. GREEN: touch browser checks those behaviors, research wrapping at 320px and 390px, and source-bundle spacing. Screenshots use synthetic data only.

Validation: 68 Node tests, 10 browser flows, formatting, build and dependency audit passed. Reviewed synthetic touch screenshots for the list, preparation and complete research card; long notes remain fully readable. No data schema or personal state changed.

## Hover palette follow-up

Replaced blue hover fills with the palette's warm neutral `surface-muted` (#E9E4DA). Primary actions and title links use `action-hover` (#24324A); title backgrounds stay transparent. Shared verification controls use the same neutral token. Touch hover gating and keyboard focus remain intact.

Validation: build, 68 Node tests, 10 browser tests, format check and npm audit passed. A synthetic desktop browser check confirmed the computed hover fill and a screenshot was visually inspected. No data or API changes.
