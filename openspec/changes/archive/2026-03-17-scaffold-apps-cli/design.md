## Context

`apps/cli` sits at the top of the dependency stack: it consumes `@pixdom/core` for rendering and `@pixdom/profiles` for preset resolution. It must not import Playwright or Sharp directly. The binary name is `pixdom` (from the existing spec constraint). The CLI follows a subcommand model (`pixdom convert …`) to leave room for future subcommands.

## Goals / Non-Goals

**Goals:**
- Single `convert` subcommand with Commander.js
- Mutually exclusive input flags: `--html`, `--file`, `--url`
- Profile-first option resolution: `--profile` fills in width/height/format/quality; individual flags override
- `--output` defaults to `./output.<format>` when not provided
- Write render buffer to the output path and print the resolved absolute path to stdout
- All errors → stderr + exit code 1; never exit 0 on failure

**Non-Goals:**
- Watch mode or stdin input
- Progress bars or interactive prompts
- Config file support
- Shell completions (v2 scope)
- Windows `CRLF` line ending handling in `--html` (not needed for v1)

## Decisions

### 1. Commander.js over yargs/meow
**Decision**: Use `commander` for argument parsing.
**Rationale**: Matches the CLI spec implicitly (lightweight, widely used, auto-generates `--help`). Alternative: `yargs` — heavier, more config. `meow` — too minimal, requires manual validation.

### 2. Subcommand model (`pixdom convert`)
**Decision**: Single `convert` subcommand via `.command('convert')`.
**Rationale**: The spec's acceptance criteria use `pixdom convert --html ...` directly. Subcommands leave a clean extension point for `pixdom inspect` or `pixdom profile list` in future versions.

### 3. Profile-first option merging
**Decision**: If `--profile` is given, resolve the preset via `getProfile()` from `@pixdom/profiles`, then apply any individual flag overrides on top. Final merged options are passed to `render()`.
**Rationale**: Callers should be able to say `--profile instagram --format jpeg` and get the instagram dimensions with JPEG output. Alternative: treat flags as fully independent — forces callers to always specify all dimensions.

### 4. Default output path
**Decision**: If `--output` is omitted, default to `./pixdom-output.<format>` in the current working directory.
**Rationale**: Prevents silent overwrites of arbitrary files while still being usable without specifying `--output` in quick iterations.

### 5. Input mutex enforced programmatically, not by Commander
**Decision**: Commander accepts all three input flags; the action handler checks that exactly one is provided and errors if zero or multiple are given.
**Rationale**: Commander's `conflicts` API exists but produces cryptic error messages. A manual check lets us emit a clear, user-friendly error: "Provide exactly one of --html, --file, or --url".

## Risks / Trade-offs

- **Large Playwright/Chromium download** → First `pnpm install` in the repo pulls ~150MB. Mitigated by: documented in README, expected as a one-time cost.
- **Binary not on PATH after local install** → `pnpm exec pixdom` or `npx pixdom` works; `pixdom` directly requires global install or PATH addition. Documented in README.
- **`--html` shell quoting** → Complex HTML with quotes requires careful shell escaping. Mitigated by recommending `--file` for anything beyond trivial snippets.
