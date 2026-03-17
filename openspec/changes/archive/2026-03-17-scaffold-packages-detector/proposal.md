## Why

`packages/detector` is needed before `packages/core` can delegate between static and animated rendering paths. Without a working animation cycle detector, `core` cannot determine whether to produce a still image or a looping video/GIF, nor how long that loop should be.

## What Changes

- New `packages/detector` workspace package (`@pixdom/detector`) with a single exported function `detectAnimationCycle(page: Page): Promise<number | null>`
- Implements a three-stage fallback: CSS computed duration → requestAnimationFrame sampling → fixed timeout fallback returning `null`
- Depends on `@pixdom/types` (`AnimationResult`) and `playwright` (peer dependency)
- Zero new dependencies on other internal packages

## Capabilities

### New Capabilities

- `animation-cycle-detection`: Detects CSS transitions/keyframes and JS-driven rAF animations on a Playwright page, returns cycle length in ms or `null` for static content

### Modified Capabilities

## Impact

- New package `packages/detector` — consumed by `packages/core`
- Peer dependency on `playwright` (caller provides the `Page` instance)
- Depends on `@pixdom/types` for `AnimationResult` return type
