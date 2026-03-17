# ffmpeg-bundling — requirements

### Requirement: ffmpeg-static binary configuration
`@pixdom/core` SHALL import the `ffmpeg-static` package to obtain the bundled FFmpeg binary path and configure `fluent-ffmpeg` via `ffmpeg.setFfmpegPath()` before any encode operation. This configuration SHALL occur at module load time, not per-call.

#### Scenario: Bundled binary is used for encoding
- **WHEN** `render({ format: 'gif', ... })` is called on a system without a system FFmpeg on `PATH`
- **THEN** encoding succeeds using the bundled binary and returns a valid buffer

#### Scenario: Bundled binary path is set once at module load
- **WHEN** `animated-renderer.ts` is imported
- **THEN** `ffmpeg.setFfmpegPath()` has been called with the `ffmpeg-static` path before any encode function is invoked

### Requirement: Unsupported platform error handling
If `ffmpeg-static` returns a falsy path (unsupported platform), `@pixdom/core` SHALL NOT call `ffmpeg.setFfmpegPath()` with a falsy value. Any subsequent encode attempt SHALL result in `render()` returning `Result.err({ code: 'ENCODE_FAILED', message: 'FFmpeg binary not available on this platform', ... })`.

#### Scenario: Null ffmpeg-static path returns ENCODE_FAILED
- **WHEN** `ffmpeg-static` resolves to a null or empty path (e.g., unsupported platform)
- **THEN** `render({ format: 'mp4', ... })` returns `{ ok: false, error: { code: 'ENCODE_FAILED', message: '...not available...' } }`

#### Scenario: Server stays alive on missing binary
- **WHEN** the MCP server calls `render()` on a platform where `ffmpeg-static` provides no binary
- **THEN** the tool returns `{ isError: true }` and the server process remains running
