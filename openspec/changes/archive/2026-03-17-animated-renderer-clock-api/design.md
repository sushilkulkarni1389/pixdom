## Context

`captureFrames` currently works like this:

```ts
for (let i = 0; i < frameCount; i++) {
  await page.screenshot({ path: framePath });
  // advance animation by waiting in real time
  await page.evaluate(
    (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    frameInterval,
  );
}
```

The `setTimeout` call blocks the Node.js event loop for `frameInterval` ms of real wall-clock time (e.g., 33ms per frame at 30fps for a 1s animation = ~1s of real waiting just for timer ticks, plus screenshot overhead). The animation's actual position when the screenshot fires depends on when Chromium's compositor decided to paint — there is no guarantee it has advanced by exactly `frameInterval`.

Playwright's Clock API (`page.clock`, stable since 1.45) replaces this entirely:
- `page.clock.install({ time: 0 })` installs a fake clock that controls `Date`, `performance.now()`, `setTimeout`, `setInterval`, and `requestAnimationFrame`
- `page.clock.tick(ms)` instantly advances all of those by `ms`, triggering all callbacks that would have fired in that window — including rAF callbacks and CSS animation timeline advances
- The call returns after Chromium has rendered the new state, making the next `page.screenshot()` capture exactly the right frame

## Goals / Non-Goals

**Goals:**
- Frame-accurate, evenly-spaced capture at exact multiples of `frameIntervalMs`
- Deterministic output: identical input → identical frame sequence on any machine
- Faster captures: wall-clock time drops from `cycleMs` to `frameCount × ~30ms (screenshot time)`
- Minimal code change: replace `page.evaluate(setTimeout)` with two Clock API calls

**Non-Goals:**
- Changing the encode pipeline (FFmpeg calls are unaffected)
- Supporting Playwright < 1.45 (Clock API is a hard requirement)
- Frame blending or motion blur between ticks
- Exposing clock control as a user-facing option

## Decisions

### 1. `page.clock.install({ time: 0 })` called inside `captureFrames`, after page load
**Decision**: Install the fake clock at the start of `captureFrames`, not at page-load time.
**Rationale**: `detectAnimationCycle` runs before `captureFrames` and uses a real-time 300ms MutationObserver sampling window. Installing the clock before detection would freeze that window and break detection. Installing it in `captureFrames` — after detection — is the cleanest split: detection uses real time, capture uses synthetic time.

### 2. `page.clock.tick(frameIntervalMs)` once per frame (not cumulative)
**Decision**: Each iteration calls `tick(frameIntervalMs)` rather than `tick(i * frameIntervalMs)`.
**Rationale**: `tick()` is additive — each call advances from the current synthetic time. Calling it once per frame keeps the loop simple and avoids computing absolute offsets. The result is identical: frame `i` is captured at synthetic time `i * frameIntervalMs`.

### 3. Bump playwright to `^1.45.0`
**Decision**: Update the `playwright` semver range in `packages/core/package.json` from `^1.40.0` to `^1.45.0`.
**Rationale**: `page.clock` was marked stable in 1.45. Using `^1.40.0` would allow installs that lack the API. A minimum of 1.45 is the safest constraint.

## Risks / Trade-offs

- **Clock install after page load may miss early rAF frames** — if a JS animation starts immediately on load and runs a few frames before `captureFrames` is called, those frames will have already fired in real time. After `install({ time: 0 })`, `performance.now()` resets to 0, which could cause a JS animation that checks elapsed time to appear to restart. Mitigation: acceptable for v1; animations that are purely CSS-driven or start on a user trigger are unaffected. A future improvement could install the clock before `setContent` and tick through the page-load phase as well.
- **Playwright version bump** — users on 1.40–1.44 would need to update. Mitigation: semver range makes this transparent for `pnpm install`; it's a minor version bump with no breaking changes to the APIs we use.
