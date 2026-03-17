# Pixdom Progress

## 2026-03-17

### Completed Changes

All core packages and apps scaffolded and archived.

#### `scaffold-packages-detector`
- `packages/detector` — animation cycle detection via CSS duration query + MutationObserver rAF sampling
- Exports `detectAnimationCycle(page): Promise<number | null>`
- MutationObserver approach correctly avoids false positives on static pages (requires ≥3 mutations)

#### `scaffold-packages-profiles`
- `packages/profiles` — four frozen platform presets: Instagram (1080×1080), Twitter (1200×675), LinkedIn (1200×627), Square (800×800)
- Exports `PROFILES`, `getProfile(id)`, and individual named presets

#### `scaffold-packages-core`
- `packages/core` — Playwright-based rendering engine
- `render(options): Promise<Result<Buffer, RenderError>>` routes to static (PNG/JPEG/WebP via Sharp) or animated (GIF/MP4/WebM via FFmpeg) renderer
- Browser always closed in `finally`; all errors returned as `Result.err`, never thrown

#### `scaffold-apps-cli`
- `apps/cli` — Commander.js CLI (`pixdom convert`)
- Flags: `--html`, `--file`, `--url`, `--profile`, `--format`, `--width`, `--height`, `--quality`, `--output`
- Profile fills defaults; individual flags override; input mutex enforced
- Entry via `tsx` child process spawn in `bin/pixdom.js`

#### `scaffold-apps-mcp-server`
- `apps/mcp-server` — stdio MCP server via `@modelcontextprotocol/sdk`
- **`convert_html_to_asset`** — Zod-validated HTML → render → output file, returns `{ path, format, width, height }`
- **`generate_and_convert`** — prompt → Claude API (Haiku) → HTML → render → output file
- System prompt loaded from `.claude/context/claude-integration.md` at startup with hardcoded fallback
- All handler errors caught and returned as `{ isError: true }` MCP results

### Current Package Graph

```
@pixdom/types       ← shared Zod schemas, Result<T,E>
@pixdom/detector    ← animation cycle detection (depends: playwright)
@pixdom/profiles    ← platform presets (depends: @pixdom/types)
@pixdom/core        ← render engine (depends: @pixdom/types, @pixdom/detector, @pixdom/profiles)
pixdom (apps/cli)   ← CLI (depends: @pixdom/core, @pixdom/profiles, @pixdom/types)
@pixdom/mcp-server  ← MCP server (depends: @pixdom/core, @pixdom/profiles, @pixdom/types)
```
