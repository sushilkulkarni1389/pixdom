## 1. Implement compgen intercept

- [x] 1.1 Add `getCompletionsForPrev(prev: string): string[]` function in `completion.ts` above `registerCompletion()`, covering `--profile` → `PROFILE_SLUGS`, `--format` → `FORMAT_VALUES`, subcommand-level completions, and `[]` default
- [x] 1.2 Insert `--compgen` early-intercept block inside `registerCompletion()` immediately before `const completion = omelette(...)`, extracting `prev` from `process.argv[compgenIdx + 2]` and writing `getCompletionsForPrev(prev).join('\n') + '\n'` to stdout before `process.exit(0)`

## 2. Build and verify

- [x] 2.1 Rebuild `apps/cli` only
- [x] 2.2 Run `pixdom --help` and `pixdom convert --help` to confirm Commander still works normally
- [x] 2.3 Smoke-test Layer 3: run `pixdom --compbash --compgen 3 --profile "pixdom convert --profile "` and verify 22 slugs appear in stdout
- [x] 2.4 Smoke-test Layer 3: run `pixdom --compbash --compgen 3 --format "pixdom convert --format "` and verify `png jpeg webp gif mp4 webm` appear in stdout
- [x] 2.5 Smoke-test Layer 1: run `pixdom --compbash --compgen 1 pixdom "pixdom "` and verify `convert completion mcp` appear
- [x] 2.6 Smoke-test Layer 2: run `pixdom --compbash --compgen 2 convert "pixdom convert "` and verify all 13 flags appear
- [x] 2.7 Confirm `pixdom --compbash --compgen 3 --url "pixdom convert --url "` exits cleanly with empty/newline output (no crash)
