## Context

`packages/profiles` currently exports four frozen profile objects (`INSTAGRAM`, `TWITTER`, `LINKEDIN`, `SQUARE`) and a `PROFILES` record keyed by the four `ProfileId` slugs. `ProfileSlug` in `@pixdom/types` is a union of those four strings. `apps/cli` hardcodes the same four values as the `--profile` choices list, and the `cli-autocomplete` module echoes them as tab-completion candidates.

The registry needs to grow to ~20 canonical slugs covering the full range of per-platform asset types, plus three legacy alias slugs. The `Profile` type needs `label` and `group` fields to enable grouped display in CLI help output and the completion module.

## Goals / Non-Goals

**Goals:**
- Expand `ProfileSlug` to cover all new canonical slugs and the three legacy aliases
- Add `label` and `group` fields to the `Profile` type
- Export `groupedProfiles()` returning `Record<string, Profile[]>` keyed by platform group
- Export `resolveProfile(slug: ProfileSlug): Profile` that handles both canonical slugs and legacy aliases
- Update `apps/cli` `--profile` help to list slugs grouped by platform
- Update the `cli-autocomplete` module's static profile slug list

**Non-Goals:**
- Removing `getProfile()` in this change (deprecated but not deleted — callers still work)
- Adding animated format defaults to the profile type (out of scope)
- External-API-driven profile resolution (profiles remain static data)
- Validating that a profile's format matches its dimensions (no cross-field validation added)

## Decisions

### 1. Extend `ProfileSlug` union rather than replace `ProfileId`
**Decision**: Keep `ProfileId` as the union type in `@pixdom/types` (rename conceptually to include all slugs) and add every new slug plus the three legacy aliases to the same union.

**Rationale**: Renaming `ProfileId` to `ProfileSlug` would be a breaking TypeScript change for any consumer that has `ProfileId` in explicit type annotations. Extending the existing union is additive and fully backwards-compatible.

**Alternative considered**: Introduce a separate `LegacyProfileId` union and a `ProfileSlug = ProfileId | LegacyProfileId` union — rejected as unnecessary indirection given all slugs route through `resolveProfile()`.

### 2. Legacy aliases resolved in `resolveProfile()`, not as separate `Profile` objects
**Decision**: `resolveProfile('instagram')` returns the `instagram-post-square` profile object. Legacy slugs do NOT appear as keys in `PROFILES` or in `groupedProfiles()` output.

**Rationale**: Keeping legacy slugs out of the profile registry ensures `groupedProfiles()` produces clean, deduplicated lists for display. The CLI help and autocomplete show only canonical slugs. Legacy resolution is a pure lookup table in `resolveProfile()`.

**Alternative considered**: Store legacy profiles as full `Profile` objects with a `legacy: true` flag — rejected because it complicates rendering of grouped help output and the completion module.

### 3. `Profile` gains `label` and `group` fields
**Decision**: Add `label: string` (e.g. `"Instagram Post (Square)"`) and `group: string` (e.g. `"instagram"`) as required fields on the `Profile` type.

**Rationale**: The CLI `--help` for `--profile` should show slugs grouped by platform. Without `group` and `label` in the data model, `apps/cli` would have to hard-code a second lookup table to reconstruct grouping. Putting it in the profile data makes it the single source of truth.

**Alternative considered**: Derive group from slug prefix via string split — rejected because it ties the data model to the naming convention and breaks for `square` (no platform prefix).

### 4. Static slug list in `cli-autocomplete`, not imported from `@pixdom/profiles`
**Decision**: The completion module's profile slug array is updated to list all canonical slugs as a static string array (matching the design decision from `cli-autocomplete`). Legacy aliases are intentionally excluded from completion to guide users toward canonical slugs.

**Rationale**: Consistent with the `cli-autocomplete` design doc (Decision 2: static value lists). Importing `PROFILES` at completion-script-emit time is not how `omelette` static mode works.

## Risks / Trade-offs

- **Static list drift (completion vs registry)**: The profile list in the completion module and the profile registry can diverge if a profile is added without updating both. → Mitigation: a comment in the completion source references the `platform-profiles` spec; a lint rule or test that compares `Object.keys(PROFILES)` against the completion list can be added.
- **`label`/`group` are required fields**: Any consumer that constructs a `Profile` object manually (e.g., in tests) will get a TypeScript error until they add the two new fields. → Mitigation: document in migration notes; existing frozen constants will be updated in the same PR.
- **`getProfile()` still callable with legacy slugs**: `getProfile('instagram')` currently returns `INSTAGRAM`. After this change, if `getProfile()` is not updated, it will fail to resolve legacy slugs since `PROFILES` will not contain them as keys. → Mitigation: update `getProfile()` to call `resolveProfile()` internally, or deprecate with a runtime warning. Spec marks it MODIFIED.

## Migration Plan

1. Update `ProfileSlug` union in `packages/types/src/index.ts` (additive — no consumer breakage)
2. Add `label` and `group` to the `Profile` type (TypeScript will flag any incomplete profile objects)
3. Rewrite `packages/profiles/src/index.ts`: new presets, legacy alias map, `resolveProfile()`, `groupedProfiles()`
4. Update `getProfile()` to delegate to `resolveProfile()` for backwards compat
5. Update `apps/cli` `--profile` choices and help text
6. Update completion module static slug list

No data migration needed — profiles are pure static data with no persistence layer.
