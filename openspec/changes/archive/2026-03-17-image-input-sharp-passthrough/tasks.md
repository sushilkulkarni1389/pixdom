## 1. Types

- [x] 1.1 In `packages/types/src/index.ts`, add `z.object({ type: z.literal('image'), path: z.string() })` to the `RenderInputSchema` discriminated union

## 2. Image renderer

- [x] 2.1 Create `packages/core/src/image-renderer.ts` with an exported `renderImage(options: RenderOptions): Promise<Buffer>` function
- [x] 2.2 In `renderImage`, return `Result.err`-style throw (or re-throw for caller wrapping) if `format` is `gif`, `mp4`, or `webm`
- [x] 2.3 Implement Sharp pipeline: `sharp(input.path)` → conditionally `.resize(width, height, { fit: 'inside' })` when viewport differs from defaults → encode to requested format with quality

## 3. Render pipeline dispatch

- [x] 3.1 In `packages/core/src/index.ts`, add an early-return block at the top of `render()` (before `chromium.launch()`): if `options.input.type === 'image'`, call `renderImage(options)` wrapped in try/catch returning `ok(buffer)` or `err(makeError('CAPTURE_FAILED', ...))`

## 4. CLI

- [x] 4.1 In `apps/cli/src/index.ts`, add `.option('--image <path>', 'Local image file to convert (bypasses browser)')` to the `convert` command
- [x] 4.2 Add `image?: string` to the `ConvertOpts` interface
- [x] 4.3 Include `opts.image` in the `inputFlags` mutex check and build `input = { type: 'image', path: path.resolve(opts.image) }` in the input routing block

## 5. Verification

- [x] 5.1 Run `pnpm tsc --noEmit` from monorepo root and confirm zero errors
