## 1. Core — emit capture-frames step events

- [x] 1.1 In `captureFrames()` in `packages/core/src/animated-renderer.ts`, emit `step-start` with `step: 'capture-frames'` before the frame loop begins
- [x] 1.2 Emit `step-done` with `step: 'capture-frames'` after the frame loop completes

## 2. Reporter — handle capture-frames step and fix finish()

- [x] 2.1 In `apps/cli/src/progress-reporter.ts`, add `'capture-frames'` to the `step-start` handler: start a "Capturing frames" spinner immediately (text: `"Capturing frames"`)
- [x] 2.2 Add `'capture-frames'` to the `step-done` handler: succeed the spinner with the final frame count if known, else the label "Capturing frames"
- [x] 2.3 In the `frame-progress` handler, remove the lazy `else` branch that creates a spinner — always just update `spinner.text` (spinner is now always started by step-start)
- [x] 2.4 In `reporter.finish()`, add a guard before the Done line: if `spinner` is still active, call `spinner.stop()` to clear it before printing

## 3. Verification

- [x] 3.1 Run `pnpm --filter @pixdom/core build` — no TypeScript errors
- [x] 3.2 Run `pnpm --filter pixdom build` — no TypeScript errors
