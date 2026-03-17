## Why

Callers must always provide explicit `width` and `height` when calling `render()`, even when the content itself determines the natural dimensions. This forces arbitrary defaults that often clip content or add unwanted whitespace — especially for dynamically-sized HTML snippets or components whose layout is driven entirely by content.

## What Changes

- Add an optional `autoSize` flag to `RenderOptions` that, when enabled, queries the page's scroll dimensions after load and resizes the viewport to fit the content before capturing
- Expose `--auto-size` flag on the CLI `convert` command
- When `autoSize` is true and a `profile` is selected, the profile dimensions are used as a maximum cap (content shrinks to fit, but won't exceed profile dimensions)
- `width` and `height` in `viewport` become optional when `autoSize` is true (default to a large initial viewport used for layout measurement)

## Capabilities

### New Capabilities

- `auto-size-viewport`: Auto-detect content dimensions from the rendered page and resize viewport before capture

### Modified Capabilities

- `render-pipeline`: New optional `autoSize` field on `RenderOptions`; viewport resize step inserted after page load when enabled
- `cli-convert-command`: New `--auto-size` flag added to `convert` command

## Impact

- `packages/types`: `RenderOptionsSchema` — add `autoSize?: boolean`; `ViewportOptionsSchema` — `width` and `height` become optional (default to `1280`/`720` when not specified)
- `packages/core/src/index.ts` — after `loadPage()`, if `autoSize` is set, evaluate scroll dimensions and call `page.setViewportSize()`
- `apps/cli/src/index.ts` — add `--auto-size` flag; pass `autoSize: true` to render options when set
- No new dependencies required
