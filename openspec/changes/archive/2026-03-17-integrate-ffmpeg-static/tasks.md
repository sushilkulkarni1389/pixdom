## 1. Dependency

- [x] 1.1 Add `ffmpeg-static` to `dependencies` in `packages/core/package.json`
- [x] 1.2 Add `@types/ffmpeg-static` to `devDependencies` in `packages/core/package.json`
- [x] 1.3 Run `pnpm install` to link the new dependency

## 2. Binary Configuration

- [x] 2.1 In `packages/core/src/animated-renderer.ts`, import `ffmpegPath` from `ffmpeg-static`
- [x] 2.2 Guard the import: if `ffmpegPath` is truthy, call `ffmpeg.setFfmpegPath(ffmpegPath)`; if falsy, set a module-level flag so encode functions can return `ENCODE_FAILED`
- [x] 2.3 Update `ffmpegEncode()` (or each encode function) to check the flag and throw a descriptive error when the binary is unavailable, so `render()`'s existing catch block returns `ENCODE_FAILED`

## 3. Verification

- [x] 3.1 Run `tsc --noEmit` in `packages/core` — zero type errors
- [x] 3.2 Confirm animated render succeeds without system FFmpeg (or confirm `ffmpegPath` is set from `ffmpeg-static`)
- [x] 3.3 Confirm `tsc --noEmit` passes across all workspace packages (`apps/cli`, `apps/mcp-server`)
