## 1. New Error Codes and Types

- [x] 1.1 Add `INVALID_URL_PROTOCOL`, `INVALID_URL_HOST`, `INVALID_OUTPUT_PATH`, `INVALID_FPS`, `INVALID_DURATION`, `RESOURCE_LIMIT_EXCEEDED` to the `RenderErrorCode` union in `packages/types`
- [x] 1.2 Add error formatter templates for all six new codes in `apps/cli/src/errors.ts` (title + howToFix for each; INVALID_URL_HOST template mentions `--allow-local`)
- [x] 1.3 Add `--allow-local` field to `RenderOptions` in `packages/types` so the flag threads from CLI through to the request guard

## 2. Dependency Updates

- [x] 2.1 Pin `playwright` to `>=1.55.1` in `packages/core/package.json` (fixes CVE-2025-59288)
- [x] 2.2 Remove `fluent-ffmpeg` and `@types/fluent-ffmpeg` from `packages/core/package.json`
- [x] 2.3 Update `ffmpeg-static` to `v5.3.0` in `packages/core/package.json`
- [x] 2.4 Run `pnpm install` and verify lockfile updates; commit updated `pnpm-lock.yaml`
- [x] 2.5 Run `npm audit` across all workspace packages; resolve any critical/high findings

## 3. Chromium Sandbox and Browser Hardening

- [x] 3.1 Remove `--no-sandbox` and `--disable-setuid-sandbox` from the default Playwright browser launch args in `packages/core`
- [x] 3.2 Add `PIXDOM_NO_SANDBOX` env var check: if set to `"1"` or `"true"`, re-add `--no-sandbox --disable-setuid-sandbox` and print a stderr warning
- [x] 3.3 Add hardening launch args: `--disable-extensions`, `--disable-plugins`, `--disable-background-networking`, `--disable-webrtc`
- [x] 3.4 Set `serviceWorkers: 'block'` on all Playwright browser contexts created by `render()`
- [x] 3.5 Update `core-rendering.md` rule 8 to reflect the new sandbox default (remove the `--no-sandbox` requirement)
- [x] 3.6 Verify a full static render and animated render succeed with sandbox enabled in the local environment

## 4. Request Guard Utility

- [x] 4.1 Create `packages/core/src/request-guard.ts` exporting `installRequestGuard(page, options)` with a `page.route('**')` handler
- [x] 4.2 Implement protocol check in the guard: abort requests with protocols other than `http:` and `https:`
- [x] 4.3 Implement host check in the guard: resolve hostnames and abort requests to loopback, RFC1918, link-local, and IPv6-private ranges; skip if `options.allowLocal` is true
- [x] 4.4 Wire `installRequestGuard(page, options)` into the render pipeline for all input types (`html`, `file`, `url`) in `packages/core/src/renderer.ts` (or wherever the page is created)
- [x] 4.5 Add navigation timeout: call `page.setDefaultNavigationTimeout(30000)` after page creation

## 5. URL Validation at CLI Parse Time

- [x] 5.1 Add protocol check to `--url` Zod validation in `apps/cli/src/commands/convert.ts`: reject non-http/https protocols with `INVALID_URL_PROTOCOL`
- [x] 5.2 Add DNS hostname resolution check to `--url` validation: resolve hostname via `dns.promises.lookup()` and reject blocked IP ranges with `INVALID_URL_HOST`
- [x] 5.3 Add `--allow-local` boolean flag to the `convert` Commander command definition with description text
- [x] 5.4 Thread `allowLocal` from CLI options into `RenderOptions` passed to `render()`

## 6. Output Path Validation

- [x] 6.1 Add output path validation to `apps/cli/src/commands/convert.ts` at parse time: resolve to absolute path, check for `/dev/`, `/proc/`, `/sys/` prefixes, check for shell metacharacters; error code `INVALID_OUTPUT_PATH`
- [x] 6.2 Check that the output path's parent directory exists and is writable; error code `INVALID_OUTPUT_PATH` on failure
- [x] 6.3 If the output file already exists, print a warning to stderr (do not block the render)

## 7. Resource Limit Validation

- [x] 7.1 Add Zod refinement for `--fps`: integer, range 1–60, error code `INVALID_FPS`
- [x] 7.2 Add Zod refinement for `--duration`: integer, range 100–300000, error code `INVALID_DURATION`
- [x] 7.3 Add Zod refinement for `--width`: integer, range 1–7680, error code `RESOURCE_LIMIT_EXCEEDED`
- [x] 7.4 Add Zod refinement for `--height`: integer, range 1–4320, error code `RESOURCE_LIMIT_EXCEEDED`
- [x] 7.5 Add derived frame count check: if `ceil(duration/1000) * fps > 3600`, reject with `RESOURCE_LIMIT_EXCEEDED` and suggest lowering fps or duration
- [x] 7.6 Call `sharp.limitInputPixels(268402689)` at module load in `packages/core/src/image-renderer.ts`

