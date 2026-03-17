## Why

All current input types (`html`, `file`, `url`) go through a full Playwright browser launch and page render before any image processing. When the input is already a raster image (JPEG, PNG, WebP, etc.), this is pure overhead — a 30× speed penalty and ~200MB RAM spike to launch Chromium just to take a screenshot of an image that Sharp could have processed directly. Adding an `image` input type that bypasses Playwright entirely makes Pixdom useful as a general-purpose image conversion and resize tool.

## What Changes

- Add `{ type: 'image', path: string }` to the `RenderInput` discriminated union in `@pixdom/types`
- In `packages/core/src/index.ts`, detect the `image` input type before the browser launch block and dispatch directly to a new Sharp-based passthrough renderer
- The passthrough renderer reads the source file, applies the requested `format`, `quality`, and viewport resize via Sharp, and returns the buffer — no browser ever opens
- Animated formats (`gif`, `mp4`, `webm`) are **not** supported for image inputs; attempting them SHALL return `Result.err({ code: 'CAPTURE_FAILED' })`
- Expose `--image <path>` flag on the CLI `convert` command

## Capabilities

### New Capabilities

- `image-passthrough-renderer`: Sharp-based renderer for image inputs that bypasses Playwright entirely

### Modified Capabilities

- `render-pipeline`: New `image` input type triggers a separate dispatch path before browser launch
- `cli-convert-command`: New `--image <path>` flag added to `convert` command

## Impact

- `packages/types/src/index.ts` — add `z.object({ type: z.literal('image'), path: z.string() })` to `RenderInputSchema`
- `packages/core/src/index.ts` — detect `input.type === 'image'` before `chromium.launch()` and call new renderer
- `packages/core/src/image-renderer.ts` — new file: Sharp passthrough for resize + format conversion
- `apps/cli/src/index.ts` — add `--image <path>` flag; mutual exclusion with `--html`, `--file`, `--url`
- No new dependencies (`sharp` is already in `packages/core`)
