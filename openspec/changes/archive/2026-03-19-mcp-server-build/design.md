## Context

`apps/mcp-server` exposes Pixdom's convert/generate tools as an MCP server for Claude Code. Currently it starts via `tsx src/index.ts`, which requires the monorepo (`pnpm` workspace, `@pixdom/*` source packages, `tsx`). Users who want to configure it in Claude Code's MCP config must point at the live monorepo. The CLI already solved an identical problem via `cli-bundle` (esbuild + CJS). This change replicates that pattern for the MCP server, using CJS instead of ESM because MCP servers are loaded by Claude Code via `require()`.

## Goals / Non-Goals

**Goals:**
- `pnpm build` in `apps/mcp-server` produces `dist/index.js` (CJS, self-contained)
- All `@pixdom/*` workspace packages are inlined; no runtime workspace dependency
- `node dist/index.js` starts the MCP server without monorepo, `tsx`, or workspace packages
- `package.json` reflects the new runtime dependency set (no `@pixdom/*`)

**Non-Goals:**
- Publishing the MCP server to npm (out of scope)
- Changing MCP tool behavior or adding new tools
- Changing the CLI build

## Decisions

### CJS format, not ESM

The CLI bundle uses `--format=esm`. The MCP server must use `--format=cjs`.

**Why**: Claude Code loads MCP servers via `node` directly. The MCP SDK and `@anthropic-ai/sdk` ship dual-format packages; with CJS the interop is straightforward and `require()` resolution works without `--experimental-vm-modules`. ESM would require either `"type": "module"` in `package.json` plus `import()` dynamic resolution, or top-level-await complications. CJS is simpler and matches how Claude Code invokes MCP servers.

**Alternatives considered**: ESM with `"type": "module"` — rejected because it complicates interop with CJS-only transitive deps and isn't how the CLI actually loads servers.

### Externalize `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`, `zod`

These are real npm packages already declared as `dependencies`. Claude Code's node environment will have them in `node_modules` next to `dist/index.js` after `npm install`.

**Why**: Bundling them adds ~2 MB and bakes in a fixed version that can't be patched without rebuilding. Keeping them external means `npm install` resolves the declared version, consistent with normal Node module semantics.

### Same native-module externals as CLI

`playwright`, `sharp`, `ffmpeg-static` must be external — they contain native `.node` binaries that esbuild cannot bundle.

### Remove `@pixdom/*` from runtime dependencies

After bundling, `@pixdom/core`, `@pixdom/profiles`, and `@pixdom/types` are fully inlined in `dist/index.js`. They must not appear in `dependencies` because they are workspace-only packages not published to npm. Leaving them would cause `npm install` to fail outside the monorepo.

### No `postinstall` script needed

Unlike the CLI (which installs Playwright's Chromium browser), the MCP server delegates browser launch to the bundled core. Claude Code users run the MCP server after already setting up the CLI or running `playwright install chromium` separately. Adding a `postinstall` is out of scope.

## Risks / Trade-offs

- **Bundled snapshot**: `dist/index.js` captures a point-in-time snapshot of `@pixdom/*` source. If workspace packages change, users must rebuild. → Mitigation: document that `pnpm build` must be re-run after workspace package updates.
- **CJS / ESM interop edge cases**: Some transitive deps may use top-level `await` or ESM-only exports. → Mitigation: esbuild handles most interop; verify `node dist/index.js` starts cleanly as acceptance gate.
- **`output/` directory**: MCP server writes to `apps/mcp-server/output/` at runtime. This is unaffected by the build step.

## Migration Plan

1. Update `apps/mcp-server/package.json` (add `esbuild` devDep, `build` script, `main` field, remove workspace deps)
2. Run `pnpm build` in `apps/mcp-server` to produce `dist/index.js`
3. Verify `node dist/index.js` starts (hangs waiting for MCP stdin — expected)
4. Update Claude Code MCP config to use `"command": "node", "args": ["/abs/path/to/apps/mcp-server/dist/index.js"]`

No rollback needed — the `tsx`-based `start` script is unchanged and remains usable inside the monorepo.
