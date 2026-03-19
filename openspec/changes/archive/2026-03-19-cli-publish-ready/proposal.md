## Why

The `pixdom` CLI package cannot be installed globally via `npm install -g` because it relies on monorepo-relative paths (for playwright) and internal workspace packages (`@pixdom/core`, `@pixdom/profiles`, `@pixdom/types`) that don't exist outside the monorepo. Fixing this is necessary before the package can be published to npm or distributed as a standalone tarball.

## What Changes

- **postinstall script**: Replace `node ../../node_modules/playwright/cli.js install chromium` with `npx playwright install chromium`, which resolves playwright from the installed package's own `node_modules`
- **Build system**: Replace the `tsc` build step in `apps/cli` with an `esbuild` bundle step that inlines all `@pixdom/*` internal packages into a single `dist/index.js`
- **devDependency**: Add `esbuild` to `apps/cli/package.json` devDependencies
- **dependencies**: Remove `@pixdom/core`, `@pixdom/profiles`, `@pixdom/types` from `apps/cli` dependencies (they are now inlined); keep `playwright`, `sharp`, `ora`, `commander`, `omelette`, `ffmpeg-static` as runtime dependencies

## Capabilities

### New Capabilities

- `cli-bundle`: Build pipeline that bundles the CLI entry point and all `@pixdom/*` internal packages into a single self-contained `dist/index.js` using esbuild, suitable for standalone npm distribution

### Modified Capabilities

- `cli-convert-command`: No requirement changes — implementation is unaffected; bundling is transparent to the command's behavior
- `render-pipeline`: No requirement changes — inlined at build time, runtime behavior unchanged

## Impact

- `apps/cli/package.json`: postinstall script, build script, devDependencies, dependencies
- `apps/cli/dist/index.js`: now a bundled single file (not tsc output)
- `bin/pixdom.js`: must continue to import from `dist/index.js` — no change expected
- Publishing: `pnpm pack` in `apps/cli` will produce a tarball that works with `npm install -g` on a clean machine
