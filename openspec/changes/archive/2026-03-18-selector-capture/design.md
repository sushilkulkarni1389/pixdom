## Context

`packages/core/src/index.ts` currently calls `page.screenshot()` (static) or iterates a frame loop with `page.screenshot()` per frame (animated). Neither has any concept of a DOM element target. `RenderOptions` has no `selector` field. The CLI has no `--selector` flag.

The change is cross-cutting: types → core → static renderer → animated renderer → CLI. The Playwright API already provides everything needed (`page.$()`, `element.boundingBox()`, `element.screenshot()`), so no new dependencies are required.

## Goals / Non-Goals

**Goals:**
- Resolve a CSS selector to an `ElementHandle` after page load
- Use `element.screenshot()` for both static and animated captures when selector is active
- Return `SELECTOR_NOT_FOUND` error when selector matches nothing
- Warn (stderr) when selector matches multiple elements; use first match
- Suppress `--width`/`--height`/`--auto-size` override logic in the CLI when selector is active

**Non-Goals:**
- Selector support for `--image` input (no DOM)
- Multiple simultaneous captures from multiple selectors
- Waiting/polling for elements that appear after initial load (no `:visible` or retry logic)
- CSS injection to hide surrounding elements — `element.screenshot()` handles clipping natively; no DOM manipulation needed

## Decisions

### 1. `element.screenshot()` over `page.screenshot({ clip: boundingBox })`
**Decision**: Use `element.screenshot()` directly.

**Rationale**: `element.screenshot()` handles scroll offset, `deviceScaleFactor` scaling, and element-level clipping automatically. `page.screenshot({ clip: ... })` requires manual coordinate math including scroll position and would miss fractional pixel rounding that Playwright handles internally. The Playwright docs explicitly recommend `element.screenshot()` for element-level capture.

**Alternative considered**: `page.screenshot({ clip: element.boundingBox() })` — rejected because it doesn't account for page scroll position (elements below the fold would capture wrong coordinates) and requires manual `deviceScaleFactor` multiplication.

### 2. Selector resolved once in `render()`, `ElementHandle` passed to renderers
**Decision**: Resolve `page.$(selector)` in `render()` after page load, then pass the `ElementHandle` into the static/animated renderer functions as an optional parameter.

**Rationale**: Keeps element resolution in one place. Both renderers receive either `undefined` (no selector) or a live `ElementHandle`. The animated renderer's per-frame logic simply calls `element.screenshot()` if the handle is set, otherwise `page.screenshot()` — no re-querying each frame.

**Alternative considered**: Pass the selector string to renderers and resolve inside each — rejected because it duplicates error handling and adds a Playwright query per frame in animated mode.

### 3. `SELECTOR_NOT_FOUND` as a new `RenderError` code
**Decision**: Add `'SELECTOR_NOT_FOUND'` to the error code union in `@pixdom/types`.

**Rationale**: Callers (CLI, MCP) need to distinguish "selector exists but renders badly" from "selector never found". A dedicated code makes this branch testable and allows the CLI to print a targeted error message.

### 4. `--width`/`--height` warning emitted to stderr, not an error
**Decision**: When `--selector` and `--width`/`--height` are both provided, emit a warning to stderr and proceed (ignoring the dimension flags). Not an exit-code-1 error.

**Rationale**: User intent is clear — they want the element, not a custom viewport. Hard-failing would be surprising for users who have `--width` in a shell alias or Makefile. Warn-and-continue is the friendlier UX.

## Risks / Trade-offs

- **Element moves between frames**: In animated captures, the element's bounding box is computed once before the frame loop. If the element animates its own position/size (e.g. a growing bar chart), `element.screenshot()` still clips to the element's current position per frame — but the viewport will be sized to the initial bounding box. Elements that grow outside their initial bounds may be clipped. → Mitigation: document this limitation; advanced users can use `--width`/`--height` instead with `page.screenshot`.
- **Detached elements**: If JS removes the element between page load and capture (rare), Playwright throws. → Mitigation: caught by the existing `CAPTURE_FAILED` error handler in `render()`.
- **Zero-size elements**: An element with `display: none` or zero dimensions returns `null` from `boundingBox()`. → Mitigation: treat null bounding box the same as no-match and return `SELECTOR_NOT_FOUND`.

## Migration Plan

1. Add `selector?: string` to `RenderOptionsSchema` in `packages/types`
2. Add `'SELECTOR_NOT_FOUND'` to the error code docs/union
3. Update `render()` in `packages/core` to resolve element and pass handle to renderers
4. Update static renderer call site to accept and use `ElementHandle | undefined`
5. Update animated renderer call site similarly
6. Add `--selector` to `apps/cli`; add warning logic for `--width`/`--height`/`--auto-size`

All changes are additive. `selector` defaults to `undefined`; existing call sites unaffected.
