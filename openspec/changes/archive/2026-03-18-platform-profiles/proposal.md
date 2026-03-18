## Why

The four generic profile slugs (`instagram`, `twitter`, `linkedin`, `square`) do not capture the diversity of asset types each platform actually requires — a LinkedIn banner, a Twitter video ad, and an Instagram Story are all materially different dimensions and formats. Expanding to a namespaced slug system (`{platform}-{variant}`) gives users precise preset selection without manual dimension lookup, while legacy aliases ensure zero breaking changes for existing callers.

## What Changes

- **New slug format** `{platform}-{variant}` (e.g. `linkedin-post`, `instagram-story`) added to `ProfileSlug` in `@pixdom/types`
- **20 new presets** added to `@pixdom/profiles` across LinkedIn (6), Twitter/X (5), Instagram (7), and generic (1 expanded)
- **3 legacy aliases** (`linkedin → linkedin-post`, `twitter → twitter-post`, `instagram → instagram-post-square`) preserved in the registry — no breaking change
- **`Profile` type** gains two new required fields: `label` (human-readable name) and `group` (platform group string)
- **`groupedProfiles()`** helper exported from `@pixdom/profiles` returning presets keyed by platform group
- **`resolveProfile()`** helper replaces `getProfile()`, resolving both canonical slugs and legacy aliases to a `Profile`
- **`apps/cli`** `--profile` flag choices list and help output updated to enumerate all new slugs grouped by platform
- **`cli-autocomplete`** `--profile` value completion updated to include all new slugs

## Capabilities

### New Capabilities

<!-- No wholly new capability spec files needed — all changes are modifications to existing specs. -->

### Modified Capabilities

- `platform-profiles`: Requirements change for the preset registry (4 → 20+ presets), `Profile` type shape, `PROFILES` record keying, new `groupedProfiles()` and `resolveProfile()` exports, and legacy alias resolution
- `cli-autocomplete`: `--profile` value completion list must change from 4 hardcoded slugs to the full set of canonical slugs (legacy aliases excluded from completion — users should use canonical slugs)
- `cli-convert-command`: `--profile` flag's accepted value set expands to include all new slugs; `--profile invalid-slug` validation error behaviour remains the same

## Impact

- **`packages/types`**: `ProfileSlug` Zod union and `ProfileId` type updated
- **`packages/profiles`**: Full registry rewrite; `getProfile()` deprecated in favour of `resolveProfile()`; new `groupedProfiles()` export
- **`apps/cli`**: `--profile` choices array and help text updated
- **`apps/cli` completion**: Static slug list in completion module updated
- **Consumers of `getProfile()`**: Still callable (no removal), but `resolveProfile()` is preferred
- **No breaking changes**: All four legacy slugs continue to resolve correctly
