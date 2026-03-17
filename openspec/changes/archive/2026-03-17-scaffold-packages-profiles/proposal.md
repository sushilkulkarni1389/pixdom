## Why

`packages/core` needs a way to resolve platform-specific output settings (dimensions, format, quality) from a short identifier like `'instagram'` without embedding those constants inline. `packages/profiles` is the canonical home for these presets, and it must exist before core can delegate to it.

## What Changes

- New `packages/profiles` workspace package (`@pixdom/profiles`) exporting 4 frozen platform presets and a `getProfile` lookup function
- Presets: `instagram`, `twitter`, `linkedin`, `square` — each with `id`, `width`, `height`, `format`, `quality`, and optional `fps`
- All values typed against `Profile` and `ProfileId` from `@pixdom/types`
- Zero runtime dependencies beyond `@pixdom/types`

## Capabilities

### New Capabilities

- `platform-profiles`: The 4 platform preset objects, a typed `PROFILES` map, and a `getProfile(id: ProfileId): Profile` lookup function

### Modified Capabilities

## Impact

- New package `packages/profiles` — consumed by `packages/core` and the CLI
- Depends on `@pixdom/types` for `Profile`, `ProfileId`, and `OutputFormat` types
- No external runtime dependencies
