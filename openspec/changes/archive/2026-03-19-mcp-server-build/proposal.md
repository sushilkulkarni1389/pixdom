## Why

The MCP server currently requires the full monorepo (workspace packages, `tsx`, pnpm) to run. Users who want to add it to Claude Code's MCP config must clone the entire repo and keep it on disk. A self-contained `dist/index.js` — identical to the CLI's publish-ready bundle — lets users point Claude Code directly at a single built file with no monorepo dependency.

## What Changes

- Add `esbuild` as a devDependency in `apps/mcp-server/package.json`
- Add a `build` script: `esbuild src/index.ts --bundle --platform=node --target=node18 --format=cjs --outfile=dist/index.js`
- Bundle `@pixdom/core`, `@pixdom/profiles`, `@pixdom/types` (workspace-only, not on npm)
- Externalize `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`, `zod`, `playwright`, `sharp`, `ffmpeg-static`
- Remove `@pixdom/core`, `@pixdom/profiles`, `@pixdom/types` from runtime `dependencies`
- Add `"main": "dist/index.js"` to `package.json`

## Capabilities

### New Capabilities

- `mcp-server-bundle`: Build pipeline that produces a self-contained `dist/index.js` with workspace deps inlined and external runtime deps preserved

### Modified Capabilities

<!-- No existing spec-level requirement changes -->

## Impact

- `apps/mcp-server/package.json`: new devDependency, new build script, `main` field, removed workspace deps
- `apps/mcp-server/dist/index.js`: new build artifact (CJS, bundled)
- Users can now configure the MCP server in Claude Code without the monorepo:
  ```json
  { "command": "node", "args": ["/path/to/apps/mcp-server/dist/index.js"] }
  ```
- Cross-references: `mcp-convert-tool`, `mcp-generate-tool` (tools must work after bundling)
