## Why

`packages/core` is the rendering engine that all consumers (CLI, MCP server) depend on. Without it, the project produces no output. It is the first package to bring together `@pixdom/types`, `@pixdom/detector`, `@pixdom/profiles`, Playwright, Sharp, and FFmpeg into a single cohesive rendering pipeline.

## What Changes

- New `packages/core` workspace package (`@pixdom/core`) exporting a single `render(options: RenderOptions): Promise<Result<Buffer, RenderError>>` function
- Playwright browser is launched and closed per `render()` call, always in a `finally` block
- Input routing: HTML string → `page.setContent`, file path → `page.goto(file://…)`, URL → `page.goto`
- Animation detection via `@pixdom/detector`; routes to static renderer (Sharp) or animated renderer (FFmpeg frame capture)
- Static output: PNG, JPEG, WebP via Sharp screenshot + compression
- Animated output: GIF, MP4, WebM via rAF frame capture loop → FFmpeg encode
- Viewport, quality, timeout, and fps all wired through from `RenderOptions`

## Capabilities

### New Capabilities

- `render-pipeline`: The top-level `render()` function, input routing, browser lifecycle, and `Result` return type
- `static-renderer`: Sharp-based screenshot capture for PNG/JPEG/WebP output
- `animated-renderer`: rAF frame capture loop + FFmpeg encode for GIF/MP4/WebM output

### Modified Capabilities

## Impact

- New package `packages/core` consumed by `apps/cli` and `apps/mcp-server`
- Runtime dependencies: `playwright`, `sharp`, `fluent-ffmpeg`
- Workspace dependencies: `@pixdom/types`, `@pixdom/detector`
- Peer dependency: none — core owns its own browser instance
- FFmpeg binary must be available on `PATH` (documented prerequisite)
