## Why

Pixdom processes untrusted inputs (URLs, HTML strings, file paths, image files) through a browser engine and FFmpeg pipeline and writes output to user-specified paths. Fifteen distinct vulnerabilities — ranging from confirmed SSRF/LFI via `--url file://` to an abandoned dependency with no future patches — must be resolved before npm publish, as they expose local file systems, internal networks, and cloud metadata endpoints to any caller of the CLI or MCP server.

## What Changes

- **URL validation**: Restrict `--url` to http/https only; block loopback, private RFC1918, and link-local hosts; intercept redirects to blocked destinations. Add `--allow-local` opt-in flag for development.
- **Request interception**: Install Playwright request interceptor for all input types (--url, --html, --file) to abort navigation to blocked protocols/hosts.
- **Browser hardening**: Disable Service Workers, WebRTC, extensions, plugins, and background networking in the Playwright browser context; enforce Chromium sandbox (remove `--no-sandbox` default; gate behind `PIXDOM_NO_SANDBOX=1` env var).
- **Output path validation**: Validate `--output` at parse time — reject `/dev/`, `/proc/`, `/sys/`; verify parent directory exists and is writable; warn on overwrite.
- **Path traversal prevention**: Resolve `--file` and `--image` to real absolute paths via `fs.realpathSync()` before use.
- **FFmpeg argument validation**: Validate `--fps` (1–60) and `--duration` (100–300000 ms) as numeric integers; reject shell metacharacters in `--output`.
- **Resource limits**: Enforce hard bounds on `--fps`, `--duration`, `--width`, `--height`; cap derived frame count at 3,600; set Sharp pixel limit.
- **Temp file hardening**: Use `crypto.randomBytes`-named temp directories with `0o700` permissions; guarantee cleanup on SIGTERM/SIGINT.
- **Replace fluent-ffmpeg**: Rewrite animated renderer to use `child_process.spawn()` with explicit argument arrays, eliminating the abandoned library and definitively preventing shell injection. Update `ffmpeg-static` to v5.3.0.
- **Playwright version pin**: Bump to ≥1.55.1 to fix CVE-2025-59288 (binary signature bypass).
- **MCP server hardening**: Validate Origin header; bind to 127.0.0.1 only; apply same input validation layer as CLI.
- **Error message hygiene**: Scrub secrets and absolute paths from error output; prevent raw FFmpeg stderr containing credentials from reaching users.
- **New error codes**: `INVALID_URL_PROTOCOL`, `INVALID_URL_HOST`, `INVALID_OUTPUT_PATH`, `INVALID_FPS`, `INVALID_DURATION`, `RESOURCE_LIMIT_EXCEEDED`.
- **Supply chain**: Exact dependency pins, frozen lockfile, SBOM generation, `npm audit` in build pipeline.

## Capabilities

### New Capabilities

- `url-validation`: Protocol and host validation for `--url` inputs, including private/loopback IP blocking and redirect interception. Covers `--allow-local` flag.
- `request-interception`: Playwright-level request blocking for all input types, including Service Worker and WebRTC hardening.
- `output-path-validation`: Pre-render validation of `--output` path — parent directory existence, writability, dangerous path rejection, overwrite warning.
- `resource-limits`: Hard bounds on `--fps`, `--duration`, `--width`, `--height`, derived frame count, and Sharp pixel limit.
- `ffmpeg-spawn`: Direct `child_process.spawn()` FFmpeg integration replacing fluent-ffmpeg, with explicit argument arrays.
- `temp-file-security`: Random-named temp directories, restrictive permissions, guaranteed cleanup on exit signals.
- `mcp-origin-validation`: MCP server Origin header enforcement and localhost-only binding (CVE-2025-9611).

### Modified Capabilities

- `cli-convert-command`: New flags (`--allow-local`), new validation rules (fps/duration/width/height limits, output path checks, file real-path resolution), new error codes.
- `render-pipeline`: Request interception wired through all render paths; Playwright browser launch args changed (sandbox enforcement, browser hardening flags).
- `animated-renderer`: fluent-ffmpeg replaced with `child_process.spawn()`; temp file hardening applied.
- `mcp-convert-tool`: Input validation layer applied; Origin header checked; interface bound to 127.0.0.1.
- `mcp-generate-tool`: Same input validation layer and binding changes as mcp-convert-tool.
- `error-formatter`: Secret scrubbing; relative path output; FFmpeg stderr sanitisation before display.

## Impact

- **`packages/core`**: `animated-renderer.ts` (fluent-ffmpeg removal, spawn rewrite, temp hardening), `static-renderer.ts` (request interception hook), `image-renderer.ts` (Sharp pixel limit), browser launch configuration, new validation utilities.
- **`apps/cli`**: `index.ts` / `convert.ts` (Zod validation additions, new flags), `errors.ts` (new error codes).
- **`apps/mcp-server`**: Origin header middleware, 127.0.0.1 binding, input validation pass-through.
- **`packages/types`**: New error code literals added to the error type union.
- **Dependencies**: `playwright` pinned to ≥1.55.1; `fluent-ffmpeg` removed; `ffmpeg-static` updated to v5.3.0.
- **Breaking**: None for users passing valid inputs. Users relying on `--url file://` or `--url http://localhost` without `--allow-local` will receive new error messages.
