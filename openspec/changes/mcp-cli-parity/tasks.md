## 1. Validation Module

- [x] 1.1 Create `apps/mcp-server/src/validate-input.ts` with `validateUrl(url, allowLocal)` — returns `{ code, message, howToFix } | null`, performs protocol check (http/https only) and async DNS-based private-IP check (same CIDR logic as CLI)
- [x] 1.2 Add `validateOutputPath(path)` to `apps/mcp-server/src/validate-input.ts` — shell metacharacter check + /dev//proc//sys/ prefix rejection
- [x] 1.3 Add `validateResourceLimits({ width, height, fps, duration })` to `apps/mcp-server/src/validate-input.ts` — enforces max values and 3600-frame cap, returns structured error or null
- [x] 1.4 Add `mcpError(code, message, howToFix)` helper in `apps/mcp-server/src/index.ts` — returns `CallToolResult` with `isError: true` and `{ error: { code, message, howToFix } }` JSON in content text

## 2. Profile List Update

- [x] 2.1 Replace the hard-coded 4-slug enum in both tool schemas with `ProfileIdSchema.options` from `@pixdom/types` — derive the `z.enum()` from the exported schema so it stays in sync automatically
- [x] 2.2 Update both tool description strings to list all canonical slugs and add usage examples (selector, animated output, profile usage)

## 3. convert_html_to_asset — Input Parity

- [x] 3.1 Update `convert_html_to_asset` inputSchema: make `html` optional, add `url`, `file`, `image` as optional strings
- [x] 3.2 Add exactly-one-input enforcement at top of handler (count provided inputs, call `mcpError('INVALID_INPUT', ...)` if count ≠ 1)
- [x] 3.3 Add URL validation path: call `validateUrl(params.url, params.allowLocal)` before `render()`, return structured error on failure
- [x] 3.4 Add file input path: `realpathSync`, call imported `validateFileInput('--file', resolvedPath)` from CLI's `validate-input.ts`, map error to `mcpError`
- [x] 3.5 Add image input path: `realpathSync`, call `validateFileInput('--image', resolvedPath)`, map error to `mcpError`
- [x] 3.6 Update `resolveRenderOptions` (or equivalent) to build correct `RenderInput` discriminated union for each input mode (`{ type: 'html', html }` / `{ type: 'url', url }` / `{ type: 'file', file }` / `{ type: 'image', image }`)

## 4. convert_html_to_asset — Processing Flags

- [x] 4.1 Add `selector`, `auto`, `autoSize`, `fps`, `duration`, `allowLocal` to `convert_html_to_asset` inputSchema with correct types and constraints
- [x] 4.2 Call `validateResourceLimits` with `{ width, height, fps, duration }` at top of handler; return structured error before any I/O
- [x] 4.3 Pass `selector`, `auto`, `autoSize`, `fps`, `duration` through to `RenderOptions` when calling `render()`
- [x] 4.4 Call `validateOutputPath` on `params.output` when provided; return structured error if invalid

## 5. convert_html_to_asset — Structured Errors

- [x] 5.1 Replace all raw-string `{ isError: true, content: [{ text: message }] }` returns with `mcpError(...)` calls
- [x] 5.2 Map `render()` `Result.err` error codes to `mcpError` (pass through `code`, `message`, add `howToFix` strings per error code)
- [x] 5.3 Map catch-all exceptions to `mcpError('INTERNAL_ERROR', ..., 'Check server logs for details')`

## 6. generate_and_convert — Processing Flags & Structured Errors

- [x] 6.1 Add `selector`, `auto`, `fps`, `duration` to `generate_and_convert` inputSchema
- [x] 6.2 Call `validateResourceLimits` at top of handler before Claude API call; return structured error if invalid
- [x] 6.3 Call `validateOutputPath` on `params.output` when provided
- [x] 6.4 Pass `selector`, `auto`, `fps`, `duration` through to `RenderOptions` when calling `render()` after HTML generation
- [x] 6.5 Replace all raw-string error returns with `mcpError(...)` calls (API key missing, API error, render error, catch-all)

## 7. Build & Verify

- [x] 7.1 Run `pnpm build` in `apps/mcp-server` — fix any TypeScript errors
- [x] 7.2 Smoke-test `convert_html_to_asset` with `html` input (regression check)
- [x] 7.3 Smoke-test `convert_html_to_asset` with `url: 'https://example.com'` — verify output file produced
- [x] 7.4 Smoke-test `convert_html_to_asset` with `url: 'http://192.168.1.1'` — verify structured error returned with `INVALID_URL_HOST`
- [x] 7.5 Smoke-test zero-input call — verify structured error with `INVALID_INPUT`
- [x] 7.6 Verify `tools/list` response includes all new fields for both tools
