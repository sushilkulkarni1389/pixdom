## Context

Currently `render()` requires explicit `viewport.width` and `viewport.height`. These are applied via `page.setViewportSize()` before page load, which means content is rendered inside a fixed box — anything that overflows is clipped, and small content gets surrounded by empty space. For HTML snippets and components, callers have no way to know the natural size before rendering.

Playwright exposes `document.documentElement.scrollWidth` / `scrollHeight` after page load. We can query these values and resize the viewport to match before taking the screenshot.

## Goals / Non-Goals

**Goals:**
- Add `autoSize?: boolean` to `RenderOptions` — when true, query content dimensions after page load and resize viewport before capture
- Make `viewport.width` and `viewport.height` optional in `RenderOptions` (defaults preserved at 1280×720)
- Add `--auto-size` flag to the CLI `convert` command
- Keep the change fully backward compatible — all existing callers work unchanged

**Non-Goals:**
- Scrollable pages / infinite scroll — we only read `scrollWidth`/`scrollHeight` which reflects the full document layout
- Responsive breakpoint analysis or multi-size capture
- Exposing a separate `detectContentSize()` API (internal implementation detail only)

## Decisions

### Where to put the resize step

**Decision**: After `loadPage()` and before any renderer call in `packages/core/src/index.ts`.

The resize must happen after load so that dynamic content (web fonts, images, JS-driven layout) has settled. Doing it in `static-renderer.ts` would duplicate logic for animated renders. Putting it in `index.ts`'s `render()` function keeps the logic in one place.

### Initial viewport for auto-size measurement

**Decision**: Use a wide initial viewport (e.g., 1280×720) before querying scroll dimensions, then resize. The initial viewport affects layout (especially width), so we set it once to the caller-supplied (or default) `width` first — this ensures the content lays out at the right width before we measure the height. Only height is auto-sized unless both dimensions are unset.

Alternative considered: always start at a very large viewport (e.g., 16384×16384). Rejected because this can cause layout reflow on responsive pages and is unexpected.

**Refined decision**: When `autoSize` is true:
1. Set viewport to `(width || 1280) × (height || 720)` as normal (for layout pass)
2. After page load, query `scrollWidth` and `scrollHeight`
3. Resize viewport to `(autoSizeWidth, autoSizeHeight)` — where `autoSizeWidth = scrollWidth` if `width` was not explicitly set, and `autoSizeHeight = scrollHeight` always

This means `--auto-size` primarily auto-detects height. Width is only auto-detected when no explicit `--width` is given.

### API change to `ViewportOptionsSchema`

**Decision**: Make `width` and `height` optional with defaults in the Zod schema (`z.number().default(1280)` and `z.number().default(720)`).

This preserves full backward compatibility — existing callers that pass explicit values are unaffected. Callers that omit them when `autoSize: true` get sensible defaults for the initial layout pass.

## Risks / Trade-offs

- **Layout-dependent content** → Mitigation: We always do a first layout pass at the specified (or default) width before measuring, so fixed-width layouts read correct scroll dimensions.
- **Scrollable containers** → Accepted trade-off: `scrollHeight` of the root element may include content inside overflow-hidden containers. For pathological pages this may produce unexpected crop. Not fixable without JS introspection.
- **Race condition: content still loading when measured** → Mitigation: `loadPage()` already waits for `load` event; measurement happens after that. JS-heavy pages should use `--url` with a real server that signals `load` correctly.
