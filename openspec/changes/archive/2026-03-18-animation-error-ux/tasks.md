## 1. Types — new error codes and hints field

- [x] 1.1 Add `'INVALID_FILE_TYPE' | 'FILE_NOT_FOUND' | 'IMAGE_NOT_FOUND' | 'SHARP_ERROR'` to `RenderErrorCode` union in `packages/core/src/errors.ts`
- [x] 1.2 Add `hints?: string[]` optional field to the `RenderError` interface in `packages/core/src/errors.ts`
- [x] 1.3 Update `makeError()` signature to accept optional `hints?: string[]` fourth parameter and include it in the returned object when provided
- [x] 1.4 Run `pnpm --filter @pixdom/types build` and `pnpm --filter @pixdom/core build` to confirm no TypeScript errors

## 2. Core — animation cycle hint scanner

- [x] 2.1 Create `packages/core/src/animation-cycle-hint.ts` with exported `scanForCycleLengths(html: string): string[]`
- [x] 2.2 Implement CSS `animation-duration` regex pass (matches `animation-duration: 1.5s`, `animation-duration: 500ms`)
- [x] 2.3 Implement JS variable assignment regex pass (matches `duration: 5000`, `CYCLE = 3000`, `totalDuration = 8`)
- [x] 2.4 Implement rAF comparison regex pass (matches `if (t >= 14)`, `timestamp % 14000`)
- [x] 2.5 Normalise candidates to ms (bare numbers <100 treated as seconds, ≥100 treated as ms); deduplicate; return top 3
- [x] 2.6 In `packages/core/src/animated-renderer.ts` (or `index.ts`), call `scanForCycleLengths(await page.content())` before returning `NO_ANIMATION_DETECTED`; pass result as `hints` to `makeError()`

## 3. Core — FILE_NOT_FOUND for missing file inputs

- [x] 3.1 In `packages/core/src/index.ts`, before launching the browser, check if `options.input.type === 'file'` and `!fs.existsSync(options.input.path)` — return `FILE_NOT_FOUND` without browser launch

## 4. Image passthrough renderer — IMAGE_NOT_FOUND and SHARP_ERROR

- [x] 4.1 In `packages/core/src/image-renderer.ts`, check file existence before passing to Sharp — return `IMAGE_NOT_FOUND` if missing
- [x] 4.2 Change the catch block in `renderImage()` to return `SHARP_ERROR` instead of `CAPTURE_FAILED`

## 5. CLI — error formatter

- [x] 5.1 Create `apps/cli/src/error-formatter.ts` with `formatError(error: RenderError, opts: { argv: string[], color: boolean }): string`
- [x] 5.2 Define message template registry: one entry per error code with `title`, `whatHappened`, `howToFix`, `docs`, and optional `correction` descriptor
- [x] 5.3 Implement `NO_ANIMATION_DETECTED` template — includes `Hint:` lines from `error.hints`
- [x] 5.4 Implement `SELECTOR_NOT_FOUND` template — interpolates selector value from `error.message`
- [x] 5.5 Implement `INVALID_FILE_TYPE`, `FILE_NOT_FOUND`, `IMAGE_NOT_FOUND` templates — interpolate filename from message
- [x] 5.6 Implement `BROWSER_LAUNCH_FAILED`, `PAGE_LOAD_FAILED`, `CAPTURE_FAILED`, `ENCODE_FAILED` templates
- [x] 5.7 Implement `SHARP_ERROR` template with `Detail:` block appending raw message
- [x] 5.8 Implement generic fallback template for unknown codes — shows code, raw message, directs to bug report
- [x] 5.9 Implement argv reconstruction: for codes with a `correction` descriptor, splice in the corrected flag to produce the `Example:` line
- [x] 5.10 Implement ANSI color helper: `red()`, `bold()`, `dim()` that are no-ops when `color: false`

## 6. CLI — file type and existence validation

- [x] 6.1 Create `apps/cli/src/validate-input.ts` with `validateFileInput(flag: '--file' | '--image', resolvedPath: string): { code: RenderErrorCode, message: string } | null`
- [x] 6.2 Implement existence check (using `fs.accessSync` or `fs.statSync`) — return `FILE_NOT_FOUND` / `IMAGE_NOT_FOUND` if missing
- [x] 6.3 Implement extension check for `--file` (`.html`, `.htm`) and `--image` (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`) — return `INVALID_FILE_TYPE` on mismatch
- [x] 6.4 Implement MIME sniff fallback: read first 16 bytes, apply byte-pattern matching for HTML (`<!`, `<h`), PNG (`\x89PNG`), JPEG (`\xFF\xD8`), WebP (`RIFF`+`WEBP`), GIF (`GIF8`)
- [x] 6.5 Call `validateFileInput()` in `convertAction()` after building the `input` object and before calling `render()`

## 7. CLI — wiring: argv capture, --no-color, structured errors

- [x] 7.1 Capture `const originalArgv = process.argv.slice(2)` before `program.parse()` in `apps/cli/src/index.ts`
- [x] 7.2 Add `--no-color` as a global option on the root `program` object with description
- [x] 7.3 Compute `const color = !opts.noColor && process.env.NO_COLOR === undefined && !!process.stderr.isTTY` (or equivalent) and pass to formatter
- [x] 7.4 Replace the existing `process.stderr.write(\`Error: ${result.error.message} (code: ${result.error.code})\n\`)` in `convertAction()` with `process.stderr.write(formatError(result.error, { argv: originalArgv, color }) + '\n')`

## 8. Verification

- [x] 8.1 Run `pnpm --filter @pixdom/core build` — confirm no TypeScript errors
- [x] 8.2 Run `pnpm --filter pixdom build` — confirm no TypeScript errors
- [x] 8.3 Smoke-test `NO_ANIMATION_DETECTED`: `pixdom convert --html "<div></div>" --format gif` — stderr shows structured output with `What happened:`, `How to fix:`
- [x] 8.4 Smoke-test cycle hint: comment-embedded `animation-duration: 2s` in source triggers `Hint:` line mentioning `2000`
- [x] 8.5 Smoke-test `INVALID_FILE_TYPE`: `pixdom convert --file /tmp/report.pdf` — stderr shows structured `INVALID_FILE_TYPE` error
- [x] 8.6 Smoke-test `FILE_NOT_FOUND`: `pixdom convert --file /nonexistent.html` — stderr shows `FILE_NOT_FOUND` structured error
- [x] 8.7 Smoke-test `--no-color`: zero ANSI escape sequences in stderr output
- [x] 8.8 Smoke-test `SELECTOR_NOT_FOUND` message interpolation: stderr `What happened:` line contains `#missing`
