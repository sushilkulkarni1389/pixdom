## 1. Dependency

- [x] 1.1 Bump `playwright` from `^1.40.0` to `^1.45.0` in `packages/core/package.json`
- [x] 1.2 Run `pnpm install` to update the lockfile

## 2. Implementation

- [x] 2.1 In `captureFrames`, before the frame loop, add `await page.clock.install({ time: 0 })`
- [x] 2.2 Replace the `page.evaluate((ms) => new Promise(resolve => setTimeout(resolve, ms)), frameInterval)` call with `await page.clock.runFor(frameIntervalMs)` at the start of each loop iteration (before the screenshot), removing the `if (i < frameCount - 1)` guard
- [x] 2.3 Remove the now-unused `frameInterval` variable name (rename or inline as `frameIntervalMs` for clarity)

## 3. Verification

- [x] 3.1 Run `tsc --noEmit` in `packages/core` — zero type errors
- [x] 3.2 Confirm a CSS animation render produces the correct number of frames and completes faster than real-time
- [x] 3.3 Run `tsc --noEmit` in `apps/cli` and `apps/mcp-server` — zero type errors
