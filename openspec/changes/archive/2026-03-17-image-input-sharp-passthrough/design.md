## Context

The current `render()` flow always opens a Chromium browser, even for inputs that have nothing to render — a raster image already exists and just needs format conversion or resizing. Sharp supports reading JPEG, PNG, WebP, GIF, TIFF, AVIF, and more directly. The bypass path is straightforward: detect `input.type === 'image'` before `chromium.launch()` and hand off to a new `renderImage()` function that uses Sharp end-to-end.

## Goals / Non-Goals

**Goals:**
- Zero browser launch for `image` input type — Sharp reads the file directly
- Support all static output formats: `png`, `jpeg`, `webp`
- Respect `viewport.width` / `viewport.height` as resize target dimensions (Sharp `resize()`)
- Respect `quality` from `RenderOptions`
- Return `Result.err({ code: 'CAPTURE_FAILED' })` for animated output formats (`gif`, `mp4`, `webm`) — image inputs cannot produce animation

**Non-Goals:**
- Reading image data from a URL or inline base64 string (only `path` — file system reads)
- Multi-frame / animated GIF passthrough
- Metadata preservation (EXIF stripping is acceptable)
- Auto-detecting image dimensions to skip resize (callers can omit `width`/`height` with `autoSize`, which is already on `RenderOptions`)

## Decisions

### Dispatch location: before vs after browser launch

**Decision**: Check for `input.type === 'image'` as the very first thing inside `render()`, before `chromium.launch()`. Return early with the Sharp result. The browser is never touched.

Alternative: Launch browser, detect image type inside the page-load path, short-circuit there. Rejected — the browser launch cost is the entire point of this feature.

### New file: `image-renderer.ts`

**Decision**: Implement `renderImage(options: RenderOptions): Promise<Buffer>` in a new `packages/core/src/image-renderer.ts`. This mirrors the pattern of `static-renderer.ts` and `animated-renderer.ts` and keeps `index.ts` as a thin dispatcher.

### Resize behavior

**Decision**: When `viewport.width` and `viewport.height` are set (non-default), use Sharp's `resize(width, height, { fit: 'inside', withoutEnlargement: false })`. The `inside` fit preserves aspect ratio and never crops — this matches user expectation for "resize to fit within N×M". When both are at their defaults (1280×720) and `autoSize` is not set, no resize is applied — the image passes through at its natural dimensions.

Alternative: Always resize to viewport dimensions with `fit: 'fill'` (stretch). Rejected — silently stretching images is destructive and surprising.

### Error for animated formats

**Decision**: Return `Result.err(makeError('CAPTURE_FAILED', 'Image input does not support animated output formats'))` if `format` is `gif`, `mp4`, or `webm`. This is checked inside `renderImage()` before reading the file, keeping the fast path clean.

## Risks / Trade-offs

- **Sharp format detection** → Sharp uses the file's magic bytes, not the extension, so misnamed files are handled correctly.
- **Large images and memory** → Sharp streams internally; this is no worse than today's static renderer which buffers a full-page screenshot.
- **`autoSize` interaction** → When `autoSize: true` and `input.type === 'image'`, the viewport resize logic in `index.ts` runs against a Playwright page that was never opened. Since we return early before browser launch, this is moot — `autoSize` is simply ignored for image inputs (Sharp reads at natural dimensions then resizes to viewport if specified).
