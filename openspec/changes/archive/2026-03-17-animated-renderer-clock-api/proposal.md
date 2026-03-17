## Why

The current `captureFrames` implementation advances animation time by injecting a real-time `setTimeout` into the page between each screenshot. This makes captures slow (a 2-second animation takes ≥2 seconds to capture), non-deterministic (wall-clock variance causes irregular frame spacing), and drift-prone on slow machines. Playwright's Clock API (`page.clock`) allows synthetic, instantaneous time advancement — CSS animations, `requestAnimationFrame` callbacks, and `performance.now()` all advance to an exact target time with a single call, producing perfectly evenly-spaced frames regardless of machine speed.

## What Changes

- Bump `playwright` dependency in `packages/core` to `^1.45.0` (minimum version for the stable Clock API)
- Replace the `page.evaluate(setTimeout)` inter-frame delay in `captureFrames` with `page.clock.install({ time: 0 })` before the loop and `page.clock.tick(frameIntervalMs)` per frame
- Remove the real-time waiting path entirely — capture speed is now O(frameCount × screenshotTime), not O(cycleMs)

## Capabilities

### New Capabilities

*(none)*

### Modified Capabilities

- `animated-renderer`: The "rAF frame capture loop" requirement changes — frames are no longer captured via an injected rAF loop with real-time delays; instead Playwright's synthetic clock is advanced per-frame interval and a screenshot taken at each exact time position.

## Impact

- Change is confined to `packages/core/src/animated-renderer.ts` (`captureFrames` function only)
- `playwright` minimum version bumped from `^1.40.0` to `^1.45.0` in `packages/core/package.json`
- No API changes (`renderAnimated` / `render` signatures unchanged)
- Animated renders will be significantly faster (no real-time waiting per frame)
- Output is deterministic: same HTML input always produces byte-identical frame sequences
- `apps/cli` and `apps/mcp-server` are unaffected
