# Layer 5 — Core Rendering Engine
Load ONLY when working on Layer 5 — Core Rendering Engine tasks.

## Goal
Implement the full pipeline: HTML input → Playwright capture → Sharp (static) or FFmpeg (animated) → `RenderOutput`.

## Folder / File Structure to Create

```
packages/core/src/
├── browser.ts         # Playwright browser pool
├── loader.ts          # Resolve RenderInput → HTML string or URL
├── screenshot.ts      # Single-frame PNG capture
├── frame-capture.ts   # Multi-frame capture loop
├── encoder.ts         # fluent-ffmpeg: frames → GIF/MP4/WebM
├── processor.ts       # Sharp: format convert, resize, compress
├── pipeline.ts        # Orchestrator
├── errors.ts          # RenderError type
└── index.ts           # render(input, options): Promise<Result<RenderOutput, RenderError>>
```

## Pipeline Flow

```
RenderInput
  └─ loader.ts → resolvedHtml | url
       └─ browser.ts → Page (viewport set from profile)
            ├── [static] screenshot.ts → PNG Buffer
            │     └─ processor.ts → Sharp → output file
            └── [animated] frame-capture.ts → PNG frames[]
                  └─ encoder.ts → FFmpeg → GIF/MP4/WebM
```

## Key Constraints

- Browser launch: `chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })` for Docker
- Viewport set from `RenderOptions.width/height` or resolved `PlatformProfile`
- Frame capture interval: `1000 / fps` ms, default fps = 30
- FFmpeg input: `png` image sequence via `fluent-ffmpeg` `.addInput(frameGlob)`
- Sharp output quality: jpeg=85, webp=80, png=default (lossless)

## Cleanup Requirements

```typescript
// Always in pipeline.ts:
let browser: Browser | undefined
try {
  browser = await chromium.launch(...)
  // ... render
} finally {
  await browser?.close()
}
// Register at entry point:
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
```

## Hard Rules

- `render()` NEVER throws — all errors returned as `err(RenderError)`
- Temporary frame files written to `os.tmpdir()` — always cleaned up in `finally`
- `loader.ts` validates URLs before fetching — return `err` for non-HTTP(S) schemes
- No direct `fs` calls outside `loader.ts` and `processor.ts`

## Definition of Done

- `render({ type: 'inline', value: '<h1>hi</h1>' }, { format: 'png', outputPath: '...' })` writes valid PNG
- `render(...)` for CSS-animated HTML writes valid GIF
- `browser.close()` called even when render fails mid-pipeline
- `render()` returns `err({ code: 'URL_UNREACHABLE' })` for invalid URLs — does not throw
