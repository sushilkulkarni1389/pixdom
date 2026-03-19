## Why

The MCP `convert_html_to_asset` tool only accepts inline HTML strings and a narrow set of output options, while the CLI supports URL, file, and image inputs plus processing flags like `selector`, `auto`, `fps`, and `duration`. This creates a two-tier experience where Claude Code users must work around limitations (e.g. manually fetching URLs) that CLI users don't face, and powerful rendering features are completely inaccessible via MCP.

## What Changes

- **MCP convert tool** gains four mutually exclusive input modes: `html`, `url`, `file`, `image` (exactly one required)
- **MCP convert tool** gains processing flags: `selector`, `auto`, `autoSize`, `fps`, `duration`, `allowLocal`
- **MCP generate tool** gains all output and processing options it currently lacks: `profile`, `selector`, `auto`, `fps`, `duration`
- **Both tools** apply the same security validations the CLI uses (`validate-input.ts`): URL protocol/host checks, file path sanitisation, output path checks, resource limit enforcement
- **Both tools** return structured errors `{ error: { code, message, howToFix } }` instead of raw strings, so Claude Code can surface actionable guidance
- **Tool descriptions** are updated to list all 22 canonical profile slugs and include usage examples

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `mcp-convert-tool`: Add url/file/image input modes, selector/auto/autoSize/fps/duration/allowLocal processing flags, structured error responses, updated tool description with examples
- `mcp-generate-tool`: Add profile, selector, auto, fps, duration, output options; structured error responses; updated tool description

## Impact

- `apps/mcp-server/src/index.ts` — primary change: tool schema and handler rewrites for both tools
- `packages/core/src/validate-input.ts` (or equivalent) — imported and reused in MCP handlers; no logic changes
- MCP tool JSON schema changes are breaking for callers relying on `html` being required (it becomes optional/oneOf)
- Rebuild required: `pnpm build` in `apps/mcp-server` after changes
