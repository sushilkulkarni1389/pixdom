# PROGRESS — pixdom

## Native Task System
At each session start, initialise Claude Code's built-in task system:

- Use `TaskCreate` for every uncompleted task in the active layer
- Use `addBlockedBy` to wire dependencies between tasks
- Tasks persist across `/compact` calls — conversation memory does not
- Sync task status back to this file at session end (✅ / 🔄 / ⏳)
- Never rely on conversation context for task state — always read this file

---

## Current State

| Field | Value |
|---|---|
| ACTIVE LAYER | Layer 2 — Shared Types |
| ACTIVE TASK | scaffold-shared-types (OpenSpec change) |
| STATUS | 🔄 Planning Complete — Implementation Not Started |
| BLOCKED BY | Layer 1 tasks (monorepo scaffold) not yet done |
| LAST SESSION | 2026-03-17 — proposed scaffold-shared-types, all 4 artifacts created |
| LAST COMMIT | 1c84dec — chore: initial pixdom project setup |

---

## Layer Roadmap

| # | Layer Name | Status | Git Tag | Context File |
|---|---|---|---|---|
| 1 | Monorepo Setup | ⏳ Not Started | — | `.claude/context/monorepo-setup.md` |
| 2 | Shared Types | 🔄 Planning Done | — | `.claude/context/shared-types.md` |
| 3 | Platform Profiles | ⏳ Not Started | — | `.claude/context/platform-profiles.md` |
| 4 | Animation Detector | ⏳ Not Started | — | `.claude/context/animation-detector.md` |
| 5 | Core Rendering Engine | ⏳ Not Started | — | `.claude/context/core-rendering.md` |
| 6 | CLI App | ⏳ Not Started | — | `.claude/context/cli.md` |
| 7 | MCP Server | ⏳ Not Started | — | `.claude/context/mcp-server.md` |
| 8 | Claude Code Integration | ⏳ Not Started | — | `.claude/context/claude-integration.md` |
| 9 | Docker & Environment | ⏳ Not Started | — | `.claude/context/docker.md` |
| 10 | Testing & QA | ⏳ Not Started | — | `.claude/context/testing.md` |

---

## Layer Definitions

### Layer 1 — Monorepo Setup
**Goal:** Initialise pnpm workspace with all package scaffolds, root tsconfig, ESLint, Prettier, and Vitest config.
**Context file:** `.claude/context/monorepo-setup.md`
**Role:** implementer
**Git commit:** `feat(layer-1): initialise pnpm monorepo with workspace packages and tooling`

**Tasks:**

- [ ] 1.1 Create root `package.json` with pnpm workspace definition and all scripts
- [ ] 1.2 Create `pnpm-workspace.yaml` listing all apps and packages
- [ ] 1.3 Create root `tsconfig.base.json` with strict settings
- [ ] 1.4 Create per-package `tsconfig.json` extending base
- [ ] 1.5 Create `.eslintrc.cjs` with TypeScript rules
- [ ] 1.6 Create `prettier.config.cjs`
- [ ] 1.7 Create `vitest.config.ts` at root for workspace test runner
- [ ] 1.8 Scaffold `package.json` for each of: `packages/types`, `packages/detector`, `packages/profiles`, `packages/core`, `apps/cli`, `apps/mcp-server`
- [ ] 1.9 Verify `pnpm install` resolves with zero errors

**Definition of Done:**

- `pnpm install` exits 0
- `pnpm -r typecheck` exits 0 on empty stubs
- `pnpm -r lint` exits 0
- `pnpm test` runs and reports 0 tests (no failures)

---

### Layer 2 — Shared Types
**Goal:** Define all shared TypeScript interfaces, Zod schemas, env validation, and the `Result<T,E>` type used across every package.
**Context file:** `.claude/context/shared-types.md`
**Role:** implementer
**Git commit:** `feat(layer-2): add shared types, zod schemas, env validation, and Result type`

**Tasks:**

