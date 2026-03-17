## Context

`apps/mcp-server` sits at the same level as `apps/cli` in the dependency graph: it consumes `@pixdom/core` and `@pixdom/profiles` but has no direct knowledge of Playwright, Sharp, or FFmpeg. It also adds a new vertical — calling the Claude API to generate HTML from a prompt — which `apps/cli` does not have. The MCP SDK handles the stdio transport and JSON-RPC framing; the server code only needs to register tools and implement handlers.

The existing spec (`openspec/specs/mcp-server.md`) defines two tools. This change makes those tools concrete.

## Goals / Non-Goals

**Goals:**
- stdio MCP server using `@modelcontextprotocol/sdk`
- Two tools: `convert_html_to_asset` and `generate_and_convert`
- Zod-validated input parameters for both tools (reuse schemas from `@pixdom/types` where possible)
- All handler errors caught and returned as MCP `CallToolResult` with `isError: true`
- Output files written to `output/` directory; path returned in tool result
- `generate_and_convert` uses `@anthropic-ai/sdk` with system prompt from `.claude/context/claude-integration.md`

**Non-Goals:**
- HTTP or SSE transport (stdio only for v1)
- Tool call streaming or partial results
- Authentication or rate limiting
- Caching rendered outputs
- MCP resources or prompts (tools only)

## Decisions

### 1. `@modelcontextprotocol/sdk` Server class
**Decision**: Use the official MCP TypeScript SDK's `Server` class with `StdioServerTransport`.
**Rationale**: Handles JSON-RPC framing, capability negotiation, and `tools/list` automatically. Alternative: raw stdin/stdout JSON-RPC — significant boilerplate for no benefit.

### 2. Zod schemas for tool parameter validation
**Decision**: Define each tool's input shape as a Zod schema; parse in the handler before calling `render()`.
**Rationale**: Consistent with `@pixdom/types` approach. Catches malformed inputs before they reach the renderer, enabling clean error messages in the MCP response. Alternative: rely on MCP SDK's JSON Schema — less type-safe, no runtime parsing.

### 3. Output directory `output/` relative to `process.cwd()`
**Decision**: Write rendered files to `./output/<uuid>.<format>` and return the absolute path in the tool result.
**Rationale**: Matches the spec constraint ("no direct file system writes outside of output/"). MCP hosts running the server from a project root get a predictable output location.

### 4. `generate_and_convert` system prompt from file
**Decision**: Load `.claude/context/claude-integration.md` at server startup (not per-call). If the file is absent, fall back to a hardcoded minimal prompt.
**Rationale**: Matches spec constraint and allows the prompt to be iterated without redeploying code. At-startup load avoids per-request I/O.

### 5. Claude `claude-haiku-4-5-20251001` for HTML generation
**Decision**: Default to `claude-haiku-4-5-20251001` for the generate step (fast, cheap, capable of HTML generation).
**Rationale**: Haiku is sufficient for structured HTML output. The model can be overridden via a `model` parameter in `generate_and_convert` for callers that want higher fidelity.

### 6. Tool result shape
**Decision**: Successful results return `[{ type: 'text', text: JSON.stringify({ path, format, width, height }) }]`. Error results return `[{ type: 'text', text: errorMessage }]` with `isError: true`.
**Rationale**: MCP content arrays allow structured data via text JSON. Consistent shape makes it easy for callers to parse the result.

## Risks / Trade-offs

- **`ANTHROPIC_API_KEY` required for `generate_and_convert`** → Server starts without it but the tool returns an error at call time. Mitigation: clear error message in the MCP response.
- **Output directory not auto-created** → Server must create `output/` on startup or per-call. Mitigation: `fs.mkdir(outputDir, { recursive: true })` on startup.
- **Large rendered buffers in memory** → Buffer is held until written to disk. For animated formats this could be 50–200MB. Mitigation: acceptable for v1; streaming write is a v2 concern.
