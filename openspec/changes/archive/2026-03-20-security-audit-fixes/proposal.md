## Why

An external security audit identified four vulnerabilities in the MCP server path: a critical path traversal that lets a malicious LLM overwrite arbitrary files, a high-severity plaintext API key stored in `~/.claude.json`, a medium-severity local file disclosure via unrestricted `--file` inputs, and a low-severity signal handler accumulation that orphans temp directories under concurrent load. These must be fixed before pixdom MCP is recommended for production use.

## What Changes

- **MCP output path sandboxing**: All MCP tool output is restricted to `~/pixdom-output/` (configurable via `PIXDOM_MCP_OUTPUT_DIR`). Paths outside this directory are rejected with `MCP_OUTPUT_PATH_RESTRICTED`. Auto-generated filenames are used when no path is supplied. CLI `validateOutputPath` is unchanged.
- **API key keychain storage**: `pixdom mcp --set-key` attempts OS keychain storage (macOS `security`, Linux `secret-tool`, Windows `cmdkey`) before falling back to plaintext `~/.claude.json`. Plaintext fallback prints a warning and sets file permissions to `0o600`. Key value is never logged. MCP startup resolves key from keychain → env var → `~/.claude.json`.
- **MCP file input directory scoping**: `convert_html_to_asset` `--file` inputs are validated against an allowlist of directories (`~/pixdom-input/`, `~/Downloads/`, `~/Desktop/` by default; configurable via `PIXDOM_MCP_ALLOWED_DIRS`). Rejected paths return `MCP_FILE_PATH_RESTRICTED`. Sub-resource `file:` requests from loaded HTML are blocked (main document only).
- **Centralised temp dir registry**: A new `temp-registry.ts` module holds a module-level set of active temp directories with `registerTempDir`/`releaseTempDir`/`cleanupAll`. Signal handlers (`SIGINT`, `SIGTERM`) are registered once at module load; `renderAnimated` replaces its per-render inline handlers with registry calls.
- **`pixdom mcp --status` additions**: Shows output directory, allowed input dirs, and API key storage method (keychain / plaintext / env var / not set).
- **`pixdom mcp --install` messaging**: Env var is now the prominently recommended method; `--set-key` is documented as secondary.

## Capabilities

### New Capabilities

- `mcp-output-sandbox`: Restricts MCP server output paths to a safe directory; auto-generates filenames; exposes `PIXDOM_MCP_OUTPUT_DIR`.
- `api-key-keychain`: OS keychain storage for ANTHROPIC_API_KEY with graceful plaintext fallback, permission hardening, and startup resolution order.
- `mcp-file-input-scope`: Allowlist-based directory scoping for MCP `--file` inputs with sub-resource `file:` blocking; exposes `PIXDOM_MCP_ALLOWED_DIRS`.
- `temp-dir-registry`: Centralised temp directory lifecycle management with single-registration signal handlers.

### Modified Capabilities

- `mcp-convert-tool`: Output path and file input now go through sandbox/scope checks (new security pre-conditions on existing tool behaviour).
- `mcp-generate-tool`: Output path now goes through sandbox check (new security pre-condition).
- `cli-mcp-setup`: `--set-key` gains keychain logic; `--install` messaging updated; `--status` shows new security fields.
- `output-path-validation`: MCP context now enforces directory sandbox on top of existing validation (extended behaviour, not replacement).

## Impact

- **apps/mcp-server**: New sandbox/scope middleware, keychain integration, updated `--status` and `--install` output.
- **packages/core**: New `temp-registry.ts` module; `renderAnimated` updated to use registry.
- **No CLI behavioural change**: `validateOutputPath` and `--file` handling in `apps/cli` are untouched.
- **New env vars**: `PIXDOM_MCP_OUTPUT_DIR`, `PIXDOM_MCP_ALLOWED_DIRS` (MCP only).
- **No new npm dependencies**: Keychain access via `child_process.execSync` using OS CLIs.
- **Existing MCP callers**: Any call that passes an output path outside `~/pixdom-output/` or a `--file` path outside the default allowlist will now receive an error — callers must be updated or env vars set accordingly.
