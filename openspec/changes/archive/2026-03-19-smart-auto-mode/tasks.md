## 1. Types — add auto field

- [x] 1.1 Add `auto?: boolean` to `RenderOptionsSchema` in `packages/types/src/index.ts`

## 2. Detector — new exports

- [x] 2.1 Implement `autoDetectElement(page)` in `packages/detector/src/index.ts` — scoring algorithm via `page.evaluate()`, returns `{ selector, width, height } | null`
- [x] 2.2 Implement `autoDetectDuration(page, selector?)` in `packages/detector/src/index.ts` — multi-source LCM strategy (Strategy 1 css-lcm → Strategy 2 css-transition → Strategy 3 source-pattern → null)
- [x] 2.3 Implement `autoDetectFps(page, selector?, durationMs?)` in `packages/detector/src/index.ts` — timing-function introspection, frame-count ceiling guard
- [x] 2.4 Export all three new functions from `packages/detector/src/index.ts`

## 3. Core — ProgressEvent and auto-detection branch

- [x] 3.1 Add `{ type: 'auto-detected'; element: string | null; duration: number | null; fps: number; frames: number }` variant to `ProgressEvent` union in `packages/core/src/index.ts`
- [x] 3.2 Add `'analyse-page'` and `'detect-animations'` step names to the existing `step-start`/`step-done` step set (ensure render() emits them when auto=true)
- [x] 3.3 Add auto-detection pre-render branch in `packages/core/src/index.ts` `render()`: when `options.auto === true` and input type is not `'image'`, call `autoDetectElement`, `autoDetectDuration`, `autoDetectFps` in order, inject results, emit `auto-detected` ProgressEvent
- [x] 3.4 Handle `auto=true` with `input.type === 'image'`: emit warning via onProgress, proceed without detection
- [x] 3.5 Handle `auto=true` with `autoDetectDuration` returning `null` for animated format: switch to static renderer instead of returning `NO_ANIMATION_DETECTED`

## 4. CLI — --auto flag and summary

- [x] 4.1 Add `--auto` boolean flag to `convert` subcommand in `apps/cli/src/index.ts`; set `RenderOptions.auto = true` when present
- [x] 4.2 Add `--auto` incompatibility guard: when `--auto` and `--image` are both set, print warning to stderr and do not set `auto: true`
- [x] 4.3 Handle `auto-detected` ProgressEvent in CLI: print the auto-summary block to stderr (Element, Duration, FPS, Frames lines) when received
- [x] 4.4 Print ambiguity warning when `element` is `null` in `auto-detected` event
- [x] 4.5 Print LCM-exceeded warning when duration strategy is `css-lcm` but durationMs equals the longest individual (detect by comparing to LCM if available, or add a flag to the event)
- [x] 4.6 Print no-animation static fallback warning when `duration` is `null` in `auto-detected` event and requested format is animated
- [x] 4.7 Suppress auto-summary when `--no-progress` is set or stderr is not a TTY

## 5. Progress reporter — new step labels

- [x] 5.1 Add `'analyse-page': 'Analysing page'` and `'detect-animations': 'Detecting animations'` to `STEP_LABELS` in `apps/cli/src/progress-reporter.ts`

## 6. Build and smoke test

- [x] 6.1 Run `pnpm build` across all packages and confirm no TypeScript errors
- [x] 6.2 Smoke test: `pixdom convert --file <animated-page.html> --format gif --auto --output /tmp/out.gif` — confirm auto-summary printed and GIF produced
- [x] 6.3 Smoke test: `pixdom convert --file <static-page.html> --format gif --auto` — confirm no-animation warning and PNG fallback
- [x] 6.4 Smoke test: `pixdom convert --file <page.html> --format gif --auto --selector "#card"` — confirm `--selector` overrides auto-element-detection
