## ADDED Requirements

### Requirement: esbuild bundle produces CJS dist/index.js
`apps/mcp-server/package.json` SHALL include `esbuild` as a `devDependency` and a `build` script that runs:
`esbuild src/index.ts --bundle --platform=node --target=node18 --format=cjs --outfile=dist/index.js`
The bundle SHALL inline all `@pixdom/core`, `@pixdom/profiles`, and `@pixdom/types` imports. The output SHALL be CommonJS format (CJS), not ESM.

#### Scenario: dist/index.js produced by build
- **WHEN** `pnpm build` is run in `apps/mcp-server`
- **THEN** `dist/index.js` exists and is a CJS module (starts with `"use strict"` or contains `require(` calls)

#### Scenario: @pixdom imports are inlined
- **WHEN** `dist/index.js` is inspected after build
- **THEN** it contains no `require` or `import` statements referencing `@pixdom/core`, `@pixdom/profiles`, or `@pixdom/types`

#### Scenario: Runtime deps remain external
- **WHEN** `dist/index.js` is inspected after build
- **THEN** it contains `require(` calls for `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`, and `zod` (not inlined)

#### Scenario: Native modules remain external
- **WHEN** `dist/index.js` is inspected after build
- **THEN** it contains `require(` calls for `playwright`, `sharp`, and `ffmpeg-static` (not inlined)

### Requirement: package.json main field and dependency list
`apps/mcp-server/package.json` SHALL declare `"main": "dist/index.js"`. `@pixdom/core`, `@pixdom/profiles`, and `@pixdom/types` SHALL NOT appear in `dependencies` or `devDependencies`. `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`, and `zod` SHALL remain in `dependencies`.

#### Scenario: main field set correctly
- **WHEN** `apps/mcp-server/package.json` is read
- **THEN** the `main` field equals `"dist/index.js"`

#### Scenario: workspace packages absent from manifest
- **WHEN** `apps/mcp-server/package.json` is read
- **THEN** no `@pixdom/*` entries appear in `dependencies` or `devDependencies`

#### Scenario: runtime deps present in manifest
- **WHEN** `apps/mcp-server/package.json` is read
- **THEN** `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`, and `zod` appear in `dependencies`

### Requirement: Built server starts without monorepo
`node dist/index.js` SHALL start the MCP server process without requiring the monorepo, `tsx`, or any `@pixdom/*` workspace package. The process SHALL remain running (waiting for MCP stdin) and SHALL NOT exit with a module-not-found error.

#### Scenario: node dist/index.js starts cleanly
- **WHEN** `node dist/index.js` is run from `apps/mcp-server` (with `node_modules` containing only declared runtime deps)
- **THEN** the process does not exit within 2 seconds and produces no `Cannot find module` error on stderr

#### Scenario: MCP server usable from Claude Code config
- **WHEN** Claude Code MCP config uses `"command": "node", "args": ["/abs/path/to/apps/mcp-server/dist/index.js"]`
- **THEN** the MCP server initializes and responds to MCP protocol messages over stdio
