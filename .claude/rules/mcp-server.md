---
paths:
  - "apps/mcp-server/**/*.ts"
---

# Rules — MCP Server

1. Tool handlers MUST NOT throw — all errors caught and returned as `{ isError: true }`.
2. All tool input schemas MUST be validated with Zod before handler invocation.
3. `ANTHROPIC_API_KEY` MUST be loaded via `env.ts` — never `process.env.ANTHROPIC_API_KEY`.
4. System prompts for `generate_and_convert` MUST have `cache_control: { type: 'ephemeral' }`.
5. Model MUST be `claude-sonnet-4-20250514` — no other model strings in MCP server code.
6. Server MUST use `StdioServerTransport` for v1 local deployment.
7. SIGINT and SIGTERM handlers MUST be registered in `index.ts` to close browser + server.
8. Output files MUST use `env.OUTPUT_DIR` as base — no hardcoded paths.
9. MCP response `content` array MUST always have at least one `{ type: 'text' }` element.
10. Never import directly from `packages/core/src/*` — import from `@html2asset/core`.
