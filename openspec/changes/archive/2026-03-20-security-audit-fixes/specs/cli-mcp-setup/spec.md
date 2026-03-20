## MODIFIED Requirements

### Requirement: --set-key stores API key in MCP config env
`pixdom mcp --set-key <key>` SHALL attempt to store `ANTHROPIC_API_KEY` in the OS keychain first (see `api-key-keychain` spec). If keychain storage fails or is unavailable, it SHALL fall back to adding `ANTHROPIC_API_KEY` to the `env` block of the `mcpServers.pixdom` entry in `~/.claude.json`. When falling back to plaintext, the file SHALL be written atomically and permissions set to `0o600`. The key value SHALL NOT be printed to stdout after being stored.

#### Scenario: API key stored in keychain when available
- **WHEN** `pixdom mcp --set-key sk-ant-xxx` is run on a system with keychain support
- **THEN** the key is stored in the OS keychain and stdout does not contain `sk-ant-xxx`

#### Scenario: API key written to env block on plaintext fallback
- **WHEN** `pixdom mcp --set-key sk-ant-xxx` is run and keychain is unavailable and a `mcpServers.pixdom` entry exists
- **THEN** `~/.claude.json` is updated with `"env": { "ANTHROPIC_API_KEY": "sk-ant-xxx" }` under the pixdom entry, permissions are set to `0o600`, and stdout contains "API key saved to ~/.claude.json MCP config"

#### Scenario: Plaintext warning printed on fallback
- **WHEN** the key falls back to plaintext storage
- **THEN** stdout contains the plaintext security warning mentioning `~/.claude.json`

#### Scenario: API key value is not echoed to stdout
- **WHEN** `pixdom mcp --set-key sk-ant-xxx` is run
- **THEN** stdout does not contain `sk-ant-xxx`

#### Scenario: Prompts before replacing existing key
- **WHEN** `pixdom mcp --set-key` is run and `ANTHROPIC_API_KEY` is already set in the env block
- **THEN** the process prompts "API key already configured. Replace? (y/N)" and does not write unless the user confirms

### Requirement: --install writes MCP config entry
`pixdom mcp --install` SHALL write a `mcpServers.pixdom` entry to `~/.claude.json` and print a confirmation with the resolved binary path and next steps. The confirmation output SHALL prominently recommend setting `ANTHROPIC_API_KEY` via an environment variable as the primary method, with `pixdom mcp --set-key` presented as a secondary option.

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

#### Scenario: Confirmation output includes env var recommendation first
- **WHEN** `pixdom mcp --install` completes successfully
- **THEN** stdout contains "Recommended: export ANTHROPIC_API_KEY=<your-key> in ~/.bashrc" before any mention of `--set-key`

#### Scenario: Confirmation output includes next steps
- **WHEN** `pixdom mcp --install` completes successfully
- **THEN** stdout includes the resolved command path, a prompt to restart Claude Code, and instructions for running `/mcp` to verify

### Requirement: --status reports health of MCP setup
`pixdom mcp --status` SHALL check for the config entry, the binary, the API key, the MCP output sandbox directory, and the allowed input directories, and print a human-readable status summary.

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
- **WHEN** `pixdom mcp --status` is run and ANTHROPIC_API_KEY is found by no storage method
- **THEN** stdout shows "API key storage: not set"

#### Scenario: Output sandbox directory shown in status
- **WHEN** `pixdom mcp --status` is run
- **THEN** stdout contains "Output directory:" followed by the effective `PIXDOM_MCP_OUTPUT_DIR` path

#### Scenario: Allowed input dirs shown in status
- **WHEN** `pixdom mcp --status` is run
- **THEN** stdout contains "Allowed input dirs:" followed by the effective allowlist
