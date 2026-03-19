## 1. Update package.json

- [x] 1.1 Add `esbuild` to `devDependencies` in `apps/mcp-server/package.json`
- [x] 1.2 Add `build` script: `esbuild src/index.ts --bundle --platform=node --target=node18 --format=cjs --outfile=dist/index.js --external:@anthropic-ai/sdk --external:@modelcontextprotocol/sdk --external:zod --external:playwright --external:sharp --external:ffmpeg-static`
- [x] 1.3 Add `"main": "dist/index.js"` field to `apps/mcp-server/package.json`
- [x] 1.4 Remove `@pixdom/core`, `@pixdom/profiles`, `@pixdom/types` from `dependencies`

## 2. Install and Build

- [x] 2.1 Run `pnpm install` at repo root to register the new `esbuild` devDependency
- [x] 2.2 Run `pnpm build` in `apps/mcp-server` to produce `dist/index.js`

## 3. Verify

- [x] 3.1 Confirm `dist/index.js` exists and is CJS format (contains `"use strict"` or `require(` calls)
- [x] 3.2 Confirm no `@pixdom/*` references in `dist/index.js` (workspace deps are inlined)
- [x] 3.3 Confirm `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`, `zod` appear as `require(` in `dist/index.js` (not bundled)
- [x] 3.4 Run `node dist/index.js` from `apps/mcp-server` and verify the process stays alive (waiting for MCP stdin) with no `Cannot find module` error
