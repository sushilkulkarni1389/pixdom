## Context

Pixdom's MCP server exposes `convert_html_to_asset` and `generate_and_convert` tools to Claude Code. Because the LLM controls tool inputs, any path parameter is an untrusted string — the server cannot assume the LLM will behave correctly. The current server delegates output path validation to the same `validateOutputPath` routine used by the CLI, which was designed for developer-controlled invocations and only blocks obvious shell-injection patterns. File input paths are accepted without restriction. API keys are written plaintext to `~/.claude.json`. Concurrent animated renders each install their own `SIGINT`/`SIGTERM` handlers, accumulating without bound.

None of these gaps affect CLI users (who control their own filesystem), but they are exploitable via a compromised or misconfigured LLM in the MCP context.

## Goals / Non-Goals

**Goals:**
- Restrict MCP output paths to a configurable sandbox directory (`~/pixdom-output/`).
- Restrict MCP file input paths to a configurable allowlist of directories.
- Store the Anthropic API key in the OS keychain when available; harden plaintext fallback.
- Replace per-render signal handlers with a single module-level temp-dir registry.
- Keep all CLI behaviour strictly unchanged.

**Non-Goals:**
- Content-level scanning of HTML inputs.
- Encryption of any data other than what the OS keychain provides.
- Changes to how the CLI invokes `validateOutputPath`.
- Network-level sandboxing beyond existing `mcp-origin-validation`.
- Supporting keychain access via third-party npm packages (use OS CLIs only).

## Decisions

### D1 — MCP output sandbox via path prefix check, not chroot

**Decision**: Resolve the requested output path to absolute, then assert it starts with `PIXDOM_MCP_OUTPUT_DIR`. Reject with `MCP_OUTPUT_PATH_RESTRICTED` otherwise.

**Why over chroot/jail**: Chroot requires root privileges. A prefix check is sufficient because we control path resolution (no symlinks outside the sandbox directory are followed — `path.resolve` without `realpath` is intentional here: we check the *requested* path, not a possible symlink target inside the sandbox). The sandbox directory itself is created at first use with `0o755`.

**Why not reuse `validateOutputPath`**: CLI validation is intentionally permissive. Adding MCP-specific logic there would create cross-cutting coupling. MCP sandboxing is a separate concern implemented in an MCP middleware layer.

**Auto-generated filename**: When `output` is omitted, generate `pixdom-output-<epoch>-<4hex>.<format>` inside `PIXDOM_MCP_OUTPUT_DIR` so the LLM always gets a usable path back.

### D2 — OS keychain via child_process.execSync, no new npm dep

**Decision**: Implement keychain access as three platform branches using `child_process.execSync` to call OS-native CLIs (`security` on macOS, `secret-tool` on Linux, `cmdkey` on Windows). If the CLI is absent or the call fails, fall back to plaintext with a warning.

**Why not `keytar` or similar**: Avoids a native addon dependency that complicates cross-platform builds and may break in restricted CI environments.

**Resolution order at MCP startup**: keychain → `ANTHROPIC_API_KEY` env var → `~/.claude.json` env block. This order matches user expectation (explicit env var wins over stored credentials).

**Plaintext hardening**: After writing `~/.claude.json`, chmod it to `0o600`. The warning message is printed unconditionally on plaintext fallback.

### D3 — File input allowlist as colon-separated env var, no database

**Decision**: Parse `PIXDOM_MCP_ALLOWED_DIRS` at MCP startup (or use hardcoded defaults). For each `--file` input, call `fs.realpathSync` to canonicalise the path, then check against all allowed directory prefixes. Reject with `MCP_FILE_PATH_RESTRICTED` if none match.

**Why `realpathSync` (vs `path.resolve` used in D1)**: For input files, symlink-following is the risk — a symlink inside `~/Downloads/` pointing to `~/.ssh/` would bypass a prefix check without `realpathSync`. Output sandbox uses `path.resolve` because the file does not yet exist.

**Sub-resource blocking**: In the Playwright request interception layer (`request-guard.ts`), when the render was triggered by a `--file` input, intercept all `file:` sub-resource requests (CSS, JS, iframes) and abort them. The main document `file:` navigation is still permitted.

### D4 — Single signal handler via module-level set

**Decision**: `packages/core/src/temp-registry.ts` exports a `Set<string>` of active temp directories and `registerTempDir`/`releaseTempDir`/`cleanupAll` functions. `process.once('SIGINT'/'SIGTERM')` handlers are installed at module load time (not per render). `renderAnimated` replaces its existing inline handler calls with `registerTempDir`/`releaseTempDir`.

**Why `process.once` at module load**: Node.js does not support removing `once` listeners after the signal fires. Installing once at module load ensures exactly one handler per signal regardless of concurrency. The default `MaxListenersExceededWarning` threshold (10) would not be reached with the single-registration approach.

**MCP entry point**: Imports `temp-registry` on startup to guarantee the handlers are registered before any render begins (Node.js lazy module evaluation could otherwise delay registration).

## Risks / Trade-offs

- **D1: Sandbox breaks existing MCP callers that pass absolute paths outside `~/pixdom-output/`** → Mitigation: the error message includes `PIXDOM_MCP_OUTPUT_DIR` override instructions. Callers must update their prompts or set the env var. This is the intentional breaking surface.
- **D2: `secret-tool` may not be installed on all Linux systems** → Mitigation: explicitly check for binary presence before calling; fall back to plaintext with a printed warning. No crash.
- **D2: Keychain entry survives uninstall** → Mitigation: `pixdom mcp --uninstall` deletes the keychain entry if present (best-effort, no error if absent).
- **D3: `realpathSync` throws if file does not exist** → Mitigation: catch `ENOENT` and return `MCP_FILE_PATH_RESTRICTED` with "file not found" message, consistent with existing missing-file handling.
- **D3: Blocking all sub-resource `file:` requests may break self-contained HTML that inlines external local CSS** → Mitigation: document the limitation. Users can pass `PIXDOM_MCP_ALLOWED_DIRS` to allow additional directories but sub-resource blocking is intentional and cannot be disabled via env var alone (it is a security boundary, not a convenience restriction).
- **D4: `process.once` handlers are not re-registered after they fire** → Mitigation: the handlers call `cleanupAll()` then `process.exit()`, so the process terminates; re-registration is not needed.

## Migration Plan

1. Deploy MCP server update. Existing `output` parameters that pointed outside `~/pixdom-output/` will begin returning `MCP_OUTPUT_PATH_RESTRICTED`.
2. Users who need a different output directory set `PIXDOM_MCP_OUTPUT_DIR` in their MCP server env config (`pixdom mcp --install` output will document this).
3. Users who relied on `--file` with paths outside the default allowlist set `PIXDOM_MCP_ALLOWED_DIRS`.
4. No migration needed for CLI users — all four changes are MCP-path-only or internal (temp registry).
5. Rollback: revert MCP server package; CLI is unaffected.

## Open Questions

- Should `pixdom mcp --uninstall` also purge the keychain entry automatically, or require a separate `--clear-key` flag? (Current plan: purge automatically as part of uninstall for clean removal.)
- On Linux, should `secret-tool` absence be a silent fallback or produce a more visible suggestion to install `libsecret-tools`? (Current plan: print a one-line suggestion, then fall back.)
