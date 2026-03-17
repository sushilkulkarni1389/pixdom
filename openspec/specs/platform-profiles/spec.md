# platform-profiles — requirements

### Requirement: Package scaffold
`packages/profiles` SHALL be a valid pnpm workspace package named `@pixdom/profiles` with `package.json`, `tsconfig.json`, and `src/index.ts`. It SHALL declare `@pixdom/types` as its only workspace dependency and have zero external runtime dependencies.

#### Scenario: Package resolves in workspace
- **WHEN** another package declares `"@pixdom/profiles": "workspace:*"` in its dependencies
- **THEN** TypeScript resolves all named exports from `packages/profiles/src/index.ts`

#### Scenario: No circular imports
- **WHEN** `packages/profiles/src/index.ts` is statically analysed
- **THEN** no import path resolves to another `packages/*` or `apps/*` workspace package except `@pixdom/types`

### Requirement: Four frozen platform presets
`packages/profiles` SHALL export four named constants — `INSTAGRAM`, `TWITTER`, `LINKEDIN`, `SQUARE` — each satisfying the `Profile` type from `@pixdom/types` and frozen via `Object.freeze()` at module evaluation time.

#### Scenario: Instagram preset has correct shape
- **WHEN** `INSTAGRAM` is imported from `@pixdom/profiles`
- **THEN** it equals `{ id: 'instagram', width: 1080, height: 1080, format: 'webp', quality: 90 }`

#### Scenario: Twitter preset has correct shape
- **WHEN** `TWITTER` is imported from `@pixdom/profiles`
- **THEN** it equals `{ id: 'twitter', width: 1200, height: 675, format: 'webp', quality: 85 }`

#### Scenario: LinkedIn preset has correct shape
- **WHEN** `LINKEDIN` is imported from `@pixdom/profiles`
- **THEN** it equals `{ id: 'linkedin', width: 1200, height: 627, format: 'webp', quality: 85 }`

#### Scenario: Square preset has correct shape
- **WHEN** `SQUARE` is imported from `@pixdom/profiles`
- **THEN** it equals `{ id: 'square', width: 800, height: 800, format: 'png', quality: 100 }`

#### Scenario: Preset is immutable at runtime
- **WHEN** a consumer attempts to assign `INSTAGRAM.width = 9999`
- **THEN** the assignment is silently ignored in non-strict mode and throws in strict mode (Object.freeze behaviour)

### Requirement: PROFILES record
`packages/profiles` SHALL export a `PROFILES` constant typed as `Record<ProfileId, Profile>` containing all four presets keyed by their `id`.

#### Scenario: Lookup by ProfileId key
- **WHEN** `PROFILES['twitter']` is accessed
- **THEN** it returns the same object reference as `TWITTER`

#### Scenario: All ProfileId keys present
- **WHEN** the keys of `PROFILES` are enumerated
- **THEN** they equal `['instagram', 'twitter', 'linkedin', 'square']` (order-independent)

### Requirement: getProfile lookup function
`packages/profiles` SHALL export a function `getProfile(id: ProfileId): Profile` that returns the matching preset for the given `ProfileId`.

#### Scenario: Valid id returns correct profile
- **WHEN** `getProfile('linkedin')` is called
- **THEN** it returns the `LINKEDIN` preset object

#### Scenario: TypeScript rejects invalid id
- **WHEN** TypeScript compiles `getProfile('tiktok')`
- **THEN** the compiler emits a type error (argument not assignable to `ProfileId`)

### Requirement: Named exports only
`packages/profiles/src/index.ts` SHALL use only named exports. No default export SHALL be present.

#### Scenario: Default import fails at compile time
- **WHEN** a consumer writes `import Profiles from '@pixdom/profiles'`
- **THEN** TypeScript emits a module-has-no-default-export error
