## Context

`RenderOptions` already has `fps?: number` (passed to the animated renderer's frame capture loop) but the CLI never reads it. `duration` does not exist in `RenderOptions` — the animated renderer always uses `cycleMs` from `detectAnimationCycle()`. Users who know their animation's exact cycle length (e.g., a 2000ms CSS keyframe animation) must rely on detection, which can fail or return an incorrect value.

Current flow in `render()`:
```ts
const cycleMs = await detectAnimationCycle(page);  // always called
if (cycleMs === null) return Result.err(NO_ANIMATION_DETECTED);
await renderAnimated(page, options, cycleMs);
```

With `duration` override:
```ts
const cycleMs = options.duration ?? await detectAnimationCycle(page);
if (cycleMs === null) return Result.err(NO_ANIMATION_DETECTED);
await renderAnimated(page, options, cycleMs);
```

## Goals / Non-Goals

**Goals:**
- `--fps <n>` wired end-to-end: CLI flag → `RenderOptions.fps` → `renderAnimated` fps parameter
- `--duration <ms>` wired end-to-end: CLI flag → `RenderOptions.duration` → `cycleMs` in `render()`
- Both flags are optional; omitting them preserves existing behaviour exactly
- `duration` skips `detectAnimationCycle()` entirely when set (no wasted sampling time)

**Non-Goals:**
- Adding `--fps` / `--duration` to the MCP server tools (separate change if needed)
- Validating that `--duration` or `--fps` only makes sense with animated formats — the error from the renderer is sufficient
- Adding `duration` to profile presets

## Decisions

### 1. `duration` lives in `RenderOptions` (not a separate parameter)
**Decision**: Add `duration?: number` to `RenderOptionsSchema` rather than a separate override parameter to `render()`.
**Rationale**: Keeps the `render()` signature to one argument. Consistent with how `fps`, `quality`, and `timeout` are passed. Callers (CLI, MCP server) compose a single options object.

### 2. `options.duration` short-circuits `detectAnimationCycle`
**Decision**: When `options.duration` is set, skip the detection call entirely.
**Rationale**: Detection takes ~300ms of real time (MutationObserver sampling window). If the caller knows the duration, there's no benefit to running detection. Also avoids the `NO_ANIMATION_DETECTED` error for pages whose CSS animations the detector might miss (e.g., JS-driven animations with no DOM mutations).

### 3. Profile resolution for `--fps`
**Decision**: No profile currently sets `fps`. If `--fps` is provided, it overrides. If neither is set, `fps` is `undefined` in `RenderOptions` and the animated renderer defaults to 30fps.
**Rationale**: No profile conflict to resolve. Keeps the profile override pattern consistent with other flags.

### 4. CLI flag types: string → parseInt in action handler
**Decision**: Both `--fps` and `--duration` are declared as string options (Commander default) and parsed with `parseInt` in the action handler, consistent with `--width`, `--height`, and `--quality`.
**Rationale**: Commander parses all option values as strings unless a coercion function is provided. Using `parseInt` in the handler keeps flag declarations uniform.

## Risks / Trade-offs

- **`--duration` with a static format is silently ignored** — if a user passes `--duration 2000 --format png`, the field is set but `render()` takes the static path and never uses it. Mitigation: acceptable; no error needed since static rendering works correctly regardless.
- **`--duration 0` or negative values** — passing zero or negative ms would confuse the animated renderer. Mitigation: validate in the CLI action handler (must be a positive integer) and emit a clear error + exit 1.
