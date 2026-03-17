## 1. Package Scaffold

- [x] 1.1 Create `apps/mcp-server/package.json` with name `@pixdom/mcp-server`, deps (`@modelcontextprotocol/sdk`, `@anthropic-ai/sdk`), workspace deps (`@pixdom/core`, `@pixdom/profiles`, `@pixdom/types`), and a `start` script using tsx
- [x] 1.2 Create `apps/mcp-server/tsconfig.json` extending root tsconfig
- [x] 1.3 Create `apps/mcp-server/src/index.ts` — MCP server setup with `StdioServerTransport`, `output/` directory creation on startup, and tool registration

## 2. Shared Utilities

- [x] 2.1 Implement `resolveRenderOptions(params)` helper — resolves profile via `getProfile()`, applies individual flag overrides, returns a `RenderOptions`-compatible object
- [x] 2.2 Implement `writeOutput(buffer: Buffer, format: string, outputDir: string, customPath?: string): Promise<string>` — writes buffer to `output/<uuid>.<format>` (or `customPath`), returns absolute path

## 3. convert_html_to_asset Tool

- [x] 3.1 Define Zod input schema for `convert_html_to_asset` (html, profile, format, width, height, quality, output)
- [x] 3.2 Implement handler: validate input, resolve options, call `render()`, write output, return `CallToolResult` with path and metadata
- [x] 3.3 Wrap handler in try/catch — return `{ isError: true, content: [...] }` on any failure

## 4. generate_and_convert Tool

- [x] 4.1 Load system prompt from `.claude/context/claude-integration.md` at startup; fall back to hardcoded minimal prompt if absent
- [x] 4.2 Define Zod input schema for `generate_and_convert` (prompt, profile, format, width, height, quality, model, output)
- [x] 4.3 Implement HTML generation: call Anthropic API with system prompt + user prompt, extract HTML from response text
- [x] 4.4 Implement handler: validate input, generate HTML, resolve options, call `render()`, write output, return `CallToolResult`
- [x] 4.5 Wrap handler in try/catch — return `{ isError: true, content: [...] }` on any failure

## 5. Verification

- [x] 5.1 Run `tsc --noEmit` in `apps/mcp-server` — zero type errors
- [x] 5.2 Confirm server starts and responds to `tools/list` with both tool names
- [x] 5.3 Confirm `convert_html_to_asset({ html: '<h1>Hi</h1>' })` returns a valid path and the file exists
- [x] 5.4 Confirm a call with missing `html` param returns `isError: true`
