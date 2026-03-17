# pixdom — OpenSpec agent context

## Project
Monorepo that converts HTML to platform-ready images (PNG, JPEG, WebP) and
animated assets (GIF, MP4) via a CLI and MCP server.

## Read at every session start (required, in order)
1. `.claude/claude.md`     — master context, hard rules, tech stack
2. `.claude/PROGRESS.md`   — current project state
3. `.claude/ROLES.md`      — role dispatch guide, read before choosing approach

## Load from .claude/context/ (selective — load only the active layer)
Each file covers one package or concern. Load the relevant file before
working on that area. Do not load all files at once.

- `context/monorepo-setup.md`     — workspace config, pnpm, tsconfig
- `context/shared-types.md`       — packages/types interfaces
- `context/platform-profiles.md`  — packages/profiles output presets
- `context/animation-detector.md` — packages/detector logic
- `context/core-rendering.md`     — packages/core Playwright + FFmpeg + Sharp
- `context/cli.md`                — apps/cli Commander.js surface
- `context/mcp-server.md`         — apps/mcp-server MCP tools
- `context/claude-integration.md` — slash commands, Claude Code patterns
- `context/docker.md`             — Dockerfile, Chromium environment
- `context/testing.md`            — test patterns, vitest config

## Rules (auto-triggered by path)
Rules in `.claude/rules/` apply automatically when editing files in their
scope. Do not load them manually — Claude Code triggers them by path match:

- `rules/core-rendering.md`  — applies when editing packages/core
- `rules/mcp-server.md`      — applies when editing apps/mcp-server
- `rules/cli.md`             — applies when editing apps/cli
- `rules/shared-types.md`    — applies when editing packages/types

## Reference files (load explicitly when needed)
- `.claude/SESSION.md`       — session start/end templates
- `.claude/CACHE.md`         — prompt caching strategy
- `.claude/TOKEN-BUDGET.md`  — token cost reference and rtk savings table

## Available slash commands
- `/agentdiff`        — structured diff report for the current session
- `/opsx:propose`     — create a spec proposal before writing code
- `/opsx:apply`       — implement tasks from the active proposal
- `/opsx:archive`     — merge spec deltas and close the proposal

## Monorepo packages
- `packages/core`      — Playwright + FFmpeg + Sharp engine
- `packages/detector`  — animation cycle detection
- `packages/profiles`  — platform output presets
- `packages/types`     — shared TypeScript types
- `apps/cli`           — Commander.js CLI
- `apps/mcp-server`    — MCP server for Claude Code

## OpenSpec workflow
1. `/opsx:propose "description"` — creates proposal before any code is written
2. Review `openspec/changes/<name>/tasks.md` and edit if needed
3. Load the relevant `context/` file for the package being changed
4. `/opsx:apply` — implements tasks one at a time
5. `/opsx:archive` — merges spec deltas into `openspec/specs/`

## Hard rules (inherited from .claude/claude.md)
- Never import across packages without a declared workspace dependency
- Playwright browser instances must always be closed in a finally block
- Never touch `apps/web/` — that is v2 scope
- All output goes to `output/` which is gitignored
- Always use `rtk <cmd>` for: pnpm, vitest, playwright, tsc, git
