## Why

Layer 3 tab completions — flag value suggestions for `--profile` and `--format` — are silently broken: omelette's tree traversal crashes inside the existing try/catch when it attempts to reduce a flag-value key (e.g. `tree['convert']['--profile']`) that has no children, causing `process.exit(0)` with empty stdout, so the shell receives no candidates. The spec already mandates these completions work; this change implements the fix.

## What Changes

- Add a custom `--compgen` early-intercept in `completion.ts` that runs **before** `completion.init()`, bypassing omelette's broken tree traversal entirely for flag-value resolution.
- Implement `getCompletionsForPrev(prev)` that returns the correct candidate list based on the previous word (flag name or subcommand), covering `--profile` (22 slugs), `--format` (6 values), and subcommand-level candidates.
- The omelette tree, `init()` call, try/catch guard, and all generated script output remain unchanged — only the early-intercept path is added.
- No other files are modified.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `cli-autocomplete`: Implementation mechanism for flag-value (Layer 3) completion changes — custom `--compgen` intercept replaces omelette tree traversal for value resolution, while all existing spec requirements remain the same.

## Impact

- **Modified file**: `apps/cli/src/commands/completion.ts` only.
- **Rebuild scope**: `apps/cli` only.
- All existing working completion layers (Layer 1: subcommands, Layer 2: flag names, file-path fallback) are unaffected.
- No API, MCP server, package, or spec file changes.
