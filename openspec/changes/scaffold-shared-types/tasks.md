## 1. Package Scaffold

- [ ] 1.1 Create `packages/types/package.json` with name `@pixdom/types`, `zod` dependency, and ESM+CJS dual exports
- [ ] 1.2 Create `packages/types/tsconfig.json` extending root tsconfig with `declarationDir` and `outDir`
- [ ] 1.3 Create empty `packages/types/src/index.ts` entry point
- [ ] 1.4 Add `packages/types` to `pnpm-workspace.yaml` (if not covered by glob)

## 2. Core Type Definitions

- [ ] 2.1 Implement `RenderInputSchema` discriminated union (`html` / `file` / `url`) and export `RenderInput` type
- [ ] 2.2 Implement `OutputFormatSchema` enum (`png | jpeg | webp | gif | mp4 | webm`) and export `OutputFormat` type
- [ ] 2.3 Implement `ViewportOptionsSchema` with `width`, `height`, `deviceScaleFactor` (default 1) and export `ViewportOptions` type
- [ ] 2.4 Implement `RenderOptionsSchema` composing input, format, viewport, `quality` (0–100), `timeout`, `fps` and export `RenderOptions` type
- [ ] 2.5 Implement `ProfileIdSchema` (`z.enum`) and export `ProfileId` string union
- [ ] 2.6 Implement `ProfileSchema` with all required fields and export `Profile` type
- [ ] 2.7 Implement `AnimationResultSchema` (`{ cycleMs: number | null }`) and export `AnimationResult` type

## 3. Result Generic

- [ ] 3.1 Define `Result<T, E extends { code: string }>` type as a discriminated union
- [ ] 3.2 Implement and export `ok<T>(value: T): Result<T, never>` helper
- [ ] 3.3 Implement and export `err<E extends { code: string }>(error: E): Result<never, E>` helper

## 4. Barrel Export

- [ ] 4.1 Re-export all schemas, types, and helpers from `packages/types/src/index.ts` as named exports (no default export)

## 5. Verification

- [ ] 5.1 Run `tsc --noEmit` in `packages/types` — zero type errors
- [ ] 5.2 Confirm `RenderInputSchema.parse({ type: 'html', html: 'x' })` succeeds at runtime
- [ ] 5.3 Confirm `ProfileIdSchema.parse('tiktok')` throws a `ZodError`
- [ ] 5.4 Confirm `err({ message: 'x' })` (missing `code`) is a TypeScript compile error
