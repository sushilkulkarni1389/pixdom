## Context

No implementation code exists yet. Before any package is written, all cross-package domain objects need a single canonical home so that `core`, `profiles`, `detector`, `cli`, and `mcp-server` can import from one place without circular dependencies or ad-hoc type duplication.

`packages/types` must be a leaf package (no sibling imports), ship zero runtime code beyond Zod schemas, and be usable from both Node ESM and CJS consumers.

## Goals / Non-Goals

**Goals:**
- Define all shared domain types as Zod schemas (TypeScript types derived via `z.infer`)
- Export a `Result<T, E>` generic for consistent error handling across packages
- Provide runtime-safe parsing at system entry points (CLI args, MCP tool params)
- Zero circular dependencies — `packages/types` imports nothing from this monorepo

**Non-Goals:**
- Business logic or transformation functions (those belong in `core`/`profiles`)
- Env var schema (each app owns its own env validation)
- Test utilities or factory helpers

## Decisions

### 1. Zod as the only runtime dependency
**Decision**: All types are Zod schemas; TypeScript types derived via `z.infer<typeof Schema>`.
**Rationale**: Eliminates manual type/schema duplication and provides free runtime validation. Alternatives considered: `io-ts` (more complex API, steeper learning curve), plain TypeScript interfaces with separate validators (duplication risk).

### 2. `RenderInput` as a discriminated union with a `type` discriminant
**Decision**: `{ type: 'html', html: string } | { type: 'file', path: string } | { type: 'url', url: string }`
**Rationale**: Makes input routing in `core` exhaustive and type-safe without `if/else` chains on optional fields. Alternative: separate optional fields on a flat object — loses exhaustiveness checking.

### 3. `ProfileId` as `z.enum` (string union), not a TypeScript `enum`
**Decision**: `z.enum(['instagram', 'twitter', 'linkedin', 'square'])` → type is `'instagram' | 'twitter' | 'linkedin' | 'square'`
**Rationale**: JSON-serialisable, tree-shakeable, and avoids the runtime object emitted by TS enums. Adding a new preset only touches `packages/profiles` and the `ProfileId` union — no enum-to-string mapping needed.

### 4. `Result<T, E>` with mandatory `code` on error
**Decision**: `{ ok: true; value: T } | { ok: false; error: E }` where `E extends { code: string }`
**Rationale**: Enforces programmatic error matching (no string-parsing of messages). The `code` field is the contract; `message` is for humans. Alternative: `throw` everywhere — loses type-level error visibility across async boundaries.

### 5. Named exports only from `src/index.ts`
**Decision**: No default export.
**Rationale**: Consistent tree-shaking, avoids import aliasing confusion across the monorepo.

## Risks / Trade-offs

- **Zod version lock** → All packages in the monorepo must share the same Zod major version. Mitigated by pnpm workspace deduplication.
- **Schema evolution** → Adding required fields to `RenderOptions` is a breaking change for callers. Mitigated by Zod `.partial()` or `.extend()` for optional additions; documented in the package README.
- **Bundle size** → Zod adds ~10 KB gzip to any bundle that imports it at runtime. Acceptable for CLI and server targets; monitor if a browser bundle is ever added (v2 scope).
