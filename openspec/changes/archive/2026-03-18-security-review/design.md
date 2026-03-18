## Context

Pixdom is a CLI tool and MCP server that accepts untrusted inputs — URLs, inline HTML, local file paths, and image files — renders them through a Playwright/Chromium browser, optionally encodes the result via FFmpeg, and writes binary output to a caller-specified path. Each of these I/O boundaries is an attack surface.

A security audit identified 15 vulnerabilities across three tiers:

- **Critical (block publish)**: SSRF via `--url`; output path write; FFmpeg argument injection; Chromium sandbox bypass; Playwright CVE-2025-59288 (binary signature); abandoned fluent-ffmpeg dependency.
- **High (pre-distribution)**: Arbitrary file read via `--html`; resource exhaustion; temp file race conditions; MCP DNS rebinding (CVE-2025-9611).
- **Medium (follow-up)**: Symlink traversal; MCP input validation; dependency audit; secret leakage; supply chain hardening.

Current codebase rule `core-rendering.md rule 8` explicitly requires `--no-sandbox` in Chromium launch args — this rule itself is a vulnerability and must be reversed.

## Goals / Non-Goals

**Goals:**
- Eliminate all Group 1 (Critical) and Group 2 (High) vulnerabilities before npm publish.
- Address Group 3 (Medium) vulnerabilities in the same changeset to avoid a trailing fix-up.
- Maintain full backward compatibility for legitimate valid inputs.
- Preserve the existing render pipeline architecture — no reimplementation of core rendering logic.
- Ship regression-safe changes: each fix verifiable against the static/animated/image render paths.

**Non-Goals:**
- Full authentication / authorisation system for MCP server.
- Rate limiting or per-caller quotas.
- Network egress allowlisting beyond protocol/host validation.
- Changes to output format semantics or CLI UX (beyond new error messages and the `--allow-local` flag).

## Decisions

### D1 — URL validation: parse-time protocol check + DNS resolution check

**Decision**: Validate `--url` at CLI parse time in two steps:
1. Check `new URL(input).protocol` — allow `http:` and `https:` only. Error: `INVALID_URL_PROTOCOL`.
2. Resolve the hostname via `dns.promises.lookup()` and reject if the resolved IP falls in any blocked CIDR: `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, `fc00::/7`. Error: `INVALID_URL_HOST`.
3. Additionally, install a Playwright `page.route('**')` interceptor that re-validates every navigation and sub-resource request against the same rules, catching redirect chains.
4. `--allow-local` flag bypasses the host check (step 2 and 3 host blocking only), with a stderr warning printed at render start.

**Alternatives considered:**
- *Allowlist-only approach (only allow specific domains)*: Too restrictive for a general-purpose renderer; kills legitimate use cases.
- *Validate at Playwright level only (no CLI check)*: Doesn't provide early, user-friendly error messages before the browser launches.
- *Regex on URL string*: Fragile; IPv6 notation, URL encoding, and redirect chains defeat regex.

### D2 — Request interception: single Playwright route handler applied to all input types

**Decision**: Create a `installRequestGuard(page, options)` utility in `packages/core` that attaches a `page.route('**')` handler. The handler checks each request's URL against the protocol/host blocklist. Blocked requests are aborted with `route.abort('blockedbyclient')`. The same utility is called for `--url`, `--html`, and `--file` inputs. The `--allow-local` flag is threaded through `RenderOptions` to the guard.

Additionally set on the browser context:
- `serviceWorkers: 'block'` — prevents persistent malicious SW registration.
- Browser args: `--disable-webrtc`, `--disable-extensions`, `--disable-plugins`, `--disable-background-networking`.

**Alternatives considered:**
- *Per-input-type interceptors*: Code duplication; risk of missing a path.
- *Network interception via OS firewall*: Not portable; out of scope for a CLI tool.

### D3 — Chromium sandbox: reverse the `--no-sandbox` default

**Decision**: Remove `--no-sandbox` and `--disable-setuid-sandbox` from the default Playwright browser launch args in `packages/core`. Gate re-enabling them behind `PIXDOM_NO_SANDBOX=1` environment variable, which prints a visible stderr warning when set.

This directly contradicts current `core-rendering.md rule 8`. That rule must be updated as part of this change.

**Alternatives considered:**
- *Keep --no-sandbox, add other mitigations*: Leaves a sandbox escape vector; unacceptable for a published tool.
- *User flag instead of env var*: Env vars are appropriate for deployment-time configuration (CI systems) vs. per-render flags.

### D4 — Replace fluent-ffmpeg with child_process.spawn()

**Decision**: Rewrite `animated-renderer.ts` to spawn `ffmpeg` (from `ffmpeg-static`) directly using `child_process.spawn(args_array)` — no shell interpolation, no abandoned wrapper. Arguments are built as a string array using explicit values. `ffmpeg-static` is updated to v5.3.0.

Two-pass GIF encoding, MP4, and WebM are each reimplemented as small `spawnFfmpeg(args, onProgress)` helper calls.

Progress parsing: read ffmpeg stderr line by line, match `frame=\s*(\d+)` and `time=(\d+:\d+:\d+\.\d+)` to derive percent when total frame count is known.

**Alternatives considered:**
- *Fork/patch fluent-ffmpeg*: Archived repo; maintenance burden shifts to us permanently.
- *Use a different ffmpeg wrapper (fluent-ffmpeg successor / node-ffmpeg)*: All alternatives are similarly low-maintenance or incomplete; direct spawn is simpler and fully controlled.
- *Remove video output entirely*: Too severe a feature regression.

### D5 — Output path validation: pre-render, not post-render

**Decision**: Validate `--output` at CLI parse time (before browser launch and rendering), not at write time:
1. Resolve to absolute path.
2. Reject if path starts with `/dev/`, `/proc/`, or `/sys/`.
3. Reject shell metacharacters in path: `;`, `&`, `|`, `$`, `` ` ``, `(`, `)`, `<`, `>`, newline.
4. Verify parent directory exists (`fs.statSync`) and is writable (`fs.accessSync(dir, fs.constants.W_OK)`).
5. If output file already exists, print a stderr warning (do not block).

