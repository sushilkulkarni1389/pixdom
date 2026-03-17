## Context

Playwright separates its npm package from its browser binaries. Installing `playwright` via npm only installs the Node.js automation library; the actual Chromium binary must be separately downloaded by running `playwright install chromium` (or `npx playwright install chromium`). This is by design for size reasons — the full browser suite is hundreds of MB.

`packages/core` lists `playwright` as a direct dependency, which means it's always present in the `apps/cli` node_modules. However, the browser binary download is a side-effect that pnpm's install doesn't trigger unless a `postinstall` hook explicitly runs it.

The `postinstall` npm lifecycle script runs automatically after any `npm install`, `pnpm install`, or `yarn` invocation on the package. Placing it in `apps/cli/package.json` (rather than `packages/core/package.json`) keeps it scoped to the user-facing CLI — library consumers who embed `@pixdom/core` can manage their own browser installs.

## Goals / Non-Goals

**Goals:**
- Ensure `playwright install chromium` runs automatically when installing the `pixdom` CLI
- Zero manual setup steps for new users after `npm install -g pixdom` (or equivalent)

**Non-Goals:**
- Installing other Playwright browser engines (Firefox, WebKit) — only Chromium is needed
- Running `playwright install` in `packages/core` — that's a library, not a user-facing package
- Handling CI environments that pre-cache browser binaries (the script is idempotent — re-running it when the binary exists is a no-op)

## Decisions

### Where to place the postinstall script

**Decision**: `apps/cli/package.json` only.

`packages/core` is a library that other packages could depend on. Forcing a browser download as a side-effect of installing a library is unexpected and breaks environments that only want the library. The CLI is the user-facing entry point, so the postinstall belongs there.

### `playwright install chromium` vs `playwright install`

**Decision**: `playwright install chromium` (specific browser only).

`playwright install` without arguments downloads all supported browsers (~1GB total). Chromium is the only engine `render()` uses. Scoping to chromium keeps install time and disk usage minimal.

### Script invocation: `playwright install chromium` vs `npx playwright install chromium`

**Decision**: `playwright install chromium` directly.

Since `playwright` is a transitive dependency, its binary is available in `.bin/playwright` within node_modules. npm/pnpm resolve `postinstall` commands through the local `.bin` path, so `playwright` resolves without `npx`. Using `npx` would add an unnecessary network lookup if the package isn't cached.

## Risks / Trade-offs

- **CI environments with restricted network access** → Accepted: these environments typically pre-install browser binaries or set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`. The script is a convenience, not a hard requirement.
- **pnpm's `side-effects-cache` or script sandboxing** → Mitigation: pnpm runs `postinstall` by default; no additional config needed.
- **Re-running on every install is slow** → Acceptable: Playwright's install script is idempotent and exits quickly if the binary already exists (under 1 second).
