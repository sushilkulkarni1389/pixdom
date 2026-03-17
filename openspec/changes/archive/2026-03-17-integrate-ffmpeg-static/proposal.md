## Why

End users of `pixdom` (CLI and MCP server) currently need a system-installed FFmpeg on their `PATH` for animated output to work — a significant setup burden that makes the tool unreliable across environments. Bundling `ffmpeg-static` as a dependency of `@pixdom/core` removes this requirement and makes animated rendering work out of the box.

## What Changes

- Add `ffmpeg-static` as a dependency of `packages/core`
- Configure `fluent-ffmpeg` to use the bundled binary path at startup via `ffmpeg.setFfmpegPath()`
- Remove the system FFmpeg requirement from the animated renderer
- Update the `ENCODE_FAILED` fallback requirement: error no longer triggered by missing system FFmpeg, but still applies for `ffmpeg-static` resolution failures

## Capabilities

### New Capabilities

- `ffmpeg-bundling`: The mechanism by which `@pixdom/core` locates and configures the `ffmpeg-static` binary at module load time, including the fallback error path if the binary is missing or not executable.

### Modified Capabilities

- `animated-renderer`: Requirement "FFmpeg absent returns ENCODE_FAILED" changes — the absence of a *system* FFmpeg is no longer an error condition; the bundled binary is used instead. The error case now covers failure to resolve the `ffmpeg-static` path.

## Impact

- `packages/core` gains a new dependency: `ffmpeg-static` (and `@types/ffmpeg-static` for dev)
- No changes to `packages/core`'s public API (`render()` signature unchanged)
- No changes to `apps/cli` or `apps/mcp-server`
- Increases the installed size of `@pixdom/core` by ~50–70MB (FFmpeg binary per platform)
- Animated output (GIF, MP4, WebM) works without any user-side FFmpeg installation