- [ ] 2.1 Create `packages/types/src/result.ts` — `Result<T,E>` + `ok()` / `err()` helpers
- [ ] 2.2 Create `packages/types/src/env.ts` — Zod schema + validated export for all env vars
- [ ] 2.3 Create `packages/types/src/render.ts` — `RenderInput`, `RenderOptions`, `RenderOutput` interfaces
- [ ] 2.4 Create `packages/types/src/profile.ts` — `PlatformProfile`, `ProfileId` type
- [ ] 2.5 Create `packages/types/src/animation.ts` — `AnimationAnalysis`, `CycleEstimate` interfaces
- [ ] 2.6 Create `packages/types/src/asset.ts` — `AssetFormat`, `AssetOutput` interfaces
- [ ] 2.7 Export all from `packages/types/src/index.ts`
- [ ] 2.8 `pnpm -r typecheck` exits 0

**Definition of Done:**

- All interfaces exported from `@pixdom/types`
- No `any` types — all fields typed
- Zod schemas match TypeScript types (inferred via `z.infer`)
- Env validation throws descriptive error on missing required vars

---

### Layer 3 — Platform Profiles
**Goal:** Implement the four v1 platform output profiles (Instagram, Twitter/X, LinkedIn, Square) as validated, immutable configuration objects.
**Context file:** `.claude/context/platform-profiles.md`
**Role:** implementer
**Git commit:** `feat(layer-3): add platform profiles for Instagram, Twitter, LinkedIn, and Square`

**Tasks:**

- [ ] 3.1 Create `packages/profiles/src/instagram.ts`
- [ ] 3.2 Create `packages/profiles/src/twitter.ts`
- [ ] 3.3 Create `packages/profiles/src/linkedin.ts`
- [ ] 3.4 Create `packages/profiles/src/square.ts`
- [ ] 3.5 Create `packages/profiles/src/registry.ts` — map of `ProfileId → PlatformProfile`
- [ ] 3.6 Create `packages/profiles/src/index.ts` — `getProfile(id)` + `listProfiles()` exports
- [ ] 3.7 Write unit tests: `getProfile` returns correct dimensions, unknown ID returns `err()`

**Definition of Done:**

- All 4 profiles have: `id`, `width`, `height`, `formats[]`, `maxDurationSeconds`, `maxFileSizeBytes`
- `getProfile('unknown')` returns `Result` with `ok: false`
- `pnpm typecheck` and `pnpm test` pass in `packages/profiles`

---

### Layer 4 — Animation Detector
**Goal:** Implement CSS animation and JS-driven animation detection with cycle estimation and a fallback chain for unknown durations.
**Context file:** `.claude/context/animation-detector.md`
**Role:** implementer
**Git commit:** `feat(layer-4): add animation detector with cycle estimation and fallback chain`

**Tasks:**

- [ ] 4.1 Create `packages/detector/src/css-detector.ts` — extract `animation-duration` + `transition` from injected page script
- [ ] 4.2 Create `packages/detector/src/js-detector.ts` — detect `requestAnimationFrame` loops, GSAP, and Web Animations API
- [ ] 4.3 Create `packages/detector/src/cycle-estimator.ts` — compute LCM of detected durations, apply min/max clamp
- [ ] 4.4 Create `packages/detector/src/fallback-chain.ts` — ordered fallback: CSS → JS → user hint → default (3s)
- [ ] 4.5 Create `packages/detector/src/index.ts` — `detectAnimationCycle(page: Page): Promise<Result<CycleEstimate, DetectorError>>`
- [ ] 4.6 Write unit tests for cycle estimator (LCM calculation, clamp behaviour)
- [ ] 4.7 Write integration test with a Playwright page fixture containing known CSS animations

**Definition of Done:**

- `detectAnimationCycle` returns duration within 50ms of actual for CSS-only animations
- Returns fallback value (3000ms) for pages with no detectable animation
- LCM correctly computed for ≥ 2 animation durations
- All tests pass

---

### Layer 5 — Core Rendering Engine
**Goal:** Implement the full rendering pipeline: HTML input → Playwright capture → Sharp (static) or FFmpeg (animated) → `RenderOutput`.
**Context file:** `.claude/context/core-rendering.md`
**Role:** implementer
**Git commit:** `feat(layer-5): add core rendering engine with static and animated output pipelines`

**Tasks:**

