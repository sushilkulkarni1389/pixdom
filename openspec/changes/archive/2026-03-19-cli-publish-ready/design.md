## Context

`apps/cli` is built inside a pnpm monorepo where `@pixdom/core`, `@pixdom/profiles`, and `@pixdom/types` are sibling workspace packages resolved via `workspace:*`. When `pnpm pack` produces a tarball and a user runs `npm install -g pixdom-0.1.0.tgz` on a clean machine, two things break:

1. The `postinstall` script uses `node ../../node_modules/playwright/cli.js` — a relative path that only exists within the monorepo directory tree.
2. The `workspace:*` dependencies (`@pixdom/core`, etc.) are not on npm and are not included in the tarball, so `npm install` cannot resolve them.

`bin/pixdom.js` already prefers `dist/index.js` over the TypeScript source when it exists, so the bundle approach aligns with the existing binary dispatch logic.

## Goals / Non-Goals

**Goals:**
- `npm install -g` from a tarball or npm registry works on a clean machine with no monorepo present
- All `@pixdom/*` internal packages are inlined into a single `dist/index.js` at build time
- Runtime dependencies (`playwright`, `sharp`, `ora`, `commander`, `omelette`, `ffmpeg-static`) remain in `package.json` so npm installs them
- The postinstall script installs Chromium using a path that resolves correctly after global install

**Non-Goals:**
- Tree-shaking beyond what esbuild does by default
- Source maps or debug builds for the published bundle
- Changing any CLI behavior, flags, or runtime semantics
- Publishing to npm (out of scope — this only makes the package installable)

## Decisions

### Decision 1: Use esbuild for bundling instead of tsc + explicit copy

**Choice**: Replace the `build` script with a single `esbuild` invocation that bundles `src/index.ts` into `dist/index.js` with all `@pixdom/*` imports inlined.

**Alternatives considered**:
- *Keep tsc + copy packages manually*: Requires maintaining a copy script, resolving tsconfig path aliases at runtime, and keeping the copies in sync. Fragile.
- *Use rollup or webpack*: Heavier toolchains. esbuild is already used elsewhere in the JS ecosystem for this exact pattern and is fast.
- *Publish @pixdom/* packages to npm*: Requires versioning, registry accounts, and a coordinated release process. Overkill for internal packages.

**Rationale**: esbuild's `--bundle` flag with selective `--external` entries is the simplest solution. One command, no config file, zero runtime overhead.

### Decision 2: Mark runtime deps as `--external`, not internal packages

**Choice**: Mark `playwright`, `sharp`, `ora`, `commander`, `omelette` as `--external` in esbuild. Do NOT mark `@pixdom/*` packages as external.

**Rationale**: External packages must be present in `node_modules` at runtime (npm will install them). Internal `@pixdom/*` packages are not on npm and must be inlined. `ffmpeg-static` is a native binary package — it must remain in `node_modules` but is not directly imported by the TypeScript entry point, so it doesn't need an explicit `--external` flag.

### Decision 3: Use `--format=esm` to match `"type": "module"` in package.json

**Choice**: Bundle as ESM (`--format=esm`), matching the `"type": "module"` declaration in `apps/cli/package.json`.

**Rationale**: `bin/pixdom.js` uses `import` syntax and `import.meta.url`. The existing `dist/index.js` from `tsc` is ESM. Changing to CJS would require changes to `bin/pixdom.js` and the bin entry.

### Decision 4: Fix postinstall with `npx playwright install chromium`

**Choice**: Replace `node ../../node_modules/playwright/cli.js install chromium` with `npx playwright install chromium`.

**Rationale**: `npx` resolves `playwright` from the installed package's own `node_modules` — correct for both monorepo and global-install contexts. This is also the canonical recommended invocation in Playwright docs.

## Risks / Trade-offs

- **esbuild does not type-check** → Mitigation: Keep `tsc --noEmit` as the `typecheck` script; CI should run it separately. Build and typecheck are now decoupled.
- **Bundle size growth** → `@pixdom/core` includes Playwright usage internally; those imports remain external and are not inlined. Actual bundle size should be small (only the TS source of the three packages). Acceptable.
- **`bin/pixdom.js` tsx fallback still present** → When `dist/index.js` exists (post-build), the tsx fallback is never reached. The dev-mode fallback continues to work in the monorepo. No change needed.
- **esbuild external list must stay in sync with runtime deps** → If a new runtime dep is added, it must be added to both `dependencies` in `package.json` and `--external` in the build script. Low risk given the stable dep set.

## Migration Plan

1. Add `esbuild` to `devDependencies` in `apps/cli/package.json`
2. Replace `build` script: `tsc --project tsconfig.json` → esbuild bundle command
3. Fix `postinstall` script
4. Remove `@pixdom/core`, `@pixdom/profiles`, `@pixdom/types` from `dependencies`
5. Run `pnpm install` to update lockfile
6. Run `pnpm build` in `apps/cli` and verify `dist/index.js` exists and is a bundle
7. Smoke-test: `node apps/cli/dist/index.js convert --help` exits 0
8. Run `pnpm pack` in `apps/cli`, extract tarball, run `npm install -g` from the extracted directory on a clean path, verify `pixdom --help` works
