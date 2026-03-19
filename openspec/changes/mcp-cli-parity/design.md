## Context

The MCP server (`apps/mcp-server/src/index.ts`) currently hard-codes `html` as the only input mode and omits all processing flags (`selector`, `auto`, `autoSize`, `fps`, `duration`, `allowLocal`). Security validations (URL host checking, output path sanitisation, file type sniffing) live in the CLI's `index.ts` and `validate-input.ts` — not shared with the MCP server. Error responses are raw strings, so Claude Code has no structured way to surface `howToFix` guidance to the user.

## Goals / Non-Goals

**Goals:**
- Accept `html | url | file | image` inputs in both MCP tools (exactly one required)
- Expose all CLI processing flags in both MCP tools
- Apply identical security validation to MCP inputs (URL host/protocol, file paths, output path, resource limits)
- Return structured `{ error: { code, message, howToFix } }` on all error paths
- List all canonical profile slugs in tool descriptions

**Non-Goals:**
- Changing the render pipeline or core render logic
- Adding new security rules beyond what the CLI enforces
- Supporting stdin input in MCP context
- Progress reporting / streaming in MCP responses

## Decisions

### D1 — Inline validation in `apps/mcp-server/src/validate-input.ts`

The CLI's URL and output-path validators are embedded in `index.ts` alongside Commander logic and `process.exit()` calls — not importable as-is. Rather than moving them to a shared package (which changes two packages and may break the CLI build), duplicate the validation functions into a new `apps/mcp-server/src/validate-input.ts`. The functions accept parameters and return `{ code, message }` objects instead of calling `process.exit()`.

The CLI's `validate-input.ts` `validateFileInput` function can be imported directly (no Commander dependency).

**Alternative considered**: Move validators to `@pixdom/core` or a new `@pixdom/security` package. Rejected for this change — it's a larger refactor and the duplication is contained to one file.

### D2 — Exactly-one-input enforced at runtime, not via JSON Schema `oneOf`

JSON Schema `oneOf` is awkward with Zod and produces poor MCP error messages. Instead, declare all four inputs as `z.string().optional()` and add an explicit check at the top of each handler:

```ts
const inputs = [params.html, params.url, params.file, params.image].filter(Boolean);
if (inputs.length !== 1) {
  return structuredError('INVALID_INPUT', 'Exactly one of html/url/file/image must be provided.', '...');
}
```

This gives a clear, actionable error message.

### D3 — Structured error helper wraps the existing `isError` shape

All error returns become:

```ts
function mcpError(code: string, message: string, howToFix: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify({ error: { code, message, howToFix } }) }],
  };
}
```

Existing success responses stay as plain JSON strings. This preserves backward compatibility for callers that look for `isError: false`.

### D4 — Profile enum sourced from `ProfileIdSchema` in `@pixdom/types`

The current code hard-codes four profile slugs. Replace with `ProfileIdSchema.options` so that the full canonical list (all 22 slugs + aliases) stays in sync with the types package automatically. The tool description string is generated from the same list.

### D5 — `resolveRenderOptions` extended to handle all input modes

The existing helper is extended to accept the new `input` field and build the correct `RenderInput` discriminated union:

```ts
type InputMode = { html: string } | { url: string } | { file: string } | { image: string };
```

The `url` path performs async DNS validation before passing to `render()`. The `file` and `image` paths call `realpathSync` + `validateFileInput` before use.

## Risks / Trade-offs

- **DNS lookup in handler**: URL validation does a DNS lookup to check for private IPs. This adds latency (~50–200 ms for a cold DNS query). Acceptable since render itself is much slower. [Risk]: DNS timeout causes handler hang → Mitigation: wrap with `Promise.race` against a 5 s timeout.
- **Validation duplication**: URL and output-path logic is duplicated between CLI and MCP. [Risk]: divergence over time → Mitigation: comment in both files pointing to the other; future refactor to shared package is clean from either side.
- **Breaking schema change**: `html` moves from required to optional. Any caller that introspects the tool schema (not just calls it with `html`) will see a different shape. [Risk]: low in practice — Claude Code re-reads tool schemas on each session.
- **`allowLocal` in MCP context**: Exposing `allowLocal` in MCP means Claude Code could be prompted to set it. Print a warning to stderr (same as CLI) but do not block.
