## Why

`packages/core`, `packages/profiles`, `packages/detector`, `apps/cli`, and `apps/mcp-server` all operate on the same domain objects (render options, output formats, profiles, results) but have no shared contract — each package would independently define incompatible types. Establishing `packages/types` as the single source of truth prevents divergence before any implementation code is written.

## What Changes

- **NEW** `packages/types` package scaffolded with `package.json`, `tsconfig.json`, and `src/index.ts`
- **NEW** `RenderInput` discriminated union (`html`, `file`, `url` variants)
- **NEW** `OutputFormat` string union (`png | jpeg | webp | gif | mp4 | webm`)
- **NEW** `ViewportOptions` interface (width, height, deviceScaleFactor)
- **NEW** `RenderOptions` interface (input, format, viewport, quality, timeout)
- **NEW** `Profile` interface (id, width, height, format, quality, fps)
- **NEW** `ProfileId` string union for the 4 platform presets
- **NEW** `AnimationResult` type (cycleMs: number | null)
- **NEW** `Result<T, E>` generic with `code` field on error payload
- **NEW** Zod schemas for all interfaces (runtime validation at system boundaries)

## Capabilities

### New Capabilities

- `shared-types`: TypeScript interfaces and Zod schemas for all cross-package domain objects in `packages/types`

### Modified Capabilities

<!-- none — no existing spec-level behavior changes -->

## Impact

- All other packages (`core`, `profiles`, `detector`, `cli`, `mcp-server`) will import from `@pixdom/types`
- Zero runtime dependency added to packages that import it (types are erased at compile time); only `packages/types` itself takes a `zod` dependency
- No breaking changes — no existing implementation code exists yet
