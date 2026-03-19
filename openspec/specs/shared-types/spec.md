## ADDED Requirements

### Requirement: Package scaffold
`packages/types` SHALL be a valid pnpm workspace package named `@pixdom/types` with `package.json`, `tsconfig.json`, and `src/index.ts`. It SHALL have `zod` as its only dependency and zero monorepo-internal imports.

#### Scenario: Package resolves in workspace
- **WHEN** another package declares `"@pixdom/types": "workspace:*"` in its dependencies
- **THEN** TypeScript resolves all named exports from `packages/types/src/index.ts`

#### Scenario: No circular imports
- **WHEN** `packages/types/src/index.ts` is statically analysed
- **THEN** no import path resolves to another `packages/*` or `apps/*` workspace package

### Requirement: RenderInput discriminated union
`packages/types` SHALL export a `RenderInputSchema` Zod schema and a `RenderInput` TypeScript type representing three mutually exclusive input modes: `html` (inline string), `file` (local path), and `url` (remote URL). The discriminant field SHALL be `type`.

#### Scenario: HTML input parses correctly
- **WHEN** `RenderInputSchema.parse({ type: 'html', html: '<h1>Hi</h1>' })` is called
- **THEN** it returns `{ type: 'html', html: '<h1>Hi</h1>' }` without error

#### Scenario: Invalid input variant is rejected
- **WHEN** `RenderInputSchema.parse({ type: 'clipboard' })` is called
- **THEN** Zod throws a `ZodError` with a discriminator error on `type`

### Requirement: OutputFormat string union
`packages/types` SHALL export an `OutputFormatSchema` Zod schema and `OutputFormat` type covering `png | jpeg | webp | gif | mp4 | webm`.

#### Scenario: Valid format accepted
- **WHEN** `OutputFormatSchema.parse('webp')` is called
- **THEN** it returns `'webp'`

#### Scenario: Unknown format rejected
- **WHEN** `OutputFormatSchema.parse('bmp')` is called
- **THEN** Zod throws a `ZodError`

### Requirement: ViewportOptions interface
`packages/types` SHALL export a `ViewportOptionsSchema` and `ViewportOptions` type with fields `width: number`, `height: number`, and optional `deviceScaleFactor: number` (default 1).

#### Scenario: Default deviceScaleFactor applied
- **WHEN** `ViewportOptionsSchema.parse({ width: 1080, height: 1080 })` is called
- **THEN** the result includes `deviceScaleFactor: 1`

### Requirement: RenderOptions interface
`packages/types` SHALL export a `RenderOptionsSchema` and `RenderOptions` type composing `RenderInput`, `OutputFormat`, `ViewportOptions`, and optional fields: `quality: number` (0–100), `timeout: number` (ms), `fps: number`.

#### Scenario: Full options round-trip
- **WHEN** a fully-specified `RenderOptions` object is passed to `RenderOptionsSchema.parse()`
- **THEN** it returns the same object without mutation

#### Scenario: Quality out of range rejected
- **WHEN** `RenderOptionsSchema.parse({ ..., quality: 150 })` is called
- **THEN** Zod throws a `ZodError` on the `quality` field

### Requirement: Profile interface and ProfileId union
`packages/types` SHALL export a `ProfileSchema`, `Profile` type, `ProfileIdSchema`, and `ProfileId` string union type. `ProfileId` SHALL be `'instagram' | 'twitter' | 'linkedin' | 'square'`. `Profile` SHALL include `id: ProfileId`, `width: number`, `height: number`, `format: OutputFormat`, `quality: number`, and optional `fps: number`.

#### Scenario: Valid ProfileId accepted
- **WHEN** `ProfileIdSchema.parse('instagram')` is called
- **THEN** it returns `'instagram'`

#### Scenario: Invalid ProfileId rejected
- **WHEN** `ProfileIdSchema.parse('tiktok')` is called
- **THEN** Zod throws a `ZodError`

### Requirement: AnimationResult type
`packages/types` SHALL export an `AnimationResultSchema` and `AnimationResult` type representing `{ cycleMs: number | null }`.

#### Scenario: Static page result valid
- **WHEN** `AnimationResultSchema.parse({ cycleMs: null })` is called
- **THEN** it returns `{ cycleMs: null }`

#### Scenario: Animated page result valid
- **WHEN** `AnimationResultSchema.parse({ cycleMs: 1200 })` is called
- **THEN** it returns `{ cycleMs: 1200 }`

### Requirement: Result generic type
`packages/types` SHALL export a `Result<T, E extends { code: string }>` TypeScript generic type representing `{ ok: true; value: T } | { ok: false; error: E }`. Helper constructors `ok(value)` and `err(error)` SHALL also be exported.

#### Scenario: Success result constructed
- **WHEN** `ok('/output/render.png')` is called
- **THEN** it returns `{ ok: true, value: '/output/render.png' }`

#### Scenario: Error result requires code field
- **WHEN** TypeScript compiles `err({ message: 'failed' })` without a `code` field
- **THEN** the compiler emits a type error

### Requirement: Named exports only
`packages/types/src/index.ts` SHALL use only named exports. No default export SHALL be present.

#### Scenario: Default import fails at compile time
- **WHEN** a consumer writes `import Types from '@pixdom/types'`
- **THEN** TypeScript emits a module-has-no-default-export error
