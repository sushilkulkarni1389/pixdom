## 1. Implementation

- [x] 1.1 In `packages/detector/src/index.ts`, update the inner loop of `cssMaxDuration`'s `page.evaluate()` callback: for each element, collect `animationDuration` durations unconditionally; collect `transitionDuration` durations only if the element's `animationDuration` is non-zero OR the transition value is >= 500ms

## 2. Verification

- [x] 2.1 Run `tsc --noEmit` in `packages/detector` — zero type errors
- [x] 2.2 Manually confirm: a page with only `transition: color 0.2s` returns `null` from `detectAnimationCycle`
- [x] 2.3 Manually confirm: a page with `animation: spin 1.2s` still returns `1200`
- [x] 2.4 Manually confirm: a page with `transition: transform 0.8s` still returns `800`
