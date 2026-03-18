# ffmpeg-spawn — requirements

### Requirement: Direct FFmpeg spawn replacing fluent-ffmpeg
`packages/core` animated renderer SHALL invoke FFmpeg using `child_process.spawn()` with an explicit string-array argument list. The `fluent-ffmpeg` package SHALL be removed as a dependency. The `ffmpeg-static` package SHALL be updated to v5.3.0. No shell interpretation (`{ shell: true }`) SHALL be used in any FFmpeg spawn call.

#### Scenario: GIF encoding produces valid output
- **WHEN** `renderAnimated()` is called with `format: 'gif'` after fluent-ffmpeg removal
- **THEN** a valid GIF buffer is returned with the same frame count as the captured frames

#### Scenario: MP4 encoding produces valid output
- **WHEN** `renderAnimated()` is called with `format: 'mp4'`
- **THEN** a valid MP4 buffer is returned playable at the expected frame rate

#### Scenario: WebM encoding produces valid output
- **WHEN** `renderAnimated()` is called with `format: 'webm'`
- **THEN** a valid WebM buffer is returned

#### Scenario: No shell spawning
- **WHEN** the animated renderer's FFmpeg spawn calls are statically inspected
- **THEN** no `spawn` call includes `{ shell: true }` in its options

### Requirement: FFmpeg binary resolved from ffmpeg-static package
The animated renderer SHALL obtain the FFmpeg binary path exclusively from `ffmpeg-static` and SHALL NOT fall back to searching `PATH`. If `ffmpeg-static` returns `null`, the render SHALL fail immediately with a clear error message before attempting any spawn.

#### Scenario: ffmpeg-static null causes early failure
- **WHEN** `ffmpeg-static` returns `null` (unsupported platform)
- **THEN** `renderAnimated()` throws with a message indicating FFmpeg is unavailable on this platform

#### Scenario: Binary path is from package, not PATH
- **WHEN** a malicious `ffmpeg` binary is placed earlier in PATH
- **THEN** the animated renderer still uses the `ffmpeg-static` binary path, not the PATH-discovered one

### Requirement: GIF two-pass encoding via spawn
Two-pass GIF encoding SHALL be reimplemented using two sequential `child_process.spawn()` calls:
- Pass 1: palette generation (`-vf palettegen`)
- Pass 2: GIF encoding using the generated palette (`-filter_complex [0:v][1:v]paletteuse`)
Both passes SHALL use explicit argument arrays. The palette file SHALL be written to the same temp directory as the frame files.

#### Scenario: Two-pass GIF palette file written to temp dir
- **WHEN** GIF encoding runs
- **THEN** a `palette.png` file is written inside the same `os.tmpdir()/pixdom-<uuid>/` directory as the frame PNGs

#### Scenario: Palette cleaned up with temp dir
- **WHEN** `renderAnimated()` completes (success or failure)
- **THEN** the palette file is deleted as part of the temp directory cleanup

### Requirement: FFmpeg progress parsing from stderr
The `spawnFfmpeg` helper SHALL read FFmpeg's stderr line by line and parse progress information from lines matching `frame=\s*(\d+)`. When the total expected frame count is known, the helper SHALL compute a percentage and emit `encode-progress` events. Percent values SHALL be clamped to 100.

#### Scenario: encode-progress events emitted during spawn-based encode
- **WHEN** `renderAnimated()` is called with `onProgress` and FFmpeg emits frame progress on stderr
- **THEN** `onProgress` receives `encode-progress` events with `pct` between 0 and 100

#### Scenario: FFmpeg stderr does not produce pct > 100
- **WHEN** FFmpeg reports a frame count exceeding the expected total
- **THEN** the `encode-progress` event has `pct` clamped to 100