Error code: `INVALID_OUTPUT_PATH`.

**Rationale for parse-time vs write-time**: Failing before a 30–60 second render starts saves user time and avoids partial temp files on disk.

### D6 — Resource limits: Zod refinements at CLI parse

**Decision**: Add Zod `.refine()` validators to the CLI flag schema:
- `--fps`: integer, 1–60. Error: `INVALID_FPS`.
- `--duration`: integer, 100–300000. Error: `INVALID_DURATION`.
- `--width`: integer, 1–7680.
- `--height`: integer, 1–4320.
- Derived frame count (`fps × ceil(duration / 1000)`): cap at 3,600. Error: `RESOURCE_LIMIT_EXCEEDED`.

Sharp pixel limit: call `sharp.limitInputPixels(268402689)` (≈16384²) at module load in `image-renderer.ts`.

Playwright page timeout: set `page.setDefaultNavigationTimeout(30000)` in the render pipeline.

### D7 — Temp file hardening

**Decision**: Temp directories are already named `pixdom-<uuid>` (from `randomUUID()`) and cleaned in `finally`. Harden by:
1. After `fs.mkdir(tmpDir)`, call `fs.chmod(tmpDir, 0o700)`.
2. Register `process.on('SIGTERM', cleanup)` and `process.on('SIGINT', cleanup)` handlers in `renderAnimated()`, where `cleanup` calls `fs.rmSync(tmpDir, { recursive: true, force: true })` and re-raises the signal.
3. The `ffmpegSpawn` helper writes palette and output files inside the same `tmpDir` — no predictable names outside it.

### D8 — MCP server: Origin validation + localhost binding

**Decision**: In `apps/mcp-server`:
1. Set the HTTP server to listen on `127.0.0.1` only (not `0.0.0.0`).
2. Add a middleware layer that checks the `Origin` request header. Allowed values: `http://localhost`, `http://localhost:<port>`, `http://127.0.0.1`, `http://127.0.0.1:<port>`. Additional origins allowed via `PIXDOM_MCP_ALLOWED_ORIGINS` env var (comma-separated). Requests with invalid Origin headers receive `403 Forbidden`.
3. MCP tool inputs pass through the same Zod validation schema used by the CLI before reaching `render()`.

