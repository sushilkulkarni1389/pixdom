## 1. Types — profileViewport flag

- [x] 1.1 Add `profileViewport?: boolean` to `RenderOptionsSchema` and `RenderOptions` type in `packages/types/src/index.ts`
- [x] 1.2 Rebuild `packages/types` and confirm TypeScript compiles cleanly

## 2. HTML Extraction Helper

- [x] 2.1 Add `robustHtmlExtract(raw: string): string` function in `apps/mcp-server/src/index.ts` (or extract to `apps/mcp-server/src/html-extract.ts`)
- [x] 2.2 Implement step 1: strip markdown fences (opening ` ```html ` / ` ``` ` and closing ` ``` `)
- [x] 2.3 Implement step 2: slice from first `<!DOCTYPE`, `<html`, or `<` boundary
- [x] 2.4 Implement step 3: trim whitespace; return empty string if no `<` found
- [x] 2.5 Add `GENERATE_EMPTY_HTML` to the `howToFixMap` in `mcpErrorFromRenderError` (or as a local constant)

## 3. MCP Handler — generate_and_convert

- [x] 3.1 In the `generate_and_convert` handler, after extracting text from `message.content`, call `robustHtmlExtract()` on the joined string
- [x] 3.2 Check extracted HTML length; if < 50 characters return `mcpError('GENERATE_EMPTY_HTML', ..., 'The model returned no usable HTML — try rephrasing your prompt')`
- [x] 3.3 When `params.profile` is set, add `profileViewport: true` to the `RenderOptions` object passed to `render()`
- [x] 3.4 Confirm `profileViewport` is NOT set when no profile is given (preserves existing auto behaviour)

## 4. Render Pipeline — profileViewport handling

- [x] 4.1 In `packages/core/src/index.ts`, read `options.profileViewport` in the auto-detection block
- [x] 4.2 When `options.profileViewport === true`: call `autoDetectElement()` to get selector for timing, but do NOT assign result to `autoEffectiveSelector` (keep `autoEffectiveSelector` as `undefined` / `options.selector` only)
- [x] 4.3 Confirm that `autoDetectDuration` still receives the detected selector for timing purposes even when `profileViewport` is true
- [x] 4.4 Confirm that explicit `options.selector` still resolves to `elementHandle` regardless of `profileViewport`

## 5. Build and Smoke Test

- [x] 5.1 Rebuild `packages/core` and `apps/mcp-server`
- [x] 5.2 Run `generate_and_convert` with `profile: 'linkedin-post'`, `format: 'gif'`, `auto: true` — verify output is 1200×1200
- [x] 5.3 Run `generate_and_convert` with a prompt that causes the model to return markdown-fenced HTML — verify no fence text appears in the output image
- [x] 5.4 Run `generate_and_convert` without a profile and `auto: true` — verify auto element detection still drives capture (no regression)
