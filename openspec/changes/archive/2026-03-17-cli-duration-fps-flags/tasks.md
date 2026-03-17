## 1. Shared Types

- [x] 1.1 Add `duration: z.number().optional()` to `RenderOptionsSchema` in `packages/types/src/index.ts`

## 2. Core Render Pipeline

- [x] 2.1 In `packages/core/src/index.ts`, replace `const cycleMs = await detectAnimationCycle(page)` with `const cycleMs = options.duration ?? await detectAnimationCycle(page)`

## 3. CLI Flags

- [x] 3.1 Add `.option('--fps <n>', 'Frame rate for animated output (gif/mp4/webm)')` to the `convert` command in `apps/cli/src/index.ts`
- [x] 3.2 Add `.option('--duration <ms>', 'Animation cycle length in ms (overrides auto-detection)')` to the `convert` command
- [x] 3.3 Add `fps?: string` and `duration?: string` to the `ConvertOpts` interface
- [x] 3.4 In `convertAction`, parse and validate `--duration`: if provided, `parseInt` it and error + exit 1 if ≤ 0
- [x] 3.5 Pass `fps: opts.fps ? parseInt(opts.fps, 10) : undefined` and `duration: opts.duration ? parseInt(opts.duration, 10) : undefined` to the `render()` call

## 4. Verification

- [x] 4.1 Run `tsc --noEmit` in `packages/types`, `packages/core`, and `apps/cli` — zero type errors
- [x] 4.2 Confirm `pixdom convert --html "<h1>x</h1>" --format png --fps 24` renders successfully (fps ignored for static, no error)
- [x] 4.3 Confirm `pixdom convert --html "<div>" --format gif --duration 0` exits with code 1 and an error on stderr
