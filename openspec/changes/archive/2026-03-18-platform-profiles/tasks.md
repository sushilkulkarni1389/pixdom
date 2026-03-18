## 1. Types — Expand ProfileSlug

- [x] 1.1 Open `packages/types/src/index.ts` and locate the `ProfileSlug` (or `ProfileId`) Zod union
- [x] 1.2 Add all 19 canonical slugs to the union: `linkedin-background`, `linkedin-post`, `linkedin-article-cover`, `linkedin-profile`, `linkedin-single-image-ad`, `linkedin-career-background`, `twitter-post`, `twitter-header`, `twitter-ad`, `twitter-video`, `twitter-ad-landscape`, `instagram-post-3-4`, `instagram-post-4-5`, `instagram-post-square`, `instagram-story`, `instagram-reel`, `instagram-profile`, `instagram-story-video`, `square`
- [x] 1.3 Retain the three legacy alias slugs in the union: `instagram`, `twitter`, `linkedin`
- [x] 1.4 Add `label: string` and `group: string` to the `Profile` type/interface
- [x] 1.5 Run `pnpm tsc --noEmit` in `packages/types` to confirm no type errors

## 2. Profiles — Rewrite Registry

- [x] 2.1 Open `packages/profiles/src/index.ts` and replace the four preset constants with 19 new `Object.freeze()`-d preset constants (SCREAMING_SNAKE_CASE, including `label` and `group` fields per the spec table)
- [x] 2.2 Add legacy alias exports: `export const INSTAGRAM = INSTAGRAM_POST_SQUARE`, `export const TWITTER = TWITTER_POST`, `export const LINKEDIN = LINKEDIN_POST`
- [x] 2.3 Rewrite the `PROFILES` record to key all 19 canonical presets by their slug (exclude legacy alias slugs as keys)
- [x] 2.4 Implement `resolveProfile(slug: ProfileSlug): Profile` with an inline alias map (`instagram → instagram-post-square`, `twitter → twitter-post`, `linkedin → linkedin-post`) falling back to `PROFILES[slug]`
- [x] 2.5 Update `getProfile()` to delegate to `resolveProfile()` for backwards compatibility
- [x] 2.6 Implement `groupedProfiles(): Record<string, Profile[]>` that partitions `Object.values(PROFILES)` by `group`
- [x] 2.7 Ensure all new exports are present in `packages/profiles/src/index.ts` (named exports only, no default)
- [x] 2.8 Run `pnpm tsc --noEmit` in `packages/profiles` to confirm no type errors

## 3. CLI — Update --profile Flag

- [x] 3.1 Open `apps/cli/src/index.ts` (or the convert command file) and update the `--profile` flag's choices array to include all 19 canonical slugs plus the 3 legacy aliases
- [x] 3.2 Update the `--profile` flag description/help string to note that legacy slugs (`instagram`, `twitter`, `linkedin`) are supported as aliases
- [x] 3.3 Replace any direct call to `getProfile()` with `resolveProfile()` when looking up the chosen profile at runtime
- [ ] 3.4 Confirm `pixdom convert --html "x" --profile linkedin-background` writes a 1584×396 output

## 4. CLI Autocomplete — Update Profile Slug List

- [ ] 4.1 Open `apps/cli/src/commands/completion.ts` and replace the static `--profile` value array with all 19 canonical slugs (exclude legacy aliases per spec)
- [ ] 4.2 Run `pnpm exec pixdom completion` and verify the emitted script includes the new slugs

## 5. Verification

- [x] 5.1 Run `pnpm tsc --noEmit` from the monorepo root; confirm zero type errors
- [x] 5.2 Verify `resolveProfile('instagram')` returns the `instagram-post-square` preset
- [x] 5.3 Verify `resolveProfile('linkedin-career-background')` returns width 1128, height 191
- [x] 5.4 Verify `groupedProfiles()['twitter']` returns 5 profiles
- [ ] 5.5 Verify `pixdom convert --html "x" --profile instagram` still produces a 1080×1080 output (legacy alias)
- [ ] 5.6 Verify `pixdom convert --html "x" --profile tiktok` exits with code 1 and stderr error
- [x] 5.7 Confirm `PROFILES['instagram']` is `undefined` (legacy slug is not a direct key)
- [x] 5.8 Confirm `INSTAGRAM === INSTAGRAM_POST_SQUARE` is `true`
