# Layer 3 — Platform Profiles
Load ONLY when working on Layer 3 — Platform Profiles tasks.

## Goal
Implement the four v1 platform profiles as immutable, validated configuration objects.

## Folder / File Structure to Create

```
packages/profiles/src/
├── instagram.ts
├── twitter.ts
├── linkedin.ts
├── square.ts
├── registry.ts      # Map<ProfileId, PlatformProfile>
└── index.ts         # getProfile(), listProfiles()
```

## Profile Specs

| Profile | Width | Height | Formats | Max Duration | Max Size |
|---|---|---|---|---|---|
| instagram | 1080 | 1080 | png, jpeg, mp4 | 60s | 100MB |
| twitter | 1200 | 675 | png, jpeg, gif, mp4 | 140s | 512MB |
| linkedin | 1200 | 627 | png, jpeg, mp4 | 30s | 200MB |
| square | 800 | 800 | png, jpeg, gif, webp | 30s | 50MB |

## API Shape

```typescript
// index.ts
export function getProfile(id: string): Result<PlatformProfile, { code: 'UNKNOWN_PROFILE' }>
export function listProfiles(): PlatformProfile[]
```

## Hard Rules

- Profiles are `Object.freeze()`-d at module load — never mutate at runtime
- `getProfile` accepts `string` (not `ProfileId`) and validates internally — returns `err` for unknown IDs
- No external dependencies — pure configuration objects

## Definition of Done

- All 4 profiles return correct `widthPx`, `heightPx`, `formats`, `maxDurationSeconds`, `maxFileSizeBytes`
- `getProfile('unknown')` returns `{ ok: false, error: { code: 'UNKNOWN_PROFILE' } }`
- `listProfiles()` returns array of length 4
- `pnpm typecheck` and `pnpm test` pass in `packages/profiles`
