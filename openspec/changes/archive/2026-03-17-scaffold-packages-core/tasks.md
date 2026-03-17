## 1. Package Scaffold

- [x] 1.1 Create `packages/core/package.json` with name `@pixdom/core`, runtime deps (`playwright`, `sharp`, `fluent-ffmpeg`), workspace deps (`@pixdom/types`, `@pixdom/detector`), and ESM+CJS dual exports
- [x] 1.2 Create `packages/core/tsconfig.json` extending root tsconfig with `declarationDir` and `outDir`
- [x] 1.3 Create `packages/core/src/index.ts` exporting `render` and `RenderError`

## 2. Types and Error Definitions

- [x] 2.1 Define `RenderError` type: `{ code: RenderErrorCode; message: string; cause?: unknown }` where `RenderErrorCode` is a string union of all valid error codes
- [x] 2.2 Define `RenderErrorCode` string union: `'BROWSER_LAUNCH_FAILED' | 'PAGE_LOAD_FAILED' | 'CAPTURE_FAILED' | 'ENCODE_FAILED' | 'NO_ANIMATION_DETECTED'`

## 3. Input Routing

- [x] 3.1 Implement `loadPage(page: Page, input: RenderInput): Promise<void>` — routes `html` → `setContent`, `file` → `goto('file://…')`, `url` → `goto(url)`

## 4. Static Renderer

- [x] 4.1 Implement `renderStatic(page: Page, options: RenderOptions): Promise<Buffer>` — takes PNG screenshot via Playwright, encodes to target format+quality via Sharp
- [x] 4.2 Handle `png`, `jpeg`, `webp` format branches in Sharp encode

## 5. Animated Renderer

- [x] 5.1 Implement `captureFrames(page: Page, cycleMs: number, fps: number, outDir: string): Promise<string[]>` — drives rAF loop via `page.evaluate`, takes screenshots for each frame tick, returns sorted frame file paths
- [x] 5.2 Implement `encodeGif(frames: string[], fps: number, cycleMs: number): Promise<Buffer>` using `fluent-ffmpeg`
- [x] 5.3 Implement `encodeMp4(frames: string[], fps: number): Promise<Buffer>` using `fluent-ffmpeg` with H.264 + `-pix_fmt yuv420p`
- [x] 5.4 Implement `encodeWebm(frames: string[], fps: number): Promise<Buffer>` using `fluent-ffmpeg` with VP9
- [x] 5.5 Implement `renderAnimated(page: Page, options: RenderOptions, cycleMs: number): Promise<Buffer>` — creates temp dir, calls `captureFrames`, dispatches to correct encoder, deletes temp dir in `finally`

## 6. render() Orchestration

- [x] 6.1 Implement `render(options: RenderOptions): Promise<Result<Buffer, RenderError>>` — launches Chromium with `--disable-background-timer-throttling` and `--disable-renderer-backgrounding`, applies viewport, loads page, detects animation, dispatches to static or animated renderer
- [x] 6.2 Wrap browser lifecycle in try/finally — `browser.close()` always called
- [x] 6.3 Wrap all external calls in try/catch — return `Result.err(RenderError)` on any failure, never throw

## 7. Verification

- [x] 7.1 Run `tsc --noEmit` in `packages/core` — zero type errors
- [x] 7.2 Confirm `render({ input: { type: 'html', html: '<h1>Hi</h1>' }, format: 'png', viewport: { width: 200, height: 100 }, quality: 90 })` returns a valid PNG buffer with dimensions 200×100
- [x] 7.3 Confirm `render({ input: { type: 'html', html: '...' }, format: 'jpeg', ... })` returns a valid JPEG buffer
- [x] 7.4 Confirm `render({ input: { type: 'url', url: 'invalid://bad' }, format: 'png', ... })` returns `Result.err({ code: 'PAGE_LOAD_FAILED' })`
