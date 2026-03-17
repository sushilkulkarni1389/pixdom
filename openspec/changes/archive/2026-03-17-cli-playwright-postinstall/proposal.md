## Why

`packages/core` depends on `playwright`, but the Chromium browser binary is not bundled with the npm package — it must be downloaded separately via `playwright install chromium`. On a fresh install of the `pixdom` CLI, users will get a cryptic launch error unless they know to run this command first. Adding a `postinstall` script to `apps/cli` automates the browser download and removes the manual setup step.

## What Changes

- Add a `postinstall` script to `apps/cli/package.json` that runs `playwright install chromium`
- The script runs automatically after `npm install` / `pnpm install` / `yarn` on the CLI package
- No new dependencies required — `playwright` is already a transitive dependency via `@pixdom/core`

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `cli-convert-command`: Installation requirement changes — `pixdom` SHALL work out of the box after `npm install` without requiring a manual `playwright install chromium` step

## Impact

- `apps/cli/package.json` — add `"postinstall": "playwright install chromium"` to `scripts`
- No code changes; no new dependencies