- [ ] 5.1 Create `packages/core/src/browser.ts` — Playwright browser pool (launch, reuse, close)
- [ ] 5.2 Create `packages/core/src/loader.ts` — resolve `RenderInput` to HTML string (inline | file | URL)
- [ ] 5.3 Create `packages/core/src/screenshot.ts` — single-frame PNG capture with viewport sizing
- [ ] 5.4 Create `packages/core/src/frame-capture.ts` — multi-frame capture loop for animated output
- [ ] 5.5 Create `packages/core/src/encoder.ts` — FFmpeg frame sequence → GIF / MP4 / WebM
- [ ] 5.6 Create `packages/core/src/processor.ts` — Sharp post-processing: resize, format convert, compress
- [ ] 5.7 Create `packages/core/src/pipeline.ts` — orchestrates loader → browser → capture → encode/process
- [ ] 5.8 Create `packages/core/src/index.ts` — `render(input: RenderInput, options: RenderOptions): Promise<Result<RenderOutput, RenderError>>`
- [ ] 5.9 SIGINT/SIGTERM handlers close browser + kill FFmpeg
- [ ] 5.10 Integration test: render static HTML → PNG, verify file exists and dimensions match

**Definition of Done:**

- `render()` produces a valid PNG for `<h1>Hello</h1>` input
- `render()` produces a valid GIF for HTML with a CSS keyframe animation
- Browser and FFmpeg processes are fully cleaned up after each call
- `render()` returns `err()` (not throws) for invalid HTML or unreachable URL

---

### Layer 6 — CLI App
**Goal:** Implement the full Commander.js CLI with all v1 flags, piped stdin support, progress output, and platform profile selection.
**Context file:** `.claude/context/cli.md`
**Role:** implementer
**Git commit:** `feat(layer-6): add CLI with all v1 flags, stdin support, and platform profiles`

**Tasks:**

- [ ] 6.1 Create `apps/cli/src/commands/convert.ts` — `convert` command with all flags
- [ ] 6.2 Create `apps/cli/src/commands/list-profiles.ts` — `list-profiles` command
- [ ] 6.3 Create `apps/cli/src/input.ts` — resolve CLI args to `RenderInput` (stdin | file | url | --html)
- [ ] 6.4 Create `apps/cli/src/output.ts` — resolve output path, handle `--stdout` flag
- [ ] 6.5 Create `apps/cli/src/progress.ts` — spinner + step labels using `ora`
- [ ] 6.6 Create `apps/cli/src/index.ts` — entrypoint, register commands, handle process exit codes
- [ ] 6.7 Add `bin` field in `apps/cli/package.json`, verify `npx pixdom --help` works
- [ ] 6.8 E2E test: invoke CLI via `execa`, verify output file written

**Definition of Done:**

- `pixdom convert --html "<h1>hi</h1>" --format png --output ./out.png` exits 0 and writes file
- `pixdom convert --url https://example.com --profile twitter --format jpeg` exits 0
- `pixdom list-profiles` prints all 4 profiles in a table
- Unknown flags print usage and exit 1
- `--help` flag shows all options

---

### Layer 7 — MCP Server
**Goal:** Implement the MCP server exposing `convert_html_to_asset` and `generate_and_convert` tools, with full Zod validation and error-safe handlers.
**Context file:** `.claude/context/mcp-server.md`
**Role:** implementer
**Git commit:** `feat(layer-7): add MCP server with convert_html_to_asset and generate_and_convert tools`

**Tasks:**

- [ ] 7.1 Create `apps/mcp-server/src/tools/convert-html-to-asset.ts` — tool definition + Zod input schema
- [ ] 7.2 Create `apps/mcp-server/src/tools/generate-and-convert.ts` — calls Anthropic API to generate HTML, then renders
- [ ] 7.3 Create `apps/mcp-server/src/handlers/convert.handler.ts` — delegates to `packages/core`
- [ ] 7.4 Create `apps/mcp-server/src/handlers/generate.handler.ts` — Claude API call + render pipeline
- [ ] 7.5 Create `apps/mcp-server/src/server.ts` — MCP server setup, tool registration, STDIO transport
- [ ] 7.6 Create `apps/mcp-server/src/index.ts` — entrypoint with cleanup handlers
- [ ] 7.7 Test: simulate MCP tool call with mocked `packages/core`, verify response shape
- [ ] 7.8 Add `mcp-server` entry in root README with `npx` install command

**Definition of Done:**

- Server starts with `node dist/index.js` and responds to MCP `tools/list`
- `convert_html_to_asset` returns `{ content: [{ type: "text", text: "..." }] }` on success
- All tool handlers return `{ isError: true }` on error — no unhandled exceptions
- `generate_and_convert` calls Anthropic API with prompt caching on system message

