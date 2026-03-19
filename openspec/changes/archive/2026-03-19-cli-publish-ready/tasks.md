## 1. Update package.json

- [x] 1.1 Add `esbuild` to `devDependencies` in `apps/cli/package.json`
- [x] 1.2 Replace `build` script with esbuild bundle command: `esbuild src/index.ts --bundle --platform=node --target=node18 --format=esm --outfile=dist/index.js --external:playwright --external:sharp --external:ora --external:commander --external:omelette`
- [x] 1.3 Fix `postinstall` script to `npx playwright install chromium`
- [x] 1.4 Remove `@pixdom/core`, `@pixdom/profiles`, `@pixdom/types` from `dependencies`
- [x] 1.5 Run `pnpm install` in repo root to update lockfile

## 2. Verify Build Output

- [x] 2.1 Run `pnpm build` in `apps/cli` and confirm `dist/index.js` is created
- [x] 2.2 Confirm `dist/index.js` contains no `import` referencing `@pixdom/core`, `@pixdom/profiles`, or `@pixdom/types`
- [x] 2.3 Confirm `dist/index.js` retains `import` statements for `playwright`, `sharp`, `ora`, `commander`, `omelette`
- [x] 2.4 Run `node apps/cli/dist/index.js convert --help` and confirm it exits 0

## 3. Smoke Test Global Install

- [x] 3.1 Run `pnpm pack` in `apps/cli` to produce a tarball
- [x] 3.2 Install the tarball globally: `npm install -g pixdom-<version>.tgz`
- [x] 3.3 Confirm `pixdom --help` exits 0 and prints usage
- [x] 3.4 Confirm `pixdom convert --html "<h1>Hello</h1>" --output /tmp/out.png` succeeds without `Cannot find module '@pixdom/core'` error
