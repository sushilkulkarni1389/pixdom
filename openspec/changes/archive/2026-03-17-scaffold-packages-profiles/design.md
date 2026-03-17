## Context

`packages/profiles` is a pure data module — no I/O, no async, no external runtime dependencies. Its only job is to hold the four platform preset objects and expose them through a typed lookup function. The types it uses (`Profile`, `ProfileId`, `OutputFormat`) are already defined in `@pixdom/types`.

## Goals / Non-Goals

**Goals:**
- Export 4 frozen `Profile` objects as named constants (`INSTAGRAM`, `TWITTER`, `LINKEDIN`, `SQUARE`)
- Export a `PROFILES` record keyed by `ProfileId` for programmatic lookup
- Export `getProfile(id: ProfileId): Profile` as the primary consumer-facing API
- All values satisfy the `Profile` Zod schema from `@pixdom/types` at the type level

**Non-Goals:**
- Runtime Zod parsing of preset values (they are hardcoded constants — no external input)
- Dynamic or user-configurable profiles (those belong in the CLI layer)
- Animated GIF/video defaults for profiles that don't need `fps` (field is optional)
- Any I/O, network calls, or filesystem reads

## Decisions

### 1. Named constants + PROFILES map, not an array
**Decision**: Export individual named constants (`INSTAGRAM`, etc.) and a `PROFILES` map typed as `Record<ProfileId, Profile>`.
**Rationale**: Named constants allow tree-shaking and direct import (`import { INSTAGRAM } from '@pixdom/profiles'`). The map enables the `getProfile` lookup without a switch statement. Alternative: export only an array — loses O(1) lookup and tree-shaking.

### 2. `Object.freeze()` at definition time
**Decision**: Each preset is `Object.freeze()`'d at module evaluation.
**Rationale**: Matches the constraint in `openspec/specs/profiles.md`. Prevents accidental mutation by consumers sharing a reference. TypeScript `as const` alone doesn't prevent runtime mutation.

### 3. `getProfile` typed `ProfileId → Profile`, not `string → Profile | undefined`
**Decision**: `getProfile(id: ProfileId): Profile` — caller must pass a valid `ProfileId`.
**Rationale**: Pushes validation to the call site (use `ProfileIdSchema.parse()` before calling). Eliminates the need for null-checks on the returned value. Alternative: accept `string` and return `Profile | undefined` — shifts burden to every call site.

### 4. Preset values
| Profile | Width | Height | Format | Quality | fps |
|---|---|---|---|---|---|
| instagram | 1080 | 1080 | `webp` | 90 | — |
| twitter | 1200 | 675 | `webp` | 85 | — |
| linkedin | 1200 | 627 | `webp` | 85 | — |
| square | 800 | 800 | `png` | 100 | — |

**Rationale**: Square uses PNG for lossless quality (common for logos/graphics). All others use WebP for best size/quality ratio on social platforms. fps omitted — static image presets in v1; animated presets are a v2 concern.

## Risks / Trade-offs

- **Preset values will need updating** → Social platforms change their recommended dimensions. Mitigation: values are a single object literal per preset; changes are one-line diffs.
- **`Object.freeze()` is shallow** → Nested objects (none in v1) would not be frozen. Not a concern for the current flat `Profile` shape.
