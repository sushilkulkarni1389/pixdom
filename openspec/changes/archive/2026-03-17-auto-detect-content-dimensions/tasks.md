## 1. Types

- [x] 1.1 Make `width` and `height` optional with defaults in `ViewportOptionsSchema` (`z.number().default(1280)` and `z.number().default(720)`)
- [x] 1.2 Add `autoSize: z.boolean().optional()` to `RenderOptionsSchema`

## 2. Core render pipeline

- [x] 2.1 In `packages/core/src/index.ts`, after `loadPage()` succeeds and when `options.autoSize` is true, query `document.documentElement.scrollWidth` and `scrollHeight` via `page.evaluate()`
- [x] 2.2 Compute final dimensions: use queried `scrollWidth` as width only if `options.viewport.width` was not explicitly provided (i.e., equals the default 1280); always use `scrollHeight` for height
- [x] 2.3 Call `page.setViewportSize({ width, height })` with the computed dimensions before delegating to static or animated renderer

## 3. CLI

- [x] 3.1 Add `.option('--auto-size', 'Auto-detect output dimensions from page content')` to the `convert` command
- [x] 3.2 Add `autoSize?: boolean` to the `ConvertOpts` interface
- [x] 3.3 Pass `autoSize: opts.autoSize ?? false` in the `render()` call options

## 4. Verification

- [x] 4.1 Run `pnpm tsc --noEmit` from monorepo root and confirm zero errors
