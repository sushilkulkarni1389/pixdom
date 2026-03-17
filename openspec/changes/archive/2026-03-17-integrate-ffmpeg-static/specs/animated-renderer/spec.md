## MODIFIED Requirements

### Requirement: FFmpeg absent returns ENCODE_FAILED
If the FFmpeg binary cannot be located — either because `ffmpeg-static` returns a falsy path on an unsupported platform, or because the resolved binary is not executable — the animated renderer SHALL return `Result.err({ code: 'ENCODE_FAILED', message: '...', ... })` rather than throwing. The absence of a *system* FFmpeg on `PATH` is NOT an error condition; the bundled binary from `ffmpeg-static` is always preferred.

#### Scenario: Missing bundled binary returns error
- **WHEN** `ffmpeg-static` provides no binary path (unsupported platform)
- **THEN** `render()` returns `{ ok: false, error: { code: 'ENCODE_FAILED', ... } }`

#### Scenario: System FFmpeg absence is not an error
- **WHEN** no `ffmpeg` binary exists on the system `PATH` but `ffmpeg-static` provides a valid path
- **THEN** `render({ format: 'gif', ... })` succeeds using the bundled binary
