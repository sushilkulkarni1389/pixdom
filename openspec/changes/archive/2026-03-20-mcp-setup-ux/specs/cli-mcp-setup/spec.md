## ADDED Requirements

### Requirement: pixdom-mcp named binary
`apps/mcp-server/package.json` SHALL declare `"bin": { "pixdom-mcp": "./dist/index.js" }`. After `npm install -g pixdom`, the `pixdom-mcp` command SHALL be available in the user's PATH and SHALL start the MCP server when executed.

#### Scenario: pixdom-mcp binary is executable after global install
- **WHEN** `pixdom` is installed globally via `npm install -g pixdom`
- **THEN** `pixdom-mcp` is available on PATH and exits with code 0 when invoked

#### Scenario: pixdom-mcp is present in the published tarball
- **WHEN** `pnpm pack` is run on the mcp-server package
- **THEN** the resulting tarball contains `dist/index.js` and the `bin.pixdom-mcp` entry is present in the packed `package.json`

### Requirement: mcp subcommand exists
`apps/cli` SHALL expose a `mcp` subcommand reachable as `pixdom mcp`. When invoked with no flags, it SHALL print help text describing the available flags and exit with code 0.

#### Scenario: No-flag invocation prints help
- **WHEN** `pixdom mcp` is run with no flags
- **THEN** stdout contains usage information including `--install`, `--uninstall`, `--status`, and `--set-key` and the process exits with code 0

### Requirement: --install writes MCP config entry
`pixdom mcp --install` SHALL write a `mcpServers.pixdom` entry to `~/.claude.json` and print a confirmation with the resolved binary path and next steps.

#### Scenario: ~/.claude.json does not exist
- **WHEN** `pixdom mcp --install` is run and `~/.claude.json` does not exist
- **THEN** the process exits with a non-zero code and prints "Claude Code config not found at ~/.claude.json"

#### Scenario: Project-scoped install when cwd matches a project
- **WHEN** `pixdom mcp --install` is run from a directory that matches a key in `config.projects` in `~/.claude.json`
- **THEN** the `mcpServers.pixdom` entry is written under that project key and the output includes "Added pixdom MCP server to project: <path>"

#### Scenario: Global install when cwd does not match any project
- **WHEN** `pixdom mcp --install` is run from a directory not in `config.projects`
- **THEN** the `mcpServers.pixdom` entry is written under the top-level `mcpServers` key and the output includes "Added pixdom MCP server globally"

#### Scenario: Binary path is resolved and stored as absolute path
- **WHEN** `pixdom mcp --install` succeeds
- **THEN** the `command` field in the written config entry is an absolute path to the `pixdom-mcp` binary

#### Scenario: Falls back to bare command name when resolution fails
- **WHEN** `pixdom mcp --install` is run and the `pixdom-mcp` binary cannot be resolved
- **THEN** the `command` field is set to `"pixdom-mcp"` and the output includes a warning about unresolved binary path

#### Scenario: Prompts before overwriting an existing entry
- **WHEN** `pixdom mcp --install` is run and `mcpServers.pixdom` already exists in `~/.claude.json`
- **THEN** the process prompts "pixdom MCP server is already configured. Overwrite? (y/N)" and does not write unless the user confirms

#### Scenario: Confirmation output includes next steps
- **WHEN** `pixdom mcp --install` completes successfully
- **THEN** stdout includes the resolved command path, a prompt to restart Claude Code, and instructions for running `/mcp` to verify

### Requirement: --install writes atomically
`pixdom mcp --install` SHALL write `~/.claude.json` by writing to a temporary file first, then renaming it. If any step before the rename fails, the original `~/.claude.json` MUST remain unmodified.

#### Scenario: Original file preserved if write fails
- **WHEN** `pixdom mcp --install` encounters a write error before the atomic rename
- **THEN** `~/.claude.json` remains unchanged

#### Scenario: Aborts if JSON parse fails
- **WHEN** `~/.claude.json` cannot be parsed as valid JSON
- **THEN** the process exits with a non-zero code and prints "Could not parse ~/.claude.json — please check the file manually" without modifying the file

### Requirement: --set-key stores API key in MCP config env
`pixdom mcp --set-key <key>` SHALL add `ANTHROPIC_API_KEY` to the `env` block of the `mcpServers.pixdom` entry in `~/.claude.json`. The key value SHALL NOT be printed to stdout after being stored.

#### Scenario: API key written to env block
- **WHEN** `pixdom mcp --set-key sk-ant-xxx` is run and a `mcpServers.pixdom` entry exists
- **THEN** `~/.claude.json` is updated with `"env": { "ANTHROPIC_API_KEY": "sk-ant-xxx" }` under the pixdom entry and stdout contains "API key saved to ~/.claude.json MCP config"

#### Scenario: Security warning is printed
- **WHEN** `pixdom mcp --set-key` completes successfully
- **THEN** stdout contains a warning that `~/.claude.json` is not encrypted and suggests using a shell profile for higher security

#### Scenario: API key value is not echoed to stdout
- **WHEN** `pixdom mcp --set-key sk-ant-xxx` is run
- **THEN** stdout does not contain `sk-ant-xxx`

#### Scenario: Prompts before replacing existing key
- **WHEN** `pixdom mcp --set-key` is run and `ANTHROPIC_API_KEY` is already set in the env block
- **THEN** the process prompts "API key already configured. Replace? (y/N)" and does not write unless the user confirms

### Requirement: --uninstall removes MCP config entry
`pixdom mcp --uninstall` SHALL remove the `mcpServers.pixdom` entry from `~/.claude.json` atomically and print a confirmation.

#### Scenario: Entry removed and confirmation printed
- **WHEN** `pixdom mcp --uninstall` is run and `mcpServers.pixdom` exists in `~/.claude.json`
- **THEN** the entry is removed, `~/.claude.json` is written atomically, and stdout contains "pixdom MCP server removed. Restart Claude Code to apply."

#### Scenario: No-op when entry not found
- **WHEN** `pixdom mcp --uninstall` is run and no `mcpServers.pixdom` entry exists
- **THEN** the process exits with code 0 and stdout contains "pixdom MCP server is not configured — nothing to remove."

### Requirement: --status reports health of MCP setup
`pixdom mcp --status` SHALL check for the config entry, the binary, and the API key, and print a human-readable status summary.

#### Scenario: All checks pass
- **WHEN** `pixdom mcp --status` is run and the config entry exists, the binary is executable, and ANTHROPIC_API_KEY is set
- **THEN** stdout shows checkmarks for Config entry, Binary, and API key, and exits with code 0

#### Scenario: Config entry missing
- **WHEN** `pixdom mcp --status` is run and no `mcpServers.pixdom` entry exists in `~/.claude.json`
- **THEN** stdout shows a failure indicator for Config entry and exits with a non-zero code

#### Scenario: Binary not found
- **WHEN** `pixdom mcp --status` is run and the `pixdom-mcp` binary is not on PATH
- **THEN** stdout shows a failure indicator for Binary and exits with a non-zero code

#### Scenario: API key not set
- **WHEN** `pixdom mcp --status` is run and ANTHROPIC_API_KEY is neither in shell env nor in the MCP config env block
- **THEN** stdout shows a failure indicator for API key
