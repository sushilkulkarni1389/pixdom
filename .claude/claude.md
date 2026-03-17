# pixdom — Master Context

## What It Does
`pixdom` converts HTML (Claude-generated, hand-written, or fetched from a URL) into
platform-ready static images (PNG, JPEG, WebP) and animated assets (GIF, MP4) with zero
manual steps. It exposes a CLI, an MCP server for Claude Code / Claude.ai, and slash
commands that close the loop between HTML generation and shareable asset delivery.

## Monorepo Structure

```
pixdom/
├── apps/
│   ├── cli/              # Commander.js CLI — primary v1 surface
│   ├── mcp-server/       # MCP server for Claude Code + Claude.ai
│   └── web/              # Next.js web UI (v2, do not touch in v1)
├── packages/
│   ├── core/             # Playwright + FFmpeg + Sharp rendering engine
│   ├── detector/         # Animation detection + cycle estimation
│   ├── profiles/         # Platform output profile definitions
│   └── types/            # Shared TypeScript types and interfaces
├── docker/
│   └── Dockerfile        # Chromium + FFmpeg environment
└── .claude/
    ├── claude.md         # THIS FILE — read every session
    ├── PROGRESS.md       # Project brain — read every session
    ├── SESSION.md        # Copy-paste session templates
    ├── ROLES.md          # Role dispatch guide
    ├── CACHE.md          # Prompt caching strategy
    ├── TOKEN-BUDGET.md   # Token cost reference
    ├── context/          # One file per layer — load only the active one
    └── rules/            # Path-scoped auto-trigger rules
```

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Node.js 20 + TypeScript | Core language |
| Browser | Playwright (Chromium) | Headless HTML rendering |
| Video | FFmpeg (fluent-ffmpeg) | Frame → GIF / MP4 / WebM |
| Image | Sharp | PNG / JPEG / WebP + resize |
| CLI | Commander.js | Terminal interface |
| MCP | @modelcontextprotocol/sdk | Claude Code integration |
| API | Fastify | REST API (v2) |
| Queue | BullMQ + Redis | Async jobs (v2) |
| Web | Next.js 14 App Router | Browser UI (v2) |
| Container | Docker + Compose | Chromium environment |
| Cloud | AWS ECS Fargate | Auto-scaling (v2) |
| Storage | AWS S3 + CloudFront | Asset CDN (v2) |
| Packages | pnpm workspaces | Monorepo management |

## Absolute Hard Rules

1. **Never import across packages without a declared workspace dependency** — no relative `../../packages/` imports.
2. **Playwright browser instances must always be closed in a `finally` block** — no leaked Chromium processes.
3. **FFmpeg child processes must be killed on SIGINT/SIGTERM** — register cleanup handlers in every entry point.
4. **All env vars accessed via `packages/types/src/env.ts` only** — never `process.env.X` inline.
5. **MCP tool handlers must never throw** — catch all errors and return `isError: true` responses.
6. **Sharp and Playwright operations are async — never `.sync` variants** — all image ops use `await`.
7. **Platform profiles are immutable at runtime** — load once at startup, never mutate.
8. **No `any` type** — use `unknown` + type guards. `@ts-ignore` requires a comment explaining why.
9. **All file paths use `node:path`** — never string concatenation for paths.
10. **v2 packages (`apps/web`, BullMQ, Redis, S3) are off-limits until Layer 9+.**

## Code Conventions

- **TypeScript**: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- **Validation**: Zod for all external inputs (CLI flags, MCP tool args, API payloads)
- **Error handling**: `Result<T, E>` pattern (`{ ok: true, value: T } | { ok: false, error: E }`)
- **Env vars**: `import { env } from '@pixdom/types/env'` — Zod-validated at startup
- **Imports**: ESM only (`"type": "module"` in all package.json), `.js` extensions in source
- **Tests**: Vitest — files named `*.test.ts` colocated with source

## Session Start Protocol

1. Run `/model sonnet` (use `/model opus` only for architecture sessions)
2. Read `.claude/claude.md` (this file)
3. Read `.claude/PROGRESS.md` — note ACTIVE TASK and BLOCKED BY
4. Load **only** the context file listed for the active layer
5. Confirm scope with: "I will work on [task]. I will not touch [out-of-scope areas]."
6. **Never speculatively read source files** — reference with `#path/to/file` only when needed

Load nothing else unless PROGRESS.md instructs you to.

## Spec workflow (OpenSpec)
Before implementing any new capability, check `openspec/changes/` for an
active proposal. If none exists, use `/opsx:propose` to create one.
After implementation, run `/opsx:archive` to sync specs.

Living requirements live in `openspec/specs/` — one file per package.
Read the relevant spec file before modifying that package.

## Token rules
Always use `rtk <cmd>` instead of raw commands for:
  pnpm, vitest, playwright, tsc, git
Never run `git diff` raw — use `rtk git diff` or /agentdiff.
Run `rtk gain` at session start to check cumulative savings.
