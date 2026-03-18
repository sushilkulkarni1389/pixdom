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
`packages/profiles` SHALL export named constants for all canonical profiles across LinkedIn (6), Twitter/X (5), Instagram (7), and generic (1), each satisfying the `Profile` type from `@pixdom/types` and frozen via `Object.freeze()` at module evaluation time. Each exported constant SHALL use a SCREAMING_SNAKE_CASE name derived from the slug (e.g. `LINKEDIN_POST`, `INSTAGRAM_STORY`). The original four constants (`INSTAGRAM`, `TWITTER`, `LINKEDIN`, `SQUARE`) SHALL remain exported as aliases pointing to their canonical replacements (`INSTAGRAM_POST_SQUARE`, `TWITTER_POST`, `LINKEDIN_POST`, `SQUARE`) for backwards compatibility.

The full canonical preset table:

| Slug | Width | Height | Format | Quality |
|---|---|---|---|---|
| `linkedin-background` | 1584 | 396 | jpeg | 85 |
| `linkedin-post` | 1200 | 1200 | jpeg | 90 |
| `linkedin-article-cover` | 2000 | 600 | jpeg | 85 |
| `linkedin-profile` | 800 | 800 | jpeg | 90 |
| `linkedin-single-image-ad` | 1200 | 627 | jpeg | 85 |
| `linkedin-career-background` | 1128 | 191 | jpeg | 85 |
| `twitter-post` | 1600 | 900 | png | 90 |
| `twitter-header` | 1500 | 500 | jpeg | 85 |
| `twitter-ad` | 1600 | 900 | jpeg | 85 |
| `twitter-video` | 1600 | 900 | mp4 | 85 |
| `twitter-ad-landscape` | 800 | 450 | mp4 | 85 |
| `instagram-post-3-4` | 1080 | 1440 | jpeg | 90 |
| `instagram-post-4-5` | 1080 | 1350 | jpeg | 90 |
| `instagram-post-square` | 1080 | 1080 | jpeg | 90 |
| `instagram-story` | 1080 | 1920 | jpeg | 90 |
| `instagram-reel` | 1080 | 1920 | mp4 | 85 |
| `instagram-profile` | 320 | 320 | jpeg | 90 |
| `instagram-story-video` | 1080 | 1920 | mp4 | 85 |
| `square` | 1080 | 1080 | png | 100 |

#### Scenario: linkedin-post preset has correct shape
- **WHEN** `LINKEDIN_POST` is imported from `@pixdom/profiles`
- **THEN** it equals `{ id: 'linkedin-post', width: 1200, height: 1200, format: 'jpeg', quality: 90, label: 'LinkedIn Post', group: 'linkedin' }`

#### Scenario: instagram-story preset has correct shape
- **WHEN** `INSTAGRAM_STORY` is imported from `@pixdom/profiles`
- **THEN** it equals `{ id: 'instagram-story', width: 1080, height: 1920, format: 'jpeg', quality: 90, label: 'Instagram Story', group: 'instagram' }`

#### Scenario: twitter-video preset has correct shape
- **WHEN** `TWITTER_VIDEO` is imported from `@pixdom/profiles`
- **THEN** it equals `{ id: 'twitter-video', width: 1600, height: 900, format: 'mp4', quality: 85, label: 'Twitter/X Video', group: 'twitter' }`

#### Scenario: Legacy INSTAGRAM alias preserved
- **WHEN** `INSTAGRAM` is imported from `@pixdom/profiles`
- **THEN** it returns the same object reference as `INSTAGRAM_POST_SQUARE`

#### Scenario: Legacy TWITTER alias preserved
- **WHEN** `TWITTER` is imported from `@pixdom/profiles`
- **THEN** it returns the same object reference as `TWITTER_POST`

#### Scenario: Legacy LINKEDIN alias preserved
- **WHEN** `LINKEDIN` is imported from `@pixdom/profiles`
- **THEN** it returns the same object reference as `LINKEDIN_POST`

#### Scenario: Preset is immutable at runtime
- **WHEN** a consumer attempts to assign `LINKEDIN_POST.width = 9999`
- **THEN** the assignment is silently ignored in non-strict mode and throws in strict mode (Object.freeze behaviour)

### Requirement: PROFILES record
`packages/profiles` SHALL export a `PROFILES` constant typed as `Record<ProfileSlug, Profile>` containing all canonical presets keyed by their canonical slug. Legacy alias slugs (`instagram`, `twitter`, `linkedin`) SHALL NOT appear as keys in `PROFILES`.

