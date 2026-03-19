### Requirement: esbuild bundle replaces tsc output
`apps/cli/package.json` SHALL use `esbuild` to produce `dist/index.js` as part of its `build` script. The bundle SHALL inline all `@pixdom/core`, `@pixdom/profiles`, and `@pixdom/types` imports. `esbuild` SHALL be listed as a `devDependency`. The `build` script SHALL target Node 18 and emit ESM format.

#### Scenario: dist/index.js produced by build
- **WHEN** `pnpm build` is run in `apps/cli`
- **THEN** `dist/index.js` exists and contains a bundled single-file ESM module

#### Scenario: @pixdom imports are inlined
- **WHEN** `dist/index.js` is inspected after build
- **THEN** it contains no `import` statements referencing `@pixdom/core`, `@pixdom/profiles`, or `@pixdom/types`

#### Scenario: Runtime deps remain external
- **WHEN** `dist/index.js` is inspected after build
- **THEN** it contains `import` statements for `playwright`, `sharp`, `ora`, `commander`, and `omelette` (not inlined)

### Requirement: Runtime dependencies declared in package.json
`apps/cli/package.json` SHALL declare `playwright`, `sharp`, `ora`, `commander`, `omelette`, and `ffmpeg-static` as `dependencies`. `@pixdom/core`, `@pixdom/profiles`, and `@pixdom/types` SHALL NOT appear in `dependencies` or `devDependencies`.

#### Scenario: npm install resolves all runtime deps
- **WHEN** `npm install` is run in a directory containing only the unpacked tarball of `apps/cli`
- **THEN** `node_modules` contains `playwright`, `sharp`, `ora`, `commander`, `omelette`, and `ffmpeg-static`

#### Scenario: workspace packages absent from published manifest
- **WHEN** the `package.json` inside the published tarball is inspected
- **THEN** no `@pixdom/*` entries appear in `dependencies` or `devDependencies`

### Requirement: postinstall script uses npx for Chromium install
`apps/cli/package.json` SHALL have a `postinstall` script of `npx playwright install chromium`. It SHALL NOT reference any monorepo-relative path such as `../../node_modules/playwright/cli.js`.

#### Scenario: postinstall runs successfully after global install
- **WHEN** `npm install -g pixdom-0.1.0.tgz` is run on a machine with no prior monorepo
- **THEN** the `postinstall` script exits 0 and the Chromium binary is installed

#### Scenario: postinstall script has no monorepo path
- **WHEN** the `postinstall` value in `apps/cli/package.json` is read
- **THEN** it equals `npx playwright install chromium` and contains no `../../` path segment

### Requirement: Global install produces working CLI
After `npm install -g` from the published tarball on a clean machine, the `pixdom` binary SHALL be accessible on `$PATH` and the `convert` subcommand SHALL be functional.

#### Scenario: pixdom --help exits 0 after global install
- **WHEN** `npm install -g pixdom-0.1.0.tgz` completes on a machine with no monorepo
- **THEN** `pixdom --help` exits with code 0 and prints usage to stdout

#### Scenario: pixdom convert executes without module-not-found error
- **WHEN** `pixdom convert --html "<h1>Hello</h1>" --output /tmp/out.png` is run after global install
- **THEN** the process does not exit with a `Cannot find module '@pixdom/core'` error
