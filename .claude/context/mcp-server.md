# Layer 7 — MCP Server
Load ONLY when working on Layer 7 — MCP Server tasks.

## Goal
MCP server exposing `convert_html_to_asset` and `generate_and_convert` tools with Zod validation and error-safe handlers.

## Folder / File Structure to Create

```
apps/mcp-server/src/
├── tools/
│   ├── convert-html-to-asset.ts   # Tool definition + Zod input schema
│   └── generate-and-convert.ts   # Tool definition + Zod input schema
├── handlers/
│   ├── convert.handler.ts         # Delegates to @html2asset/core
│   └── generate.handler.ts        # Claude API call + render
├── server.ts                      # MCP Server setup + tool registration
└── index.ts                       # Entrypoint + SIGINT/SIGTERM cleanup
```

## Tool: `convert_html_to_asset`

```typescript
// Input schema (Zod):
z.object({
  html: z.string().min(1),
  format: z.enum(['png', 'jpeg', 'webp', 'gif', 'mp4']),
  profile: z.enum(['instagram', 'twitter', 'linkedin', 'square']).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationMs: z.number().positive().optional(),
})
```

## Tool: `generate_and_convert`

```typescript
z.object({
  prompt: z.string().min(1),          // e.g. "Create a launch announcement for my SaaS"
  platform: z.enum(['instagram', 'twitter', 'linkedin', 'square']),
  format: z.enum(['png', 'jpeg', 'gif', 'mp4']),
  style: z.string().optional(),        // e.g. "dark mode, glassmorphism"
})
```

## MCP Response Shape

```typescript
// Success:
{ content: [{ type: 'text', text: `Rendered to: ${outputPath} (${sizeKb}KB)` }] }
// Error:
{ isError: true, content: [{ type: 'text', text: errorMessage }] }
```

## Prompt Caching in `generate.handler.ts`

- System prompt for HTML generation must be ≥ 1024 tokens
- Add `cache_control: { type: 'ephemeral' }` to system message blocks
- Model: `claude-sonnet-4-20250514`

## Hard Rules

- Tool handlers NEVER throw — catch all errors, return `{ isError: true, ... }`
- Server uses `StdioServerTransport` for v1 (local MCP)
- `ANTHROPIC_API_KEY` loaded via `env.ts` — never inline `process.env`
- Output files written to `env.OUTPUT_DIR` — never relative paths

## Definition of Done

- `node dist/index.js` starts server and responds to `tools/list` MCP call
- `convert_html_to_asset` returns file path in content text on success
- Both handlers return `{ isError: true }` on `render()` failure
- `generate_and_convert` calls Anthropic API with prompt caching on system block
- Server registers SIGINT/SIGTERM handlers and closes browser on exit
