## Context

`packages/core` is the most complex package in the monorepo. It orchestrates three external runtimes (Playwright browser, Sharp image processor, FFmpeg encoder) and two sibling packages (`@pixdom/types`, `@pixdom/detector`). The key constraint from the existing spec is that the browser instance must always be closed in a `finally` block and frame capture must use `requestAnimationFrame`, not fixed-interval polling.

## Goals / Non-Goals

**Goals:**
- Single exported function `render(options: RenderOptions): Promise<Result<Buffer, RenderError>>`
- Browser lifecycle owned entirely by `render()` — launch + close in a `finally` block
- Input routing for all three `RenderInput` variants (html / file / url)
- Static path: Playwright screenshot → Sharp encode → Buffer
- Animated path: rAF frame capture loop → temp PNG frames → FFmpeg encode → Buffer
- All errors represented as `Result<Buffer, RenderError>` with a `code` string field

**Non-Goals:**
- Profile lookup (caller resolves a `Profile` and passes `RenderOptions` — `core` doesn't know about profiles)
- Caching, queuing, or concurrency management
- CLI argument parsing or MCP tool wiring
- Streaming output or partial results
- WebP animation (treat as static WebP for v1)

## Decisions

### 1. One browser per `render()` call
**Decision**: `chromium.launch()` and `browser.close()` wrap every call in try/finally.
**Rationale**: Matches the spec constraint and simplifies error recovery — no leaked browser processes. Alternative: shared browser pool — better throughput but adds lifecycle complexity out of scope for v1.

### 2. Static path delegates screenshot to Playwright, format/quality to Sharp
**Decision**: Use `page.screenshot({ type: 'png' })` always, then pass the PNG buffer through Sharp for format conversion and quality control.
**Rationale**: Playwright's native screenshot can produce PNG/JPEG/WebP but quality options are limited and inconsistent across formats. Sharp gives precise control over compression, quality, and format. Uniform "always PNG from Playwright, Sharp for everything else" is simpler to reason about.

### 3. Animated path: rAF frame capture → temp dir → FFmpeg
**Decision**: Inject a `requestAnimationFrame` loop via `page.evaluate()` that resolves after `cycleMs` worth of frames. For each frame, take a Playwright screenshot into a temp directory. Pass the frame sequence to `fluent-ffmpeg` for encoding.
**Rationale**: rAF capture is frame-accurate and honours the spec constraint. Alternatives: fixed-interval `setInterval` screenshots — violates spec, drops/duplicates frames at non-60fps refresh rates.

### 4. `fluent-ffmpeg` for FFmpeg wrapping
**Decision**: Use `fluent-ffmpeg` as the FFmpeg API layer.
**Rationale**: Mature, widely used, handles input/output file chains cleanly. Alternative: spawn FFmpeg directly via `child_process` — more control, much more boilerplate for frame-sequence → video encoding.

### 5. Temp directory per render call, cleaned up in `finally`
**Decision**: Create a per-call temp dir for frame PNGs; delete in `finally` alongside `browser.close()`.
**Rationale**: Prevents frame leakage between concurrent calls. Node's `os.tmpdir()` + a UUID subfolder is sufficient for v1.

### 6. `RenderError` shape: `{ code: string; message: string; cause?: unknown }`
**Decision**: All errors returned (not thrown) as `Result<Buffer, RenderError>` where `code` is one of: `'BROWSER_LAUNCH_FAILED'`, `'PAGE_LOAD_FAILED'`, `'CAPTURE_FAILED'`, `'ENCODE_FAILED'`.
**Rationale**: Consumers can switch on `code` without parsing messages. `cause` preserves the original error for logging.

## Risks / Trade-offs

- **FFmpeg binary must be on PATH** → `render()` will return `ENCODE_FAILED` if FFmpeg is absent. Mitigation: documented in package README; animated formats checked at call time with a clear error code.
- **Memory spike during frame capture** → 30fps × 1s × 1080×1080 PNG ≈ ~100MB of raw frame data. Mitigation: frames are written to disk, not held in memory simultaneously.
- **Playwright Chromium download size** → ~150MB. Mitigation: `playwright` is a direct dependency of `core`, so `pnpm install` in the monorepo triggers the download once.
- **rAF loop in headless Chromium** → headless Chrome throttles rAF; must launch with `--disable-background-timer-throttling` and `--disable-renderer-backgrounding`. Mitigation: set in `chromium.launch({ args: [...] })`.
