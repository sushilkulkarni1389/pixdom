## ADDED Requirements

### Requirement: OS keychain storage for API key
`pixdom mcp --set-key <key>` SHALL attempt to store `ANTHROPIC_API_KEY` in the OS keychain before falling back to plaintext. The keychain backend SHALL be selected by platform:
- macOS: `security add-generic-password -s pixdom -a anthropic_api_key -w <key>` via `child_process.execSync`
- Linux: `secret-tool store --label="pixdom" service pixdom username anthropic_api_key` via `child_process.execSync`, only if `secret-tool` is available on PATH
- Windows: `cmdkey /add:pixdom /user:anthropic_api_key /pass:<key>` via `child_process.execSync`
No new npm dependencies SHALL be introduced for keychain access.

#### Scenario: macOS keychain storage succeeds
- **WHEN** `pixdom mcp --set-key sk-ant-xxx` is run on macOS and `security` CLI is available
- **THEN** the key is stored via `security add-generic-password` and stdout contains "API key stored in macOS keychain"

#### Scenario: Linux keychain storage succeeds
- **WHEN** `pixdom mcp --set-key sk-ant-xxx` is run on Linux and `secret-tool` is on PATH
- **THEN** the key is stored via `secret-tool` and stdout contains "API key stored in system keychain"

#### Scenario: Linux fallback when secret-tool absent
- **WHEN** `pixdom mcp --set-key sk-ant-xxx` is run on Linux and `secret-tool` is not on PATH
- **THEN** the key falls back to plaintext storage and stdout contains a warning suggesting `libsecret-tools`

#### Scenario: Windows keychain storage succeeds
- **WHEN** `pixdom mcp --set-key sk-ant-xxx` is run on Windows and `cmdkey` is available
- **THEN** the key is stored via `cmdkey` and stdout contains "API key stored in Windows Credential Manager"

#### Scenario: Keychain CLI failure falls back to plaintext
- **WHEN** the keychain CLI command exits with a non-zero code
- **THEN** `--set-key` falls back to plaintext storage and prints the plaintext warning

### Requirement: Plaintext fallback hardening
When falling back to plaintext storage in `~/.claude.json`, the MCP server SHALL:
1. Write `ANTHROPIC_API_KEY` to the `env` block of the `mcpServers.pixdom` entry.
2. Set `~/.claude.json` file permissions to `0o600` after writing.
3. Print a warning: "⚠ API key stored in plaintext in ~/.claude.json — for better security, export ANTHROPIC_API_KEY in ~/.bashrc"
The key value SHALL NOT appear in any log, error, or status output.

#### Scenario: File permissions set to 0o600 after plaintext write
- **WHEN** the API key is stored in plaintext
- **THEN** `~/.claude.json` has permissions `0o600` (owner read/write only)

#### Scenario: Plaintext warning always printed on fallback
- **WHEN** keychain storage is unavailable and the key is stored in plaintext
- **THEN** stdout contains the plaintext warning regardless of platform

#### Scenario: API key value never printed
- **WHEN** `pixdom mcp --set-key sk-ant-xxx` completes (keychain or plaintext)
- **THEN** stdout and stderr do not contain `sk-ant-xxx`

### Requirement: MCP startup key resolution order
The MCP server SHALL resolve `ANTHROPIC_API_KEY` at startup using the following priority order:
1. OS keychain (platform-specific read command)
2. `ANTHROPIC_API_KEY` environment variable
3. `env.ANTHROPIC_API_KEY` in the `mcpServers.pixdom` block of `~/.claude.json`
The resolved key SHALL be used for all Anthropic API calls. If no key is found by any method, the server SHALL start but tool calls requiring the key SHALL return `{ isError: true }` with a message indicating the key is missing.

#### Scenario: Keychain key takes precedence over env var
- **WHEN** the key is stored in the OS keychain AND `ANTHROPIC_API_KEY` is set in the environment
- **THEN** the keychain value is used

#### Scenario: Env var used when keychain is empty
- **WHEN** no keychain entry exists and `ANTHROPIC_API_KEY` is set in the environment
- **THEN** the environment variable value is used

#### Scenario: ~/.claude.json fallback when both absent
- **WHEN** no keychain entry exists and `ANTHROPIC_API_KEY` is not in the environment
- **THEN** the value from `~/.claude.json` env block is used if present

#### Scenario: Missing key returns error on tool call
- **WHEN** no key is found by any method and `generate_and_convert` is called
- **THEN** the tool returns `{ isError: true }` with a message indicating the API key is missing

### Requirement: --status shows API key storage method
`pixdom mcp --status` SHALL include an "API key storage" line showing one of: `keychain`, `plaintext (~/.claude.json)`, `env var (ANTHROPIC_API_KEY)`, or `not set`.

#### Scenario: Keychain storage shown in status
- **WHEN** the API key is stored in the OS keychain and `pixdom mcp --status` is run
- **THEN** stdout contains "API key storage: keychain"

#### Scenario: Plaintext storage shown in status
- **WHEN** the API key is stored in `~/.claude.json` and not in keychain
- **THEN** stdout contains "API key storage: plaintext (~/.claude.json)"

#### Scenario: Env var shown in status
- **WHEN** `ANTHROPIC_API_KEY` is set in the environment and not in keychain
- **THEN** stdout contains "API key storage: env var"

#### Scenario: Not set shown in status
- **WHEN** no API key is found by any method
- **THEN** stdout contains "API key storage: not set"

### Requirement: --install messaging recommends env var
`pixdom mcp --install` confirmation output SHALL prominently recommend the env var method as the primary option and present `--set-key` as secondary.

#### Scenario: Install output shows env var recommendation first
- **WHEN** `pixdom mcp --install` completes successfully
- **THEN** stdout contains "Recommended: export ANTHROPIC_API_KEY=<your-key> in ~/.bashrc" before any mention of `--set-key`
