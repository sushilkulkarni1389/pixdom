## 1. MCP Server Binary

- [x] 1.1 Add `"bin": { "pixdom-mcp": "./dist/index.js" }` to `apps/mcp-server/package.json`
- [x] 1.2 Verify `pixdom-mcp` appears in `pnpm pack` output for the mcp-server package
- [x] 1.3 Confirm `apps/mcp-server/dist/index.js` shebang is set to `#!/usr/bin/env node`

## 2. CLI Scaffold

- [x] 2.1 Create `apps/cli/src/commands/mcp.ts` with the `mcp` command skeleton (yargs or commander, matching existing command style)
- [x] 2.2 Register the `mcp` command in `apps/cli/src/index.ts`
- [x] 2.3 Verify `pixdom mcp --help` prints usage including all four flags

## 3. --install Implementation

- [x] 3.1 Implement `~/.claude.json` existence check with clear error message when missing
- [x] 3.2 Implement `pixdom-mcp` binary resolution (Node-based lookup first, then `which`, fall back to bare name with warning)
- [x] 3.3 Implement project-scope detection: compare `process.cwd()` against `config.projects` keys
- [x] 3.4 Implement JSON read → parse → mutate → atomic write (temp file + rename) for `mcpServers.pixdom`
- [x] 3.5 Implement overwrite prompt when entry already exists
- [x] 3.6 Print confirmation with resolved command path and next-steps instructions

## 4. --set-key Implementation

- [x] 4.1 Implement `--set-key <key>` flag parsing
- [x] 4.2 Add `ANTHROPIC_API_KEY` to the `env` block of `mcpServers.pixdom` atomically
- [x] 4.3 Implement replace prompt when key already exists
- [x] 4.4 Print confirmation and security warning; ensure key value is never echoed to stdout

## 5. --uninstall Implementation

- [x] 5.1 Implement removal of `mcpServers.pixdom` from `~/.claude.json` atomically
- [x] 5.2 Print "pixdom MCP server removed" on success; "not configured" when entry absent

## 6. --status Implementation

- [x] 6.1 Check `~/.claude.json` for `mcpServers.pixdom` entry and report scope (project/global)
- [x] 6.2 Check `pixdom-mcp` binary is resolvable and executable
- [x] 6.3 Check `ANTHROPIC_API_KEY` in shell env and in MCP config env block
- [x] 6.4 Print formatted status summary with checkmarks/failure indicators; exit non-zero if any check fails

## 7. Safety & Edge Cases

- [x] 7.1 Handle malformed `~/.claude.json` (JSON parse failure): abort with error, do not modify file
- [x] 7.2 Ensure all writes preserve 2-space indentation and all unrelated fields
- [x] 7.3 Test atomic write: simulate write failure before rename and verify original is untouched

## 8. README Update

- [x] 8.1 Replace manual `~/.claude.json` edit instructions in README with `pixdom mcp --install` / `pixdom mcp --set-key` flow
- [x] 8.2 Add `pixdom mcp --status` to the verification step in README
