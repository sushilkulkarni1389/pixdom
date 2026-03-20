## Why

End users who install pixdom globally via npm have no automated way to register the MCP server with Claude Code — they must manually edit `~/.claude.json`, find the correct binary path, and format the JSON correctly. This is error-prone and creates unnecessary friction that discourages adoption.

## What Changes

- Add a `pixdom-mcp` named binary to `apps/mcp-server/package.json` so the MCP server is available as a standalone command after `npm install -g pixdom`
- Add a `pixdom mcp` subcommand to the CLI with `--install`, `--uninstall`, `--status`, and `--set-key` options
- `pixdom mcp --install` writes the MCP server config entry to `~/.claude.json` atomically, detecting project vs global scope automatically
- `pixdom mcp --set-key <key>` stores `ANTHROPIC_API_KEY` in the MCP config env block
- `pixdom mcp --uninstall` removes the entry from `~/.claude.json`
- `pixdom mcp --status` reports config entry, binary path, and API key presence
- Update README MCP setup instructions to use the new one-command flow

## Capabilities

### New Capabilities

- `cli-mcp-setup`: `pixdom mcp` subcommand — install, uninstall, status, and set-key operations against `~/.claude.json`

### Modified Capabilities

- `cli-publish-ready`: `pixdom-mcp` binary must be declared in `apps/mcp-server/package.json` and included in the published tarball

## Impact

- `apps/mcp-server/package.json` — new `bin.pixdom-mcp` entry
- `apps/cli/src/commands/mcp.ts` — new file
- `apps/cli/src/index.ts` — register new subcommand
- `apps/cli/package.json` — no change expected (binary lives in mcp-server package)
- `README.md` — MCP setup section rewritten
- No breaking changes to existing CLI commands or MCP tools
