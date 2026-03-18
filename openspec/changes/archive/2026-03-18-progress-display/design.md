## Context

`packages/core` is a pure library — it has no CLI dependencies and its `render()` function currently takes only `RenderOptions`. The CLI in `apps/cli` owns all user-facing output. To thread progress events from deep inside the rendering pipeline (Playwright page load, FFmpeg encoding) back to the CLI spinner without coupling core to `ora`, we need a lightweight event channel.

The animated renderer's `captureFrames()` runs a tight loop with up to 168+ iterations. The FFmpeg commands are opaque processes. Both need live progress output. The static renderer is a single async call and only needs start/done events.

## Goals / Non-Goals

**Goals:**
- Named step events emitted from core, handled in CLI layer
- Live frame counter updating in-place (`Capturing frames (48/168)`)
- FFmpeg percentage from stderr parsing when available
- Steps conditionally shown based on active flags
- `--no-progress` / non-TTY / `--no-color` all suppress progress
- Zero new dependencies in `packages/core`

**Non-Goals:**
- Progress in the MCP server (separate caller, different UX)
- Elapsed time display
- ETA estimation
- Nested progress bars

## Decisions

### 1. ProgressReporter as a callback interface in core
**Decision**: Add an optional `onProgress?: (event: ProgressEvent) => void` parameter to `render()`, `renderStatic()`, `renderAnimated()`, `captureFrames()`, and `renderImage()`. The `ProgressEvent` type is defined in `packages/core`.

```ts
export type ProgressEvent =
  | { type: 'step-start'; step: string }
  | { type: 'step-done'; step: string }
  | { type: 'frame-progress'; current: number; total: number }
  | { type: 'encode-progress'; pct: number }
  | { type: 'encode-format'; format: string };
```

**Rationale**: A simple callback is zero-dependency, tree-shakeable, and easy for any caller to implement or ignore. No event emitters, no streams, no additional packages in core. The CLI wraps it in an `ora` spinner; the MCP server ignores it entirely.

**Alternative considered**: Node `EventEmitter` on the `render()` return value — rejected because it complicates the `Result<Buffer, RenderError>` return type and requires callers to attach listeners before awaiting.

### 2. ora v8 (ESM) in apps/cli only
**Decision**: Add `ora` as a dependency of `apps/cli` only. Use dynamic import or top-level import in `progress-reporter.ts` (the CLI package is already ESM via `"type": "module"`).

**Rationale**: `ora` v8 is ESM-only. `apps/cli` already uses `"type": "module"` and `moduleResolution: "bundler"`, so direct import works.

**Alternative considered**: `nanospinner` or hand-rolled ANSI spinner — rejected to avoid maintaining spinner animation code; `ora` is the de facto standard and well-maintained.

### 3. FFmpeg progress parsing from stderr
**Decision**: In `ffmpegEncode()`, attach a stderr data listener on the ffmpeg process before calling `.run()`. Parse lines matching `frame=\s*(\d+)` or `time=(\d{2}:\d{2}:\d{2}\.\d{2})` to compute percentage, then emit `encode-progress` events. Total frame count is passed in from `captureFrames`.

**Rationale**: FFmpeg writes progress to stderr by default. `fluent-ffmpeg` exposes `.on('stderr', handler)` and `.on('progress', handler)`. The `.on('progress')` event from fluent-ffmpeg already provides `percent` directly — no manual parsing needed.

**Alternative considered**: Polling output file size — rejected because unreliable and adds I/O overhead.

### 4. Conditional step display in CLI
**Decision**: The CLI `ProgressReporter` constructor accepts a `context` object:
```ts
{ hasProfile: boolean; hasSelector: boolean; hasAutoSize: boolean; format: OutputFormat; profileName?: string }
```
This determines which step labels to pre-register with `ora`. Steps not in the pre-registered set are ignored if emitted. The "Detecting content" step is shown only if `hasSelector || hasAutoSize`. The "Resizing image" step is shown only if `hasProfile || (width !== 1280 || height !== 720)` for image passthrough.

**Rationale**: The spec says "steps that are skipped are not shown at all." Pre-registering which steps are relevant avoids showing/hiding incomplete steps mid-run.

### 5. --no-progress suppression
**Decision**: `--no-progress` is a global flag (like `--no-color`). When set, or when `stderr` is not a TTY, the `ProgressReporter` passed to `render()` is a no-op stub `() => {}`. `ora` is never imported in this path.

**Rationale**: Scripting and CI environments pipe stderr — a non-TTY should never receive spinner escape codes. No-op stub avoids any ora initialization overhead.

## Risks / Trade-offs

- **Frame counter flicker**: Updating the spinner text on every frame (up to 30/s) may flicker on slow terminals. → Mitigation: throttle updates to at most 10/s using a timestamp gate in `captureFrames`.
- **FFmpeg progress availability**: Some FFmpeg builds/formats don't emit progress. → Mitigation: If no `progress` event fires within 2 seconds of encode start, the step label stays as "Encoding GIF" without percentage — graceful degradation.
- **ora import in ESM**: `ora` v8 requires `import` not `require`. → Mitigation: already handled by `apps/cli`'s `"type": "module"` and `moduleResolution: "bundler"`.
