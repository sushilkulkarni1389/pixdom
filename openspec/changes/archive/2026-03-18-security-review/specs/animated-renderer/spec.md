## MODIFIED Requirements

### Requirement: rAF frame capture loop
The animated renderer SHALL accept an optional `ElementHandle` parameter alongside `page` and `RenderOptions`. When the `ElementHandle` is provided, it SHALL call `element.screenshot({ type: 'png' })` per frame instead of `page.screenshot({ type: 'png' })`. The `ElementHandle` bounding box SHALL be computed once before the loop begins. The rest of the loop behaviour (clock API, frame count, temp directory cleanup) is unchanged. Before the capture loop begins, it SHALL call `page.clock.install({ time: 0 })` to install a synthetic clock. For each frame, it SHALL call `page.clock.runFor(frameIntervalMs)` to advance the synthetic clock by one frame interval (firing all timers and rAF callbacks in that window), then take a Playwright screenshot. No real-time waiting between frames is permitted. The loop SHALL produce exactly `round(cycleMs / 1000 * fps)` frames (minimum 1).

The animated renderer SHALL also accept an optional `onProgress?: (event: ProgressEvent) => void` parameter. When provided:
- It SHALL emit `{ type: 'step-start', step: 'capture-frames' }` before the frame loop begins
- It SHALL emit `{ type: 'frame-progress', current: i+1, total: frameCount }` after each frame is captured (throttled to at most 10 updates per second)
- It SHALL emit `{ type: 'step-done', step: 'capture-frames' }` after the loop completes
- It SHALL emit `{ type: 'encode-format', format: options.format }` before encoding begins
- It SHALL emit `{ type: 'encode-progress', pct: number }` events derived from FFmpeg stderr progress parsing — `pct` SHALL be clamped to a maximum of 100
- It SHALL emit `{ type: 'encode-done', format: string }` (uppercase format) after encoding completes
- It SHALL emit `{ type: 'step-start', step: 'write-output' }` and `{ type: 'step-done', step: 'write-output' }` after `encode-done`

FFmpeg SHALL be invoked via `child_process.spawn()` with explicit argument arrays. `fluent-ffmpeg` SHALL NOT be used.

#### Scenario: Frame count proportional to cycle length
- **WHEN** the animated renderer captures a 1000ms cycle at 30fps
- **THEN** exactly 30 PNG frames are written to the temp directory

#### Scenario: Frames are at exact time positions
- **WHEN** a CSS animation with a known 1000ms cycle is captured at 30fps
- **THEN** frame `i` is captured at synthetic time `i × 33ms` (±1ms)

#### Scenario: Capture completes without real-time waiting
- **WHEN** a 2000ms animation cycle is captured at 30fps
- **THEN** the total host-side wall-clock time for `captureFrames` is under 10 seconds

#### Scenario: Temp directory cleaned up after render
- **WHEN** `render()` returns (success or failure)
- **THEN** the per-call temp directory and all frame files are deleted

#### Scenario: Element screenshot used per frame when handle provided
- **WHEN** the animated renderer is invoked with a non-null `ElementHandle`
- **THEN** `element.screenshot()` is called for each frame instead of `page.screenshot()`

#### Scenario: Bounding box computed once before frame loop
- **WHEN** the animated renderer is invoked with a non-null `ElementHandle`
- **THEN** `element.boundingBox()` is called exactly once before the first frame is captured

#### Scenario: capture-frames step-start emitted before first frame
- **WHEN** `captureFrames` is invoked with a non-null `onProgress`
- **THEN** `onProgress` receives `{ type: 'step-start', step: 'capture-frames' }` before any `frame-progress` event

#### Scenario: capture-frames step-done emitted after last frame
- **WHEN** `captureFrames` completes all frames and returns
- **THEN** `onProgress` receives `{ type: 'step-done', step: 'capture-frames' }` as the final event from `captureFrames`

#### Scenario: frame-progress events emitted during capture
- **WHEN** `captureFrames` is invoked with a non-null `onProgress`
- **THEN** `onProgress` receives `frame-progress` events with incrementing `current` values up to `total`

#### Scenario: encode-progress events emitted during FFmpeg pass
- **WHEN** `renderAnimated` is invoked with a non-null `onProgress` and FFmpeg emits progress
- **THEN** `onProgress` receives one or more `encode-progress` events with `pct` between 0 and 100

#### Scenario: encode-progress pct never exceeds 100
- **WHEN** FFmpeg stderr indicates a frame count exceeding the expected total
- **THEN** the `encode-progress` event received by `onProgress` has `pct` clamped to `100`

#### Scenario: encode-done emitted after FFmpeg completes
- **WHEN** FFmpeg encoding completes successfully
- **THEN** `onProgress` receives `{ type: 'encode-done', format: 'GIF' | 'MP4' | 'WEBM' }` before any `write-output` events

#### Scenario: No fluent-ffmpeg import in animated renderer
- **WHEN** `packages/core/src/animated-renderer.ts` is statically analysed
- **THEN** no import from `fluent-ffmpeg` is present
