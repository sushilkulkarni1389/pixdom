# Layer 10 — Testing & QA
Load ONLY when working on Layer 10 — Testing & QA tasks.

## Goal
≥ 80% unit test coverage across `packages/*`, integration tests for CLI and MCP server, CI-ready Vitest config.

## Test File Locations

```
packages/types/src/result.test.ts
packages/types/src/env.test.ts
packages/profiles/src/registry.test.ts
packages/detector/src/cycle-estimator.test.ts
packages/detector/src/fallback-chain.test.ts
packages/core/src/loader.test.ts
packages/core/src/processor.test.ts
apps/cli/src/commands/convert.test.ts     # integration — uses execa
apps/mcp-server/src/handlers/convert.handler.test.ts
```

## Mocking Rules

- **Mock**: Playwright (`playwright`), FFmpeg (`fluent-ffmpeg`), Sharp (`sharp`), Anthropic SDK, `node:fs`
- **Never mock**: internal modules within the same package
- Use `vi.mock('playwright', ...)` — NOT `vi.mock('./browser.ts')`

## Per-Function Test Structure

```typescript
describe('functionName', () => {
  it('happy path: [description]', async () => { ... })
  it('error: [error condition 1]', async () => { ... })
  it('error: [error condition 2]', async () => { ... })
})
```

## Coverage Thresholds (`vitest.config.ts`)

```typescript
coverage: {
  provider: 'v8',
  thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
  include: ['packages/*/src/**'],
  exclude: ['**/*.test.ts', 'packages/types/src/index.ts'],
}
```

## Hard Rules

- No test may call real Playwright, FFmpeg, or Anthropic API — all must be mocked
- Integration tests for CLI use `execa` to invoke compiled binary — not source import
- `vi.clearAllMocks()` in `afterEach` — no test state leaks

## Definition of Done

- `pnpm test --coverage` exits 0
- Line coverage ≥ 80% in all `packages/*`
- Each public function in `packages/core`, `packages/detector`, `packages/profiles` has 1 happy + 2 error tests
- `apps/cli` integration test: render to temp file, assert file exists and is non-zero bytes
- `apps/mcp-server` handler test: mocked `render()` returns error → handler returns `{ isError: true }`
