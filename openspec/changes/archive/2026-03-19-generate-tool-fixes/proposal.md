## Why

Two bugs in the `generate_and_convert` MCP tool produce incorrect output when `auto:true` and `profile` are both set: the Claude API response sometimes leaks conversational text or markdown fences into the rendered image, and auto element detection overrides profile-specified viewport dimensions, producing wrong output sizes. Both are high-impact for the primary MCP workflow where users rely on profile presets for platform-ready output.

## What Changes

- Add a `robustHtmlExtract()` helper in the MCP server that strips markdown fences and extracts HTML starting from the first `<!DOCTYPE`, `<html`, or `<` boundary; returns a structured `GENERATE_EMPTY_HTML` error if the result is unusably short
- In `render()`, prevent auto-detected `ElementHandle` from being passed to the renderer when a profile or explicit selector constrains output dimensions — auto element detection is used only for timing (duration, fps), not for capture framing, in those cases
- Add `profileViewport` flag to `RenderOptions` so the render pipeline can distinguish a profile-locked viewport from an ad-hoc one
- Update numeric MCP input schema fields to use `z.coerce.number()` and boolean fields to use `z.preprocess` coercion, preventing type-mismatch validation errors from Claude Code (already partially done; ensure complete coverage)

## Capabilities

### New Capabilities

- `html-extraction`: Robust extraction of HTML from Claude API text responses — strips markdown fences, finds first HTML boundary, validates minimum length, returns structured error on failure

### Modified Capabilities

- `mcp-generate-tool`: Adds HTML extraction step between API response and `render()` call; new `GENERATE_EMPTY_HTML` error code
- `render-pipeline`: New `profileViewport` flag on `RenderOptions`; auto element detection no longer passes `ElementHandle` to renderer when `profileViewport` is true
- `auto-element-detection`: Behaviour scoped to timing-only when caller sets `profileViewport`; element bounding box no longer drives capture frame dimensions in that mode

## Impact

- `apps/mcp-server/src/index.ts`: HTML extraction + coercion changes
- `packages/core/src/index.ts`: `profileViewport` flag handling in `render()`
- `packages/types/src/index.ts`: `profileViewport?: boolean` added to `RenderOptions`
- No public API changes; MCP tool response shape unchanged
