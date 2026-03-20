## Context

Currently, end users who install `pixdom` globally must manually edit `~/.claude.json` to register the MCP server with Claude Code. The file is large and easy to corrupt, and the binary path varies by machine and package manager. The `pixdom completion --install` command already demonstrates the right pattern: a CLI subcommand that handles system-level setup automatically.

The MCP server (`apps/mcp-server`) is a separate package inside the monorepo. It has its own `package.json` and `dist/index.js` entry point. The CLI (`apps/cli`) is the user-facing package published as `pixdom`.

## Goals / Non-Goals

**Goals:**
- `pixdom-mcp` available as a standalone PATH command after `npm install -g pixdom`
- `pixdom mcp --install` writes a correct, safe MCP config to `~/.claude.json` in one command
- `pixdom mcp --set-key` stores `ANTHROPIC_API_KEY` in the MCP config env block
- `pixdom mcp --uninstall` removes the entry cleanly
- `pixdom mcp --status` gives a clear at-a-glance health check
- `~/.claude.json` is never left in a corrupted state

**Non-Goals:**
- Managing MCP servers other than pixdom
- Supporting Claude Desktop (separate config file, out of scope)
- Encrypting the API key at rest

## Decisions

### D1: `pixdom-mcp` binary lives in `apps/mcp-server/package.json`

The MCP server entry point is already `apps/mcp-server/dist/index.js`. Adding `"bin": { "pixdom-mcp": "./dist/index.js" }` to that package's `package.json` is the natural home. The CLI package does not need to duplicate it.

Alternative considered: expose via the CLI package (`apps/cli`) — rejected because the CLI and MCP server have different entry points and dependency trees.

### D2: Resolve binary path at install time, store absolute path

Claude Code may invoke MCP servers without inheriting the user's full `PATH`. Storing the resolved absolute path (via `which pixdom-mcp` or Node's `process.execPath`-relative lookup) is more reliable.

Fall back to the bare command name `"pixdom-mcp"` if resolution fails, with a warning to the user.

### D3: Atomic writes to `~/.claude.json` via temp-file rename

`~/.claude.json` is a large, critical config file. Write to a sibling temp file first (`~/.claude.json.tmp`), then `fs.renameSync` — this is atomic on all POSIX systems and on Windows (same volume). If anything fails before the rename, the original is untouched.

### D4: Project-scope vs global-scope detection

Compare `process.cwd()` against keys in `config.projects` (the same map Claude Code uses). If matched, add under `config.projects[cwd].mcpServers.pixdom`. Otherwise add under `config.mcpServers.pixdom`. This mirrors how Claude Code itself scopes MCP servers.

### D5: `pixdom mcp` command is implemented as a new file `apps/cli/src/commands/mcp.ts`

Mirrors the existing `completion.ts` command structure. Registered in `apps/cli/src/index.ts`.

### D6: API key is never echoed to stdout

After `--set-key`, only a confirmation message is printed. This prevents accidental key exposure in terminal scrollback or CI logs.

## Risks / Trade-offs

- `~/.claude.json` schema may change in future Claude Code releases → The writer only touches `mcpServers.pixdom` and `mcpServers` keys, leaving all other structure intact. JSON round-trip preserves unknown fields.
- Binary path at install time may differ from path at MCP server invocation time (e.g., user upgrades `pixdom`) → `--status` shows the stored path vs the currently resolved path, so discrepancies are visible. User can re-run `--install` to update.
- `which` is not available on all systems → Fall back to Node-based resolution before shelling out.

## Migration Plan

No migration required. The new command is purely additive. Existing manual `~/.claude.json` entries are left untouched unless the user explicitly runs `--install` (which will prompt before overwriting).

README update replaces manual instructions with the one-command flow.

## Open Questions

None blocking implementation.
