# animated-renderer — requirements

### Requirement: rAF frame capture loop
The animated renderer SHALL accept an optional `ElementHandle` parameter alongside `page` and `RenderOptions`. When the `ElementHandle` is provided, it SHALL call `element.screenshot({ type: 'png' })` per frame instead of `page.screenshot({ type: 'png' })`. The `ElementHandle` bounding box SHALL be computed once before the loop begins. The rest of the loop behaviour (clock API, frame count, temp directory cleanup) is unchanged. Before the capture loop begins, it SHALL call `page.clock.install({ time: 0 })` to install a synthetic clock. For each frame, it SHALL call `page.clock.runFor(frameIntervalMs)` to advance the synthetic clock by one frame interval (firing all timers and rAF callbacks in that window), then take a Playwright screenshot. No real-time waiting between frames is permitted. The loop SHALL produce exactly `round(cycleMs / 1000 * fps)` frames (minimum 1).

The animated renderer SHALL also accept an optional `onProgress?: (event: ProgressEvent) => void` parameter. When provided:
- It SHALL emit `{ type: 'frame-progress', current: i+1, total: frameCount }` after each frame is captured (throttled to at most 10 updates per second to avoid excessive terminal redraws)
- It SHALL emit `{ type: 'encode-format', format: options.format }` before encoding begins
- It SHALL emit `{ type: 'encode-progress', pct: number }` events when fluent-ffmpeg emits progress data during encoding

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

### Requirement: FFmpeg GIF encoding
The animated renderer SHALL encode the captured PNG frame sequence into a GIF using a two-pass FFmpeg process. **Pass 1** SHALL run FFmpeg on the frame sequence with the `palettegen` filter to produce a `palette.png` file in the temp directory — this generates a globally-optimal 256-color palette from the entire frame sequence. **Pass 2** SHALL run FFmpeg with the frame sequence and `palette.png` as separate inputs, using `-filter_complex "[0:v][1:v]paletteuse"` to produce the final GIF. The output GIF SHALL loop indefinitely (`-loop 0`). The intermediate `palette.png` SHALL be written to the same temp directory as the frames and cleaned up with them. The frame rate SHALL default to 30fps unless `options.fps` is set.

#### Scenario: GIF buffer is valid
- **WHEN** `render({ format: 'gif', ... })` completes successfully
- **THEN** the output buffer begins with the GIF89a header (`GIF89a`)

#### Scenario: GIF loops at cycle length
- **WHEN** the output GIF is inspected
- **THEN** its total frame duration matches `cycleMs` within ±100ms

#### Scenario: Two-pass produces better color accuracy
- **WHEN** a GIF is encoded from an animation with smooth color gradients
- **THEN** the output GIF uses a palette derived from all frames (not just the first N frames), reducing banding visible in later animation frames

#### Scenario: Palette file cleaned up after encode
- **WHEN** `render({ format: 'gif', ... })` returns (success or failure)
- **THEN** `palette.png` is removed along with all frame files in the temp directory

### Requirement: FFmpeg MP4 encoding
The animated renderer SHALL encode the PNG frame sequence into an H.264 MP4 using `fluent-ffmpeg` with `-pix_fmt yuv420p` for broad compatibility. The frame rate SHALL default to 30fps unless `options.fps` is set.

#### Scenario: MP4 buffer is valid
- **WHEN** `render({ format: 'mp4', ... })` completes successfully
- **THEN** the output buffer is a valid MP4 (begins with `ftyp` box or `moov` atom)

#### Scenario: MP4 encodes at correct fps
- **WHEN** `render({ format: 'mp4', fps: 30, ... })` is called
- **THEN** the encoded MP4 has a frame rate of 30fps

### Requirement: FFmpeg WebM encoding
The animated renderer SHALL encode the PNG frame sequence into a VP9 WebM using `fluent-ffmpeg`. The frame rate SHALL default to 30fps unless `options.fps` is set.

#### Scenario: WebM buffer is valid
- **WHEN** `render({ format: 'webm', ... })` completes successfully
- **THEN** the output buffer is a valid WebM file (begins with EBML header `\x1a\x45\xdf\xa3`)

### Requirement: FFmpeg absent returns ENCODE_FAILED
If the FFmpeg binary cannot be located — either because `ffmpeg-static` returns a falsy path on an unsupported platform, or because the resolved binary is not executable — the animated renderer SHALL return `Result.err({ code: 'ENCODE_FAILED', message: '...', ... })` rather than throwing. The absence of a *system* FFmpeg on `PATH` is NOT an error condition; the bundled binary from `ffmpeg-static` is always preferred.

#### Scenario: Missing bundled binary returns error
- **WHEN** `ffmpeg-static` provides no binary path (unsupported platform)
- **THEN** `render()` returns `{ ok: false, error: { code: 'ENCODE_FAILED', ... } }`

#### Scenario: System FFmpeg absence is not an error
- **WHEN** no `ffmpeg` binary exists on the system `PATH` but `ffmpeg-static` provides a valid path
- **THEN** `render({ format: 'gif', ... })` succeeds using the bundled binary
