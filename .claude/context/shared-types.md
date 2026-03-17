# Layer 2 — Shared Types
Load ONLY when working on Layer 2 — Shared Types tasks.

## Goal
Define all shared TypeScript interfaces, Zod schemas, env validation, and the `Result<T,E>` type.

## Folder / File Structure to Create

```
packages/types/src/
├── result.ts          # Result<T,E> type + ok() / err() helpers
├── env.ts             # Zod env schema + validated export
├── render.ts          # RenderInput, RenderOptions, RenderOutput
├── profile.ts         # PlatformProfile, ProfileId
├── animation.ts       # AnimationAnalysis, CycleEstimate
├── asset.ts           # AssetFormat, AssetOutput
└── index.ts           # re-exports all
```

## Key Types

### `result.ts`

```typescript
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error })
```

### `render.ts`

```typescript
export type RenderInputType = 'inline' | 'file' | 'url'
export interface RenderInput { type: RenderInputType; value: string }
export interface RenderOptions {
  profile?: ProfileId
  format: AssetFormat
  width?: number
  height?: number
  durationMs?: number     // user-provided animation duration hint
  fps?: number            // default: 30
  outputPath: string
}
export interface RenderOutput {
  outputPath: string
  format: AssetFormat
  widthPx: number
  heightPx: number
  fileSizeBytes: number
  durationMs?: number
}
```

### `profile.ts`

```typescript
export type ProfileId = 'instagram' | 'twitter' | 'linkedin' | 'square'
export interface PlatformProfile {
  id: ProfileId
  displayName: string
  widthPx: number
  heightPx: number
  formats: AssetFormat[]
  maxDurationSeconds: number
  maxFileSizeBytes: number
}
```

### `env.ts` (pattern)

```typescript
import { z } from 'zod'
const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  OUTPUT_DIR: z.string().default('./output'),
})
export const env = EnvSchema.parse(process.env)
```

## Hard Rules

- Zod schemas must match TypeScript types exactly — use `z.infer<typeof Schema>` to derive types
- `Result` type is the only error carrier — never `throw` in packages that export `Result`
- No runtime dependencies in `packages/types` except `zod`

## Definition of Done

- All 6 source files exist and compile with `pnpm typecheck`
- `env.ts` throws a descriptive `ZodError` when `ANTHROPIC_API_KEY` is missing
- `ok()` and `err()` helpers are correctly typed — no `any`
- `packages/types` has zero runtime deps other than `zod`
