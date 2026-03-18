## Why

Users often embed the exportable content (a chart, card, or canvas element) inside a larger HTML page with navigation, chrome, or debug scaffolding. Today they must carefully craft a minimal HTML file to get a clean capture; `--selector` lets them point directly at the element they want, eliminating that boilerplate and making pixdom composable with real app pages.

## What Changes

- **New CLI flag** `--selector <css>`: optional CSS selector string targeting a single DOM element
- When `--selector` is present, the render pipeline clips to that element's bounding box using `element.screenshot()` instead of full-page `page.screenshot()`
- `--width` and `--height` are silently ignored (with a stderr warning) when `--selector` is given — element dimensions take precedence
- `--auto-size` is also skipped when `--selector` is active — element bounding box replaces auto-size detection
- If the selector matches zero elements, `render()` returns a new error code `SELECTOR_NOT_FOUND`
- If the selector matches multiple elements, the first match is used and a warning is written to stderr
- Does NOT apply to `--image` input (no DOM)
- Animated pipeline: bounding box computed once before the frame loop; `element.screenshot()` called per-frame

## Capabilities

### New Capabilities

- `selector-capture`: `--selector` flag behaviour, bounding-box clipping, `SELECTOR_NOT_FOUND` error code, and interaction rules with `--width`/`--height`/`--auto-size`

### Modified Capabilities

- `render-pipeline`: `RenderOptions` gains an optional `selector` field; `render()` must resolve the element and pass it to both static and animated renderers; new `SELECTOR_NOT_FOUND` error code added
- `static-renderer`: when `selector` is set, use `element.screenshot()` instead of `page.screenshot()`
- `animated-renderer`: when `selector` is set, compute bounding box once before the frame loop and use `element.screenshot()` per-frame
- `cli-convert-command`: `--selector` flag added; mutual-exclusion warning with `--width`/`--height`; skip `--auto-size` when selector active

## Impact

- **`packages/types`**: `RenderOptionsSchema` gains `selector?: string`; error code union gains `'SELECTOR_NOT_FOUND'`
- **`packages/core`**: element resolution and selector error handling in `render()`; updated static and animated renderer call sites
- **`apps/cli`**: new `--selector` flag, stderr warning when combined with `--width`/`--height`
- No breaking changes — `selector` is optional; all existing behaviour unchanged when omitted
