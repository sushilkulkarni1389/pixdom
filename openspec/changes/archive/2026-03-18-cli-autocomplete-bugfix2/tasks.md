## 1. Fix 1 — Post-init exit guard (all shells)

- [x] 1.1 In `registerCompletion()`, before calling `completion.init()`, record `const isCompletionRequest` by checking `process.argv` for any of `--compbash`, `--compzsh`, `--compgen`, `--compfish`
- [x] 1.2 After the try/catch block, add: if `isCompletionRequest` is true, write `'\n'` to stdout and call `process.exit(0)` — prevents Commander from seeing completion flags as unknown options when omelette crashes before its own process.exit()

## 2. Fix 2a — Bash: -o default for filename completion fallback

- [x] 2.1 In `generateCompletionScript()`, change `complete -F ${fn} ${program}` to `complete -F ${fn} -o default ${program}` so bash falls back to native filename completion when COMPREPLY is empty

## 3. Fix 2b — Zsh: _path_files fallback

- [x] 3.1 In `generateCompletionScript()`, replace the single `compadd -- \`...\`` line in the zsh function body with: capture output into a variable, call `compadd` if non-empty, else call `_path_files` as fallback

## 4. Fix 2c — Fish: custom completion script with path completion for --file and --image

- [x] 4.1 In `completion.ts`, add a `generateFishCompletionScript()` function that emits a complete fish completion file for pixdom — covering all convert flags, --profile values, --format values, and using `-F` (fish ≥3.0 `--force-files`) on `--file` and `--image` entries for native path completion
- [x] 4.2 At the top of `registerCompletion()`, before omelette is instantiated, check if `process.argv.includes('--completion-fish')` — if so, write `generateFishCompletionScript()` to stdout and call `process.exit(0)`, intercepting before omelette can output its own (incomplete) fish script

## 5. Verification

- [x] 5.1 Run `pnpm --filter pixdom build` — no TypeScript errors
