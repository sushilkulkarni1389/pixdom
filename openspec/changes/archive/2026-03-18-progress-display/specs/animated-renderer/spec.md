## MODIFIED Requirements

### Requirement: rAF frame capture loop
The animated renderer SHALL accept an optional `ElementHandle` parameter alongside `page` and `RenderOptions`. When the `ElementHandle` is provided, it SHALL call `element.screenshot({ type: 'png' })` per frame instead of `page.screenshot({ type: 'png' })`. The `ElementHandle` bounding box SHALL be computed once before the loop begins.

The animated renderer SHALL also accept an optional `onProgress?: (event: ProgressEvent) => void` parameter. When provided:
- It SHALL emit `{ type: 'frame-progress', current: i+1, total: frameCount }` after each frame is captured (throttled to at most 10 updates per second to avoid excessive terminal redraws)
- It SHALL emit `{ type: 'encode-format', format: options.format }` before encoding begins
- It SHALL emit `{ type: 'encode-progress', pct: number }` events when fluent-ffmpeg emits progress data during encoding

The rest of the loop behaviour (clock API, frame count, temp directory cleanup) is unchanged.

#### Scenario: Frame count proportional to cycle length
- **WHEN** the animated renderer captures a 1000ms cycle at 30fps
- **THEN** exactly 30 PNG frames are written to the temp directory

#### Scenario: Frames are at exact time positions
- **WHEN** a CSS animation with a known 1000ms cycle is captured at 30fps
- **THEN** frame `i` is captured at synthetic time `i × 33ms` (±1ms) — each frame shows a distinct, evenly-spaced animation state

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

#### Scenario: frame-progress events emitted during capture
- **WHEN** `captureFrames` is invoked with a non-null `onProgress`
- **THEN** `onProgress` receives `frame-progress` events with incrementing `current` values up to `total`

#### Scenario: encode-progress events emitted during FFmpeg pass
- **WHEN** `renderAnimated` is invoked with a non-null `onProgress` and FFmpeg emits progress
- **THEN** `onProgress` receives one or more `encode-progress` events with `pct` between 0 and 100
