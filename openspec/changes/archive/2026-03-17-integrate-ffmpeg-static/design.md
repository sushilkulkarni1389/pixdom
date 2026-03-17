## Context

`packages/core` currently calls `fluent-ffmpeg` without configuring a binary path, so it falls through to whatever `ffmpeg` is on the user's system `PATH`. This works in development environments where FFmpeg is installed, but breaks for end users (e.g., after `npm install @pixdom/core`) who have not installed FFmpeg separately. The `ffmpeg-static` npm package ships pre-compiled FFmpeg binaries for macOS, Linux, and Windows x64 as a native npm package, making it trivially available via a single dependency declaration.

## Goals / Non-Goals

**Goals:**
- Animated output (GIF/MP4/WebM) works after a plain `pnpm install` with no additional system configuration
- Binary path is set once at module load; no per-call overhead
- Graceful error if `ffmpeg-static` somehow fails to provide a path (returns `ENCODE_FAILED`, never throws)

**Non-Goals:**
- Supporting custom user-supplied FFmpeg paths (no override mechanism in v1)
- Bundling FFmpeg for platforms unsupported by `ffmpeg-static` (arm64 Linux, etc. — those are `ffmpeg-static`'s concern)
- Reducing bundle size; the ~60MB binary is accepted as a trade-off

## Decisions

### 1. Set path via `ffmpeg.setFfmpegPath()` at module load in `animated-renderer.ts`
**Decision**: Import `ffmpegPath` from `ffmpeg-static` and call `ffmpeg.setFfmpegPath(ffmpegPath)` at the top of `animated-renderer.ts` before any encode calls.
**Rationale**: `fluent-ffmpeg`'s `setFfmpegPath()` is the canonical configuration point. Setting it at module load (not per-call) means it's set once and applies to all `ffmpeg()` instances. Alternative: set it in `packages/core/src/index.ts` — worse separation of concerns, forces `index.ts` to know about the FFmpeg binary.

### 2. Guard against null/undefined path from `ffmpeg-static`
**Decision**: Check that `ffmpegPath` is truthy before calling `setFfmpegPath()`; if falsy, encode functions should throw so the `ENCODE_FAILED` catch in `render()` is triggered.
**Rationale**: `ffmpeg-static` returns `null` on unsupported platforms. Without a guard, `fluent-ffmpeg` would attempt to spawn a `null` path and emit a confusing error. A clear `ENCODE_FAILED` result with a descriptive message is far better UX.

### 3. `ffmpeg-static` as a runtime dependency, `@types/ffmpeg-static` as dev
**Decision**: Add `ffmpeg-static` to `dependencies` (not `devDependencies`) in `packages/core/package.json`.
**Rationale**: The binary is required at runtime by `apps/cli` and `apps/mcp-server` users. Dev-only would mean it's absent in production installs.

## Risks / Trade-offs

- **Platform support gap** — `ffmpeg-static` doesn't ship binaries for all platforms (e.g., Linux arm64). On those platforms `ffmpegPath` is `null`, and `render()` returns `ENCODE_FAILED`. Mitigation: clear error message; users on unsupported platforms can install system FFmpeg and the old behavior still applies since `fluent-ffmpeg` falls back to `PATH` when `setFfmpegPath` is not called — but with our guard, we explicitly fail fast with a useful message instead.
- **Bundle size** — ~60MB per platform is significant for a library. Mitigation: accepted in v1; optional peer dep approach is a v2 concern.
- **`ffmpeg-static` version pinning** — The package pins to a specific FFmpeg release. Mitigation: acceptable for v1; can update the dep as needed.
