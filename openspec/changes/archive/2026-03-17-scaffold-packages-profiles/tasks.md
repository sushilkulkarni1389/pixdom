## 1. Package Scaffold

- [x] 1.1 Create `packages/profiles/package.json` with name `@pixdom/profiles`, `@pixdom/types` workspace dependency, and ESM+CJS dual exports
- [x] 1.2 Create `packages/profiles/tsconfig.json` extending root tsconfig with `declarationDir` and `outDir`
- [x] 1.3 Create `packages/profiles/src/index.ts` (entry point)

## 2. Preset Definitions

- [x] 2.1 Define and export `INSTAGRAM` as a frozen `Profile` object: `{ id: 'instagram', width: 1080, height: 1080, format: 'webp', quality: 90 }`
- [x] 2.2 Define and export `TWITTER` as a frozen `Profile` object: `{ id: 'twitter', width: 1200, height: 675, format: 'webp', quality: 85 }`
- [x] 2.3 Define and export `LINKEDIN` as a frozen `Profile` object: `{ id: 'linkedin', width: 1200, height: 627, format: 'webp', quality: 85 }`
- [x] 2.4 Define and export `SQUARE` as a frozen `Profile` object: `{ id: 'square', width: 800, height: 800, format: 'png', quality: 100 }`

## 3. Lookup API

- [x] 3.1 Export `PROFILES` as `Record<ProfileId, Profile>` containing all four presets keyed by `id`
- [x] 3.2 Export `getProfile(id: ProfileId): Profile` returning the matching preset from `PROFILES`

## 4. Verification

- [x] 4.1 Run `tsc --noEmit` in `packages/profiles` — zero type errors
- [x] 4.2 Confirm each preset has the correct shape (id, width, height, format, quality)
- [x] 4.3 Confirm `Object.freeze()` prevents mutation at runtime
- [x] 4.4 Confirm `getProfile('linkedin')` returns the `LINKEDIN` preset
- [x] 4.5 Confirm `PROFILES['twitter']` returns the same reference as `TWITTER`
