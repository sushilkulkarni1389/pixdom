## 1. Rewrite encodeGif

- [x] 1.1 In `packages/core/src/animated-renderer.ts`, replace the body of `encodeGif()` with a two-pass implementation:
  - Pass 1: call `ffmpegEncode(pattern, fps, palettePath, ['-vf', 'palettegen'])` where `palettePath = frames[0].replace(/frame-\d+\.png$/, 'palette.png')`
  - Pass 2: call `fluent-ffmpeg` directly with two inputs (frame pattern + palette.png) and options `['-loop', '0', '-filter_complex', '[0:v][1:v]paletteuse']` to produce `outPath`
- [x] 1.2 Read the resulting GIF buffer and unlink `outPath` (palette.png cleanup is handled by the `finally` block in `renderAnimated`)
- [x] 1.3 Add `assertFfmpegAvailable()` call at the top of `encodeGif` (it is already there — verify it's still present after the rewrite)

## 2. Verification

- [x] 2.1 Run `pnpm tsc --noEmit` from monorepo root and confirm zero errors
