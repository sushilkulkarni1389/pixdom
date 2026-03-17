## Why

Pages commonly apply short CSS transitions (`transition: color 0.2s`, `transition: background 0.15s`) to interactive elements for hover feedback. The detector currently treats any non-zero `transitionDuration` as an animation cycle, causing `render()` to believe these static pages are animated and attempt GIF/MP4/WebM output — which either fails (`NO_ANIMATION_DETECTED`) or produces incorrect results.

## What Changes

- `cssMaxDuration` in `packages/detector` gains a **500ms threshold**: `transitionDuration` values under 500ms are ignored when the same element has no active `animationDuration`
- `animationDuration` values continue to be counted at any positive length (real keyframe animations are always intentional)
- `transitionDuration` values >= 500ms continue to be counted (long transitions are treated as animation cycles)

## Capabilities

### New Capabilities

*(none)*

### Modified Capabilities

- `animation-cycle-detection`: The "CSS duration detection" requirement gains a filter rule — short `transitionDuration` values (<500ms) on elements with no `animationDuration` are excluded from the max-duration calculation.

## Impact

- Change is confined to `packages/detector/src/index.ts` — `cssMaxDuration` function only
- No API changes (`detectAnimationCycle` signature unchanged)
- No impact on `packages/core`, `apps/cli`, or `apps/mcp-server`
- Pages with only short hover transitions will now correctly return `null` from `cssMaxDuration`, falling through to the rAF sampler (which will also return `null` for truly static pages)
- Pages with `transition-duration >= 500ms` or any `animation-duration > 0` are unaffected