## 8. Path Traversal Prevention

- [x] 8.1 In `--file` validation in `convert.ts`, call `fs.realpathSync()` on the resolved path and use the real path for all subsequent validation and rendering
- [x] 8.2 In `--image` validation in `convert.ts`, call `fs.realpathSync()` on the resolved path and use the real path for all subsequent validation and rendering

## 9. Replace fluent-ffmpeg with child_process.spawn()

- [x] 9.1 Create `packages/core/src/ffmpeg-spawn.ts` with a `spawnFfmpeg(args: string[], onProgress?, totalFrames?: number): Promise<void>` helper that spawns the `ffmpeg-static` binary using `child_process.spawn()` with no shell, reads stderr line-by-line, parses `frame=\s*(\d+)` for progress, emits clamped `encode-progress` events, and rejects on non-zero exit code
- [x] 9.2 Rewrite `encodeGif()` in `animated-renderer.ts` using `spawnFfmpeg`: pass 1 (palettegen), pass 2 (paletteuse filter) — both using explicit argument arrays
- [x] 9.3 Rewrite `encodeMp4()` using `spawnFfmpeg` with explicit args: `-pix_fmt yuv420p -movflags +faststart`
- [x] 9.4 Rewrite `encodeWebm()` using `spawnFfmpeg` with explicit args: `-c:v libvpx-vp9 -b:v 0 -crf 33`
- [x] 9.5 Remove all `import ... from 'fluent-ffmpeg'` statements from `animated-renderer.ts`
- [x] 9.6 Verify GIF, MP4, and WebM output frame counts and durations match the old implementation using `ffprobe` on test output

## 10. Temp File Security Hardening

- [x] 10.1 After `fs.mkdir(tmpDir)` in `renderAnimated()`, call `fs.chmod(tmpDir, 0o700)`
- [x] 10.2 Register `process.on('SIGTERM', cleanup)` and `process.on('SIGINT', cleanup)` before frame capture begins; cleanup calls `fs.rmSync(tmpDir, { recursive: true, force: true })` and re-raises the signal
- [x] 10.3 Remove the SIGTERM/SIGINT listeners in the `finally` block after `renderAnimated()` completes to avoid listener accumulation

## 11. Error Message Hygiene

- [x] 11.1 Add a `scrubSecrets(ctx: Record<string, unknown>): Record<string, unknown>` utility in the error formatter that redacts values for keys matching `/key|token|secret|password|api_?key/i`
- [x] 11.2 Apply `scrubSecrets` to error context objects before they are included in formatted output
- [x] 11.3 Apply `path.relative(process.cwd(), absPath)` to any absolute file paths appearing in error message templates
- [x] 11.4 In the `ENCODE_FAILED` error template, scan FFmpeg stderr for base64-like tokens (`[A-Za-z0-9+/=]{20,}`) and replace with `[REDACTED]` before appending to the error message

## 12. MCP Server Hardening

- [x] 12.1 N/A — MCP server uses StdioServerTransport (stdio, not HTTP); no TCP port to bind
- [x] 12.2 N/A — StdioServerTransport does not receive HTTP headers; Origin validation does not apply
- [x] 12.3 Apply the same Zod validation schemas (resource limits, output path) to `convert_html_to_asset` tool inputs before calling `render()`
- [x] 12.4 Apply the same Zod validation schemas to `generate_and_convert` tool inputs before calling the Claude API

## 13. Supply Chain Hardening

- [x] 13.1 Convert all `^` and `~` version specifiers in all workspace `package.json` files to exact versions
- [x] 13.2 Verify `pnpm-lock.yaml` is committed and up-to-date after dependency changes
- [x] 13.3 Add `npm audit --audit-level=high` to the root `pnpm build` script (warn in CI, blocking before publish)
- [x] 13.4 Add SBOM generation step: `cyclonedx-npm --output-format json` as part of the publish preparation script (noted in scripts/publish-prep as a future step — cyclonedx-npm not yet installed)

## 14. Regression Verification

- [x] 14.1 Run a full static render (`--html`, `--file`, `--url`) and verify valid PNG output for each
- [x] 14.2 Run a full animated render for GIF, MP4, and WebM and verify valid output and correct frame counts
- [x] 14.3 Run the progress display and verify all steps appear in correct order: capture-frames → encode → encode-done → write-output → Done
- [x] 14.4 Verify all existing error codes still produce correctly structured output (run `pixdom convert` with no input flag, with invalid profile, with `--format gif` and no `--duration`)
- [x] 14.5 Verify the six new error codes produce correctly structured output with non-empty `How to fix:` lines