### D9 — Error message hygiene

**Decision**:
- In the error formatter, scan error context objects for keys matching `/key|token|secret|password|api_?key/i` and replace values with `[REDACTED]`.
- When displaying file paths in error messages, call `path.relative(process.cwd(), absPath)` to show relative paths.
- FFmpeg stderr is captured in the `spawnFfmpeg` helper; before appending to the error message, scan for patterns matching `[A-Za-z0-9+/]{20,}` (potential base64 tokens) and redact.

### D10 — Path traversal: realpathSync before use

**Decision**: In CLI validation for `--file` and `--image`, after `path.resolve()`, call `fs.realpathSync()` to follow symlinks to the true path. The resolved path is used for all subsequent checks (extension validation, existence check) and passed to the renderer.

### D11 — Playwright version pin: ≥1.55.1

**Decision**: Update `playwright` in `packages/core/package.json` to `">=1.55.1"`. This fixes CVE-2025-59288 (binary signature bypass during Chromium download).

### D12 — Supply chain: exact pins + SBOM

**Decision**:
- Convert all dependency version specifiers in `package.json` files from `^` / `~` to exact versions.
- Ensure `pnpm-lock.yaml` is committed and CI uses `pnpm install --frozen-lockfile`.
- Add `npm audit` to the build script (non-blocking warn in CI, blocking in publish check).
- Generate SBOM via `cyclonedx-npm` as part of the publish step.

## Risks / Trade-offs

**[Risk] Sandbox removal breaks Docker/CI** → Mitigation: `PIXDOM_NO_SANDBOX=1` env var provides an explicit opt-in escape hatch with a printed warning. Document in README.

**[Risk] DNS resolution adds latency to --url validation** → Mitigation: DNS lookup is fast (sub-100ms on most networks). Acceptable overhead given the security benefit. Lookup happens once before browser launch.

**[Risk] DNS rebinding still possible between lookup and page load** → Mitigation: Playwright request interceptor re-validates on every network request, catching rebind attempts mid-load. Not perfect but eliminates the naive case.

**[Risk] fluent-ffmpeg replacement introduces frame encoding regressions** → Mitigation: Run old and new pipeline on the same test input, compare frame counts and durations in metadata via `ffprobe`. Treat mismatches as blocking before merging.

**[Risk] Exact dependency pins cause downstream version conflicts** → Mitigation: Pixdom is a CLI/MCP server, not a library. Exact pins in `package.json` are appropriate. Users install the tool, not `require()` it.

**[Risk] Sharp pixel limit rejects legitimate large images** → Mitigation: 16384×16384 = 268M pixels is above any social media platform's maximum. Document the limit in the error message so users know why it failed.

**[Risk] Resource limit refinements break existing valid invocations** → Mitigation: All chosen bounds are deliberately above realistic platform maximums. No valid social-media use case requires fps > 60, duration > 5 minutes, or width > 7680.

## Migration Plan

1. All changes are local — no database migrations, no API version bumps.
2. `--no-sandbox` removal: verify the default render pipeline works with sandbox enabled in local Linux environment before merging. If broken, investigate `--disable-setuid-sandbox` as a weaker alternative.
3. fluent-ffmpeg removal: keep the old implementation in a feature branch until regression tests pass on the new spawn-based implementation.
4. Playwright pin: run `pnpm install` after version bump and verify Playwright Chromium download succeeds.
5. Rollback: git revert any individual commit; no state is mutated outside local files.

## Open Questions

- **Q1**: Does `ffmpeg-static` v5.3.0 bundle a sufficiently recent FFmpeg binary? Verify the bundled version's CVE status after update.
- **Q2**: The `PIXDOM_NO_SANDBOX=1` env var — should it be a boolean `"1"` check or accept `"true"`? Recommend: accept both.
- **Q3**: MCP server Origin validation — does the MCP SDK expose raw HTTP headers, or is middleware required? Investigate the MCP server framework's request handling model before implementing.
