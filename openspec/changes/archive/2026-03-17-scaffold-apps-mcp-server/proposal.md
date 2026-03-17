## Why

AI coding agents and Claude Desktop need a structured way to invoke pixdom's rendering pipeline without shelling out to the CLI. An MCP server exposes `convert_html_to_asset` and `generate_and_convert` as typed tools that any MCP-compatible host can call, enabling seamless integration with Claude's tool-use flow.

## What Changes

- New `apps/mcp-server` workspace package running a stdio MCP server via `@modelcontextprotocol/sdk`
- Tool `convert_html_to_asset`: accepts `html`, `profile`, `format`, `width`, `height`, `quality`, `output` params; invokes `render()` from `@pixdom/core`; returns asset path and metadata
- Tool `generate_and_convert`: accepts a plain-text `prompt`; calls the Claude API to generate HTML; passes the HTML to `render()`; returns asset path and metadata
- System prompt for HTML generation loaded from `.claude/context/claude-integration.md`
- All tool handlers catch errors and return MCP error responses — never throw
- Server entry point: `node dist/index.js` (built) or `tsx src/index.ts` (dev)

## Capabilities

### New Capabilities

- `mcp-convert-tool`: The `convert_html_to_asset` tool definition, parameter schema, handler, and MCP error wrapping
- `mcp-generate-tool`: The `generate_and_convert` tool definition, Claude API invocation for HTML generation, and integration with the render pipeline

### Modified Capabilities

## Impact

- New package `apps/mcp-server` — depends on `@pixdom/core`, `@pixdom/profiles`, `@pixdom/types`
- Runtime dependencies: `@modelcontextprotocol/sdk`, `@anthropic-ai/sdk`
- No direct Playwright, Sharp, or FFmpeg imports
- Output files written to `output/` directory relative to server working directory
- Requires `ANTHROPIC_API_KEY` env var for `generate_and_convert` tool
