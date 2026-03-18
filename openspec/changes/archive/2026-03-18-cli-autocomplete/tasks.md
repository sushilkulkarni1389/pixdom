## 1. Dependency Setup

- [x] 1.1 Add `omelette` as a runtime dependency in `apps/cli/package.json`
- [x] 1.2 Run `pnpm install` in `apps/cli` (or workspace root) to lock the new dependency

## 2. Completion Command Module

- [x] 2.1 Create `apps/cli/src/commands/completion.ts` exporting a `registerCompletion(program: Command): void` function
- [x] 2.2 Initialise an `omelette` instance named `pixdom` with the top-level subcommand tree (`convert`, `completion`)
- [x] 2.3 Wire `convert` subcommand completions: register all flags (`--html`, `--file`, `--url`, `--image`, `--profile`, `--output`, `--format`, `--width`, `--height`, `--quality`, `--fps`, `--duration`, `--auto-size`)
- [x] 2.4 Add value-list handler for `--profile` returning all 22 slugs (19 canonical + 3 legacy aliases per updated spec)
- [x] 2.5 Add value-list handler for `--format` returning `['png', 'jpeg', 'webp', 'gif', 'mp4', 'webm']`
- [x] 2.6 Add file-path passthrough for `--file` and `--image` (return empty array — shell default behaviour)
- [x] 2.7 Call `omelette.init()` at the end of `registerCompletion` to activate shell integration

## 3. completion Subcommand

- [x] 3.1 Add a `completion` subcommand to `apps/cli/src/index.ts` using `program.command('completion')`
- [x] 3.2 Add `--install` option to the `completion` subcommand
- [x] 3.3 Implement default action (no flags): print the omelette-generated completion script to stdout via `completion.generateCompletionCode()`, then exit 0
- [x] 3.4 Implement `--install` action: print human-readable instructions for bash (`~/.bashrc`), zsh (`~/.zshrc`), and fish (`~/.config/fish/completions/pixdom.fish`) without modifying any files, then exit 0
- [x] 3.5 Import and call `registerCompletion` from the completion module in `apps/cli/src/index.ts`

## 4. Verification

- [x] 4.1 Run `pnpm exec pixdom completion` and confirm non-empty script is printed to stdout with exit code 0
- [x] 4.2 Run `pnpm exec pixdom completion --install` and confirm instructions mention `~/.bashrc`, `~/.zshrc`, and fish paths with exit code 0
- [ ] 4.3 Source the completion script in bash (`source <(pixdom completion)`) and verify `pixdom convert --<TAB>` lists flags
- [ ] 4.4 Verify `pixdom convert --profile <TAB>` lists `instagram twitter linkedin square`
- [ ] 4.5 Verify `pixdom convert --format <TAB>` lists `png jpeg webp gif mp4 webm`
- [ ] 4.6 Confirm existing `pixdom convert` behaviour is unchanged (all prior tests pass)