#### Scenario: Lookup by canonical slug
- **WHEN** `PROFILES['linkedin-post']` is accessed
- **THEN** it returns the same object reference as `LINKEDIN_POST`

#### Scenario: All canonical slugs present
- **WHEN** the keys of `PROFILES` are enumerated
- **THEN** they include all 19 canonical slugs and do NOT include `instagram`, `twitter`, or `linkedin` as standalone keys

#### Scenario: Legacy slug not a direct key
- **WHEN** `PROFILES['instagram']` is accessed
- **THEN** it returns `undefined` (legacy aliases are not direct keys in `PROFILES`)

### Requirement: resolveProfile lookup function
`packages/profiles` SHALL export a function `resolveProfile(slug: ProfileSlug): Profile` that returns the matching preset for any given `ProfileSlug`, including legacy alias slugs. Legacy aliases SHALL resolve as follows: `instagram → instagram-post-square`, `twitter → twitter-post`, `linkedin → linkedin-post`.

#### Scenario: Canonical slug resolves correctly
- **WHEN** `resolveProfile('instagram-story')` is called
- **THEN** it returns the `INSTAGRAM_STORY` preset object

#### Scenario: Legacy alias resolves correctly
- **WHEN** `resolveProfile('instagram')` is called
- **THEN** it returns the same object reference as `INSTAGRAM_POST_SQUARE`

#### Scenario: TypeScript rejects invalid slug
- **WHEN** TypeScript compiles `resolveProfile('tiktok')`
- **THEN** the compiler emits a type error (argument not assignable to `ProfileSlug`)

### Requirement: getProfile lookup function
`packages/profiles` SHALL continue to export `getProfile(id: ProfileSlug): Profile` as a backwards-compatible wrapper that delegates to `resolveProfile()`. It SHALL resolve both canonical slugs and legacy aliases identically to `resolveProfile()`.

#### Scenario: getProfile delegates to resolveProfile
- **WHEN** `getProfile('linkedin')` is called
- **THEN** it returns the same result as `resolveProfile('linkedin')`

#### Scenario: getProfile works with new canonical slugs
- **WHEN** `getProfile('instagram-reel')` is called
- **THEN** it returns the `INSTAGRAM_REEL` preset object

### Requirement: groupedProfiles helper
`packages/profiles` SHALL export a function `groupedProfiles(): Record<string, Profile[]>` that returns all canonical presets (excluding legacy aliases) partitioned by their `group` field. The keys SHALL be the group names (`'instagram'`, `'twitter'`, `'linkedin'`, `'generic'`), and each value SHALL be the array of profiles in that group in their canonical order.

#### Scenario: linkedin group returns all LinkedIn profiles
- **WHEN** `groupedProfiles()['linkedin']` is accessed
- **THEN** it returns an array of 6 Profile objects whose slugs match all six `linkedin-*` slugs

#### Scenario: twitter group returns all Twitter profiles
- **WHEN** `groupedProfiles()['twitter']` is accessed
- **THEN** it returns an array of 5 Profile objects whose slugs match all five `twitter-*` slugs

#### Scenario: instagram group returns all Instagram profiles
- **WHEN** `groupedProfiles()['instagram']` is accessed
- **THEN** it returns an array of 7 Profile objects whose slugs match all seven `instagram-*` slugs

#### Scenario: generic group contains square
- **WHEN** `groupedProfiles()['generic']` is accessed
- **THEN** it returns an array containing the `square` profile

### Requirement: Profile type includes label and group
The `Profile` type in `@pixdom/types` SHALL include two additional required fields: `label: string` (a human-readable display name) and `group: string` (the platform group identifier). All preset objects SHALL include these fields.

#### Scenario: Profile object includes label
- **WHEN** `INSTAGRAM_STORY.label` is read
- **THEN** it returns a non-empty string (e.g. `"Instagram Story"`)

#### Scenario: Profile object includes group
- **WHEN** `INSTAGRAM_STORY.group` is read
- **THEN** it returns `'instagram'`

#### Scenario: TypeScript enforces label and group on Profile shape
- **WHEN** TypeScript compiles a `Profile` object literal without a `label` field
- **THEN** the compiler emits a type error

### Requirement: Named exports only
`packages/profiles/src/index.ts` SHALL use only named exports. No default export SHALL be present.

#### Scenario: Default import fails at compile time
- **WHEN** a consumer writes `import Profiles from '@pixdom/profiles'`
- **THEN** TypeScript emits a module-has-no-default-export error
