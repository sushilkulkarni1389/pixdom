## 1. Package Scaffold

- [x] 1.1 Create `apps/cli/package.json` with name `pixdom`, `bin: { pixdom: "./bin/pixdom.js" }`, `commander` runtime dep, workspace deps (`@pixdom/core`, `@pixdom/profiles`, `@pixdom/types`), and ESM type
- [x] 1.2 Create `apps/cli/tsconfig.json` extending root tsconfig
- [x] 1.3 Create `apps/cli/src/index.ts` as the CLI entry point with Commander program setup

## 2. convert Subcommand

- [x] 2.1 Register `convert` subcommand with Commander and declare all flags: `--html`, `--file`, `--url`, `--profile`, `--output`, `--format`, `--width`, `--height`, `--quality`
- [x] 2.2 Implement input mutex validation — error and exit 1 if zero or multiple input flags are provided
- [x] 2.3 Implement profile resolution — call `getProfile(id)` from `@pixdom/profiles` and merge preset fields; apply individual flag overrides on top
- [x] 2.4 Implement default output path — `./pixdom-output.<format>` when `--output` is omitted

## 3. Render and Write

- [x] 3.1 Build `RenderOptions` from resolved flags and call `render()` from `@pixdom/core`
- [x] 3.2 On `Result.ok`: write buffer to output path with `fs.writeFile`, print resolved absolute path to stdout, exit 0
- [x] 3.3 On `Result.err` or any thrown error: print error message to stderr, exit 1

## 4. Verification

- [x] 4.1 Run `tsc --noEmit` in `apps/cli` — zero type errors
- [x] 4.2 Confirm `pnpm exec pixdom --help` exits 0 and prints usage
- [x] 4.3 Confirm `pnpm exec pixdom convert --html "<h1>Hi</h1>"` writes a PNG and prints its path to stdout
- [x] 4.4 Confirm `pnpm exec pixdom convert` (no input) exits 1 with an error on stderr
- [x] 4.5 Confirm `pnpm exec pixdom convert --html "x" --profile instagram` produces 1080×1080 output
