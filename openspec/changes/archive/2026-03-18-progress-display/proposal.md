## Why

Pixdom currently produces no output while it works. A static render takes 3–8 seconds; an animated render can take 30+ seconds. During that time the terminal is silent and users have no feedback — no indication of whether the tool is running, stuck, or waiting on network. This change adds a live, step-by-step progress display to stderr so users always know what pixdom is doing and how far along it is.

## What Changes

- New `ProgressReporter` interface (or event-based channel) threaded through `render()` so the core pipeline can emit named step events without taking a direct dependency on any CLI library
- `ora` spinner integration in the CLI layer: each event starts or completes a spinner step
- Animated pipeline: frame capture emits live counter updates `Capturing frames (48/168)` and FFmpeg encoding emits percentage `Encoding GIF (34%)` when FFmpeg progress is available
- Steps that are not active for the current operation (e.g. no resize when no profile/dimensions set) are never shown
- `--no-progress` global CLI flag suppresses all progress output for CI/piped use
- All progress output goes to stderr; stdout remains clean

## Capabilities

### New Capabilities

- `progress-display`: CLI progress step display — `ora` spinner, step events, frame counter, FFmpeg percentage, `--no-progress` flag

### Modified Capabilities

- `render-pipeline`: `render()` accepts an optional `onProgress` callback used to emit named step events during page load, auto-size, selector resolution, static capture, animated frame capture, and encoding
- `static-renderer`: emits `capture-start` / `capture-done` events via passed-in reporter
- `animated-renderer`: emits `frame-progress(current, total)` and `encode-start` / `encode-progress(pct)` / `encode-done` events via reporter; FFmpeg command wired to parse stderr for progress percentage
- `cli-convert-command`: wires `ProgressReporter` from `ora` into `render()`, handles `--no-progress` flag, conditionally shows resize step based on active flags

## Impact

- `packages/core/src/index.ts` — optional `onProgress` callback in `render()` signature
- `packages/core/src/static-renderer.ts` — reporter parameter, emits capture events
- `packages/core/src/animated-renderer.ts` — reporter parameter, frame counter, FFmpeg progress parsing
- `packages/core/src/image-renderer.ts` — reporter parameter, read/resize/done events
- `apps/cli/src/index.ts` — `--no-progress` flag, ora spinner wiring
- `apps/cli/src/progress-reporter.ts` — new file: ora-based `ProgressReporter` implementation
- New npm dependency: `ora` (latest v8/ESM-compatible) in `apps/cli`
