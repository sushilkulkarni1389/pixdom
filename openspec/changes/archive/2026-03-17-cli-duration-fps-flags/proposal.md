## Why

Users rendering animated output (GIF, MP4, WebM) have no way to control two critical parameters from the CLI: the frame rate and the animation duration. `fps` is already part of `RenderOptions` but is never wired to a CLI flag. `duration` (the animation cycle length passed to the animated renderer) is currently auto-detected only — there is no way to override it, forcing users to rely on heuristic detection even when they know the exact cycle length.

## What Changes

- Add `--fps <n>` flag to `pixdom convert` — passed directly to `RenderOptions.fps`; defaults to the core renderer's built-in 30fps when omitted
- Add `--duration <ms>` flag to `pixdom convert` — passed to a new `duration` field in `RenderOptions`; when set, `render()` skips `detectAnimationCycle()` and uses the provided value as `cycleMs` directly
- Add `duration: number` (optional) to `RenderOptionsSchema` in `@pixdom/types`
- Update `render()` in `@pixdom/core` to use `options.duration` as `cycleMs` when present, falling back to `detectAnimationCycle(page)` as before

## Capabilities

### New Capabilities

*(none)*

### Modified Capabilities

- `cli-convert-command`: Two new flags added to `pixdom convert` — `--fps <n>` and `--duration <ms>`. Both are optional, apply only to animated formats, and individual flags override profile values.
- `render-pipeline`: `RenderOptions` gains an optional `duration` field. When set, `render()` uses it as `cycleMs` instead of calling `detectAnimationCycle()`.

## Impact

- `packages/types/src/index.ts`: `RenderOptionsSchema` gains `duration: z.number().optional()`
- `packages/core/src/index.ts`: `render()` uses `options.duration ?? await detectAnimationCycle(page)`
- `apps/cli/src/index.ts`: two new `.option()` calls, both passed through to `render()`
- `apps/mcp-server/src/index.ts`: no change (mcp-server already exposes `fps` is not in its schema — not in scope)
- No breaking changes to existing callers (both fields optional)