---

### Layer 8 — Claude Code Integration
**Goal:** Create `.claude/commands/` slash commands and verify end-to-end Claude Code workflow.
**Context file:** `.claude/context/claude-integration.md`
**Role:** implementer
**Git commit:** `feat(layer-8): add Claude Code slash commands for convert and create-post workflows`

**Tasks:**

- [ ] 8.1 Create `.claude/commands/convert.md` — slash command for converting HTML to asset
- [ ] 8.2 Create `.claude/commands/create-post.md` — slash command for generate + convert social post
- [ ] 8.3 Verify MCP server registered in Claude Code settings
- [ ] 8.4 Manual smoke test: `/convert` command in Claude Code produces output file
- [ ] 8.5 Document slash command usage in `apps/mcp-server/README.md`

**Definition of Done:**

- `/project:convert` available in Claude Code and invokes MCP tool
- `/project:create-post` available and completes full generate-and-convert flow
- Both commands include argument descriptions and example invocations

---

### Layer 9 — Docker & Environment
**Goal:** Create Dockerfile with Chromium + FFmpeg, docker-compose for local dev, and environment configuration documentation.
**Context file:** `.claude/context/docker.md`
**Role:** implementer
**Git commit:** `feat(layer-9): add Dockerfile with Chromium and FFmpeg, docker-compose, and env docs`

**Tasks:**

- [ ] 9.1 Create `docker/Dockerfile` — Node 20 + Playwright Chromium + FFmpeg
- [ ] 9.2 Create `docker-compose.yml` — service for MCP server + volume mounts
- [ ] 9.3 Create `.env.example` — all supported env vars with descriptions
- [ ] 9.4 Verify `docker build` succeeds
- [ ] 9.5 Verify `docker-compose up` starts MCP server and responds to health check

**Definition of Done:**

- `docker build -t pixdom .` exits 0
- Container renders a static PNG via CLI (`docker run pixdom convert --html ...`)
- `.env.example` documents every var validated in `packages/types/src/env.ts`

---

### Layer 10 — Testing & QA
**Goal:** Achieve ≥ 80% unit test coverage across `packages/*`, integration tests for CLI and MCP server, and CI-ready test configuration.
**Context file:** `.claude/context/testing.md`
**Role:** qa-agent
**Git commit:** `test(layer-10): add unit and integration test suite with ≥80% coverage`

**Tasks:**

- [ ] 10.1 Unit tests for `packages/types` — Result helpers, env validation error cases
- [ ] 10.2 Unit tests for `packages/profiles` — all 4 profiles, invalid ID, list
- [ ] 10.3 Unit tests for `packages/detector` — LCM, clamp, fallback chain
- [ ] 10.4 Unit tests for `packages/core` — loader (inline/file/URL), processor (format convert)
- [ ] 10.5 Integration test for `apps/cli` — full render to file
- [ ] 10.6 Integration test for `apps/mcp-server` — tool call with mocked core
- [ ] 10.7 Add Vitest coverage thresholds to `vitest.config.ts`
- [ ] 10.8 Verify `pnpm test --coverage` passes all thresholds

**Definition of Done:**

- `pnpm test --coverage` exits 0
- Line coverage ≥ 80% across all `packages/*`
- Each public function has: 1 happy-path test + at least 2 error-path tests
- No `vi.mock` of internal modules — only external dependencies mocked

---

## Decisions Log

| Decision | Rationale |
|---|---|
| `packages/types` uses Zod as sole runtime dep; all TS types derived via `z.infer` | Eliminates manual type/schema duplication; provides free runtime validation at boundaries |
| `RenderInput` is a discriminated union on `type` field | Enables exhaustive routing in `core` without optional-field checks |
| `ProfileId` is a `z.enum` string union, not a TypeScript enum | JSON-serialisable, tree-shakeable, avoids TS enum runtime object |
| `Result<T,E>` requires `code: string` on error payload | Enables programmatic error matching without string-parsing messages |
| `packages/types/src/index.ts` has named exports only — no default export | Consistent tree-shaking and avoids import aliasing across the monorepo |

## Technical Debt Log

| Item | Deferred To | Notes |
|---|---|---|
| | | |
