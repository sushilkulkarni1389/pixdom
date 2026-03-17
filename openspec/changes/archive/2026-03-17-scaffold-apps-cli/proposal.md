## Why

`apps/cli` is the primary user-facing entry point for pixdom. Without it, the rendering pipeline built in `packages/core` and the platform presets in `packages/profiles` have no consumable interface. The CLI is needed to validate the end-to-end flow and provide a usable product.

## What Changes

- New `apps/cli` workspace package with a `pixdom` binary built on Commander.js
- Single `convert` subcommand accepting `--html`, `--file`, or `--url` as mutually exclusive input sources
- `--output` flag for the destination file path (defaults to a generated filename in the current directory)
- `--profile` flag to select a platform preset from `@pixdom/profiles` (instagram/twitter/linkedin/square)
- `--format` flag to override the output format (png/jpeg/webp/gif/mp4/webm)
- `--width` and `--height` flags to override viewport dimensions
- `--quality` flag to override compression quality (0–100)
- Successful render writes the buffer to `--output` and prints the resolved path to stdout
- Errors print to stderr and exit with code 1

## Capabilities

### New Capabilities

- `cli-convert-command`: The `pixdom convert` subcommand — flag parsing, input validation, profile resolution, `render()` invocation, file writing, and exit behaviour

### Modified Capabilities

## Impact

- New package `apps/cli` — depends on `@pixdom/core`, `@pixdom/profiles`, `@pixdom/types`
- Runtime dependencies: `commander`
- Produces a `pixdom` binary via `package.json` `bin` field
- No direct Playwright usage — all browser work delegated to `@pixdom/core`
