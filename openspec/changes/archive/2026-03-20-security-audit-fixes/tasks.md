## 1. MCP Output Sandbox (Critical — Fix 1)

- [x] 1.1 Create `apps/mcp-server/src/mcp-sandbox.ts` exporting `getMcpOutputDir()` (reads `PIXDOM_MCP_OUTPUT_DIR`, expands `~`, defaults to `~/pixdom-output/`) and `ensureMcpOutputDir()` (creates dir with `0o755` if absent)
- [x] 1.2 Implement `validateMcpOutputPath(requestedPath: string, outputDir: string): Result` — resolves via `path.resolve()`, checks prefix, returns `MCP_OUTPUT_PATH_RESTRICTED` error with instructions if outside sandbox
- [x] 1.3 Implement `generateMcpOutputPath(outputDir: string, format: string): string` — returns `pixdom-output-<epoch>-<4hex>.<format>` inside sandbox
- [x] 1.4 In `convert_html_to_asset` handler: call `ensureMcpOutputDir()` at handler start; if `output` is provided, run `validateMcpOutputPath` and return error on failure; if omitted, call `generateMcpOutputPath`; remove any existing call to CLI `validateOutputPath` for the `output` parameter
- [x] 1.5 In `generate_and_convert` handler: same sandbox wiring as 1.4; run sandbox check *before* any Claude API call
- [x] 1.6 Add `PIXDOM_MCP_OUTPUT_DIR` line to `pixdom mcp --status` output showing effective resolved path

## 2. API Key Keychain Storage (High — Fix 2)

- [x] 2.1 Create `apps/mcp-server/src/keychain.ts` with `storeKey(key: string): { method: 'keychain' | 'plaintext' }` and `readKey(): string | null` — platform-branched using `process.platform`, calling OS CLIs via `child_process.execSync`
- [x] 2.2 Implement macOS branch: `security add-generic-password -s pixdom -a anthropic_api_key -w <key>` for store; `security find-generic-password -s pixdom -a anthropic_api_key -w` for read; wrap in try/catch for fallback
- [x] 2.3 Implement Linux branch: check `which secret-tool` before calling; `secret-tool store --label="pixdom" service pixdom username anthropic_api_key` for store; `secret-tool lookup service pixdom username anthropic_api_key` for read; if absent, print one-line suggestion about `libsecret-tools` then fall back
- [x] 2.4 Implement Windows branch: `cmdkey /add:pixdom /user:anthropic_api_key /pass:<key>` for store; `cmdkey /list:pixdom` + parse for read
- [x] 2.5 Update `pixdom mcp --set-key` command: call `storeKey()` first; on plaintext fallback, write to `~/.claude.json` env block, chmod to `0o600`, print plaintext warning; never print the key value
- [x] 2.6 Update MCP server startup: call `readKey()` → env var → `~/.claude.json` env block for key resolution; use resolved key for Anthropic SDK init
- [x] 2.7 Update `pixdom mcp --status` to show "API key storage: keychain | plaintext (~/.claude.json) | env var | not set" based on resolution result
- [x] 2.8 Update `pixdom mcp --install` confirmation output to print "Recommended: export ANTHROPIC_API_KEY=<your-key> in ~/.bashrc" before any `--set-key` mention

## 3. MCP File Input Scoping (Medium — Fix 3)

- [x] 3.1 Create `apps/mcp-server/src/mcp-file-scope.ts` exporting `getMcpAllowedDirs()` (parses `PIXDOM_MCP_ALLOWED_DIRS` colon-split + expands `~`; defaults to `~/pixdom-input/`, `~/Downloads/`, `~/Desktop/`) and `validateMcpFilePath(filePath: string, allowedDirs: string[]): Result`
- [x] 3.2 `validateMcpFilePath` calls `fs.realpathSync(filePath)`, catches `ENOENT` (returns `MCP_FILE_PATH_RESTRICTED` with "file not found"), then checks resolved path prefix against each allowed dir; returns error with allowlist + `PIXDOM_MCP_ALLOWED_DIRS` instructions if none match
- [x] 3.3 In `convert_html_to_asset` handler: if `file` parameter is present (MCP context), call `validateMcpFilePath` before render; return `{ isError: true }` on failure
- [x] 3.4 In `apps/mcp-server/src/request-guard.ts` (or equivalent interceptor): when render is triggered by a `file:` main document (MCP context), intercept all sub-resource requests whose URL starts with `file:` and call `request.abort()`; allow the main navigation request through
- [x] 3.5 Add `PIXDOM_MCP_ALLOWED_DIRS` line to `pixdom mcp --status` output listing effective allowed directories

## 4. Temp Directory Registry (Low — Fix 4)

- [x] 4.1 Create `packages/core/src/temp-registry.ts`: declare module-level `activeTempDirs = new Set<string>()`; export `registerTempDir`, `releaseTempDir`, `cleanupAll`; at module load register `process.once('SIGINT', ...)` (exit 130) and `process.once('SIGTERM', ...)` (exit 143)
- [x] 4.2 Implement `releaseTempDir(dir)`: remove from set, call `fs.rm(dir, { recursive: true, force: true })` (async, best-effort no-throw)
- [x] 4.3 Implement `cleanupAll()`: iterate set, call `fs.rmSync` on each (sync for signal handler context), clear set
- [x] 4.4 Update `renderAnimated` in `packages/core/src/animated-renderer.ts` (or equivalent): replace `process.once('SIGINT'/'SIGTERM', ...)` with `registerTempDir(tmpDir)` after creation and `releaseTempDir(tmpDir)` in finally block
- [x] 4.5 Add `import 'packages/core/src/temp-registry'` (side-effect) to `apps/mcp-server/src/index.ts` as the first non-type import (satisfied transitively: @pixdom/core → animated-renderer → temp-registry)

## 5. Verification

- [x] 5.1 Smoke test Fix 1: confirm MCP call with `output: '/tmp/test.png'` returns `MCP_OUTPUT_PATH_RESTRICTED`; confirm call without `output` writes inside `~/pixdom-output/`
- [x] 5.2 Smoke test Fix 2: run `pixdom mcp --set-key sk-ant-test` and verify key not printed; run `pixdom mcp --status` and verify storage method shown
- [x] 5.3 Smoke test Fix 3: confirm MCP call with `file: '/etc/passwd'` returns `MCP_FILE_PATH_RESTRICTED`; confirm call with file in `~/Downloads/` succeeds
- [x] 5.4 Smoke test Fix 4: confirm `process.listenerCount('SIGINT')` is 1 after importing `temp-registry` and launching two concurrent `renderAnimated` calls
- [x] 5.5 Confirm CLI behaviour unchanged: `validateOutputPath` remains in `apps/cli/src/index.ts` unchanged; MCP handler no longer calls it (confirmed via grep)
