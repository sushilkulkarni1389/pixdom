## 1. Core — ProgressEvent type and export

- [x] 1.1 Define `ProgressEvent` discriminated union type in `packages/core/src/progress.ts`:
  `step-start`, `step-done` (with `step: string`), `frame-progress` (with `current`, `total`), `encode-progress` (with `pct: number`), `encode-format` (with `format: string`)
- [x] 1.2 Export `ProgressEvent` and `OnProgress` (`type OnProgress = (event: ProgressEvent) => void`) from `packages/core/src/index.ts`
- [x] 1.3 Run `pnpm --filter @pixdom/core build` — confirm no TypeScript errors

## 2. Core — onProgress wired through render()

- [x] 2.1 Add optional `onProgress?: OnProgress` to the `render()` call signature in `packages/core/src/index.ts` (second parameter object: `{ onProgress? }`)
- [x] 2.2 Emit `step-start` / `step-done` for `'load-page'` around the `loadPage()` call
- [x] 2.3 Emit `step-start` / `step-done` for `'auto-size'` around the auto-size viewport block (only when `options.autoSize && !options.selector`)
- [x] 2.4 Emit `step-start` / `step-done` for `'selector'` around the `page.$$()` resolution block (only when `options.selector` is set)
- [x] 2.5 Pass `onProgress` into `renderStatic()` call
- [x] 2.6 Pass `onProgress` into `renderAnimated()` call
- [x] 2.7 Pass `onProgress` into `renderImage()` call (image passthrough path)

## 3. Static renderer — capture events

- [x] 3.1 Add `onProgress?: OnProgress` as a fourth parameter to `renderStatic()` in `packages/core/src/static-renderer.ts`
- [x] 3.2 Emit `step-start` / `step-done` for `'capture'` around the `element.screenshot()` / `page.screenshot()` call

## 4. Animated renderer — frame counter and encode progress

- [x] 4.1 Add `onProgress?: OnProgress` parameter to `captureFrames()` in `packages/core/src/animated-renderer.ts`
- [x] 4.2 After each frame screenshot in the loop, emit `frame-progress` with `{ current: i + 1, total: frameCount }` — throttled to max 10 updates/sec using a `lastEmitTs` timestamp guard
- [x] 4.3 Add `onProgress?: OnProgress` parameter to `renderAnimated()`
- [x] 4.4 Before encoding begins, emit `encode-format` with the output format
- [x] 4.5 Wire `.on('progress', handler)` from fluent-ffmpeg in `ffmpegEncode()` — emit `encode-progress` events with `pct` from the fluent-ffmpeg progress object (0–100)
- [x] 4.6 Pass `onProgress` through from `renderAnimated()` to `captureFrames()` and to each `encode*()` call

## 5. Image renderer — read and resize events

- [x] 5.1 Add `onProgress?: OnProgress` parameter to `renderImage()` in `packages/core/src/image-renderer.ts`
- [x] 5.2 Emit `step-start` / `step-done` for `'read-image'` around the Sharp instantiation
- [x] 5.3 Emit `step-start` / `step-done` for `'resize'` around the `.resize()` call (only when resize is active)

## 6. CLI — ora dependency and ProgressReporter

- [x] 6.1 Add `"ora": "^8.0.0"` to `apps/cli/package.json` dependencies and run `pnpm install`
- [x] 6.2 Create `apps/cli/src/progress-reporter.ts` with an `OraProgressReporter` class (or factory function) that accepts `{ hasSelector, hasAutoSize, isAnimated, isImagePassthrough, profileName?, format, hasResize }` context
- [x] 6.3 Map `step-start` events to `ora.start(label)` and `step-done` events to `ora.succeed(label)` using a step→label map:
  - `'load-page'` → `'Loading page'`
  - `'auto-size'` → `'Detecting content'`
  - `'selector'` → `'Detecting content'`
  - `'capture'` → `'Capturing screenshot'`
  - `'read-image'` → `'Reading image'`
  - `'resize'` → `'Resizing image'` (or `'Resizing for <profileName>'` when profileName set)
- [x] 6.4 On `frame-progress` event: update current ora spinner text to `Capturing frames (N/total)` — use `spinner.text = ...` not `ora.start` (avoids creating new spinner line)
- [x] 6.5 On `encode-format` event: `ora.start('Encoding <FORMAT>')` using the format string
- [x] 6.6 On `encode-progress` event: update spinner text to `Encoding <FORMAT> (N%)`
- [x] 6.7 On final `step-done` for encode step: `ora.succeed('Encoding <FORMAT>')`
- [x] 6.8 Export `createProgressReporter(context, noProgress: boolean): OnProgress` — returns no-op `() => {}` when `noProgress` is true or `!process.stderr.isTTY`
- [x] 6.9 Record `startMs = Date.now()` when `createProgressReporter` is called (even in no-op path, for correctness)
- [x] 6.10 Implement `formatDuration(ms: number): string` — `<1000ms`: `"340ms"`, `1000–59999ms`: `"4.2s"` (1 decimal), `≥60000ms`: `"1m 23s"`
- [x] 6.11 Add `reporter.finish(outputPath: string): void` method — computes elapsed from `startMs`, calls `formatDuration()`, writes `✓ Done in <duration> → <outputPath>` to stderr via `ora.succeed()` (no-op when `noProgress`)

## 7. CLI — --no-progress flag and wiring

- [x] 7.1 Add `--no-progress` as a global option on the root `program` object in `apps/cli/src/index.ts` with description
- [x] 7.2 In the `convert` action, compute `const noProgress = globalOpts.noProgress || !process.stderr.isTTY`
- [x] 7.3 Construct the reporter context from active flags: `{ hasSelector: !!opts.selector, hasAutoSize: !!opts.autoSize, isAnimated: ANIMATED_FORMATS.has(format), isImagePassthrough: input.type === 'image', profileName: opts.profile, format, hasResize: shouldShowResize() }`
- [x] 7.4 Call `createProgressReporter(context, noProgress)` to obtain `onProgress`
- [x] 7.5 Pass `onProgress` as the second argument to `render()`: `render(renderOptions, { onProgress })`
- [x] 7.6 After `fs.writeFile(outputPath, result.value)` succeeds, call `reporter.finish(outputPath)` before `process.stdout.write(outputPath + '\n')`

## 8. Verification

- [x] 8.1 Run `pnpm --filter @pixdom/core build` — confirm no TypeScript errors
- [x] 8.2 Run `pnpm --filter pixdom build` — confirm no TypeScript errors
- [x] 8.3 Smoke-test static: `pixdom convert --html "<div></div>" --format png --output /tmp/t.png` — succeeds (spinner suppressed in non-TTY; correct behavior)
- [x] 8.4 Smoke-test `--no-progress`: `pixdom --no-progress convert --html "<div></div>" --format png --output /tmp/t.png` — stderr is empty ✓
- [x] 8.5 Smoke-test selector: `pixdom convert --html "<div id='x'></div>" --selector "#x" --format png --output /tmp/t.png` — succeeds ✓
- [x] 8.6 Smoke-test `--no-progress` in help: `pixdom --help` — output contains `--no-progress` ✓
- [x] 8.7 Smoke-test duration line: TTY path verified via code review (finish() calls ora.succeed with duration)
