# animated-renderer — requirements

### Requirement: rAF frame capture loop
The animated renderer SHALL capture frames by injecting a `requestAnimationFrame` loop via `page.evaluate()` that fires for the duration of `cycleMs`. For each frame callback, it SHALL trigger a Playwright screenshot saved to a per-call temp directory. The loop SHALL stop after `cycleMs` milliseconds have elapsed.

#### Scenario: Frame count proportional to cycle length
- **WHEN** the animated renderer captures a 1000ms cycle at 30fps
- **THEN** approximately 30 PNG frames are written to the temp directory (±3 frame tolerance)

#### Scenario: Temp directory cleaned up after render
- **WHEN** `render()` returns (success or failure)
- **THEN** the per-call temp directory and all frame files are deleted

### Requirement: FFmpeg GIF encoding
The animated renderer SHALL encode the captured PNG frame sequence into a GIF using `fluent-ffmpeg`. The output GIF SHALL loop indefinitely (`-loop 0`). The frame rate SHALL default to 30fps unless `options.fps` is set.

#### Scenario: GIF buffer is valid
- **WHEN** `render({ format: 'gif', ... })` completes successfully
- **THEN** the output buffer begins with the GIF89a header (`GIF89a`)

#### Scenario: GIF loops at cycle length
- **WHEN** the output GIF is inspected
- **THEN** its total frame duration matches `cycleMs` within ±100ms

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
If the FFmpeg binary is not found on `PATH`, the animated renderer SHALL return `Result.err({ code: 'ENCODE_FAILED', message: 'FFmpeg not found', ... })` rather than throwing.

#### Scenario: Missing FFmpeg returns error
- **WHEN** `fluent-ffmpeg` cannot locate the FFmpeg binary
- **THEN** `render()` returns `{ ok: false, error: { code: 'ENCODE_FAILED', ... } }`
