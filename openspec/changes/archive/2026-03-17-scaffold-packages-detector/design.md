## Context

`packages/core` needs to know whether a rendered page has animation and, if so, how long the loop is before it can choose the right output pipeline (still image vs. looping video). The detector is the only place this logic lives; keeping it in a separate package ensures it can be tested independently and reused if a future API surface needs it.

The package receives an already-navigated Playwright `Page` — it never creates a browser itself.

## Goals / Non-Goals

**Goals:**
- Single exported function `detectAnimationCycle(page: Page): Promise<number | null>`
- Three-stage fallback: CSS computed durations → rAF frame-delta sampling → return `null`
- All in-page JS executed via `page.evaluate()` with plain serialisable arguments/return values
- Return type aligned with `AnimationResult` from `@pixdom/types`

**Non-Goals:**
- Capturing frames or producing output (that is `core`'s job)
- Starting, navigating, or closing the browser
- Detecting video element durations or audio
- Supporting non-Playwright browser automation APIs

## Decisions

### 1. Three-stage fallback over a single strategy
**Decision**: Try CSS first (zero sampling delay), fall back to rAF sampling (15 frames, ~250ms at 60fps), then return `null`.
**Rationale**: CSS `animation-duration` / `transition-duration` are readable synchronously with `getComputedStyle` and cover the majority of cases. rAF sampling catches JS-driven animations that leave no CSS footprint. Alternatives: fixed-interval `setInterval` polling — noisier and harder to cancel cleanly inside `page.evaluate`.

### 2. `page.evaluate()` only — no `page.exposeFunction`
**Decision**: All detection logic runs inside serialisable `page.evaluate()` calls.
**Rationale**: Avoids the overhead of Node↔browser IPC for every rAF tick. The constraint is already in the existing spec; this design explicitly honours it. Trade-off: logic is slightly harder to unit-test directly, but the scenarios are integration-testable with a real Playwright page.

### 3. Playwright as peer dependency
**Decision**: `playwright` declared as `peerDependency`, not `dependency`.
**Rationale**: `core` already brings `playwright` into the process; duplicating it would cause two Playwright instances competing for the browser binary. Callers must satisfy the peer.

### 4. Return `number | null`, not `AnimationResult`
**Decision**: `detectAnimationCycle` returns `Promise<number | null>` directly; the caller wraps it into `AnimationResult` if needed.
**Rationale**: Simpler function signature. `AnimationResult` (`{ cycleMs }`) is a DTO for cross-boundary transport; the detector doesn't need the wrapper. `@pixdom/types` is still imported for the `AnimationResult` type export (re-exported from this package for convenience).

## Risks / Trade-offs

- **rAF sampling window is short (~250ms)** → May miss very slow animations (>4s cycles). Mitigation: configurable `sampleMs` option (default 250) reserved for v2; v1 uses fixed window.
- **CSS duration reflects computed style, not playback state** → A paused or `animation-play-state: paused` animation will still report a non-zero duration. Mitigation: documented limitation; out of scope for v1.
- **Serialisability requirement limits rAF logic** → Cannot pass callbacks; must use a `Promise`-based poll loop inside `evaluate`. Tested against Playwright's serialisation contract.
