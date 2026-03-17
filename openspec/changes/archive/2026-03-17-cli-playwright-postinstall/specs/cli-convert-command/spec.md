## ADDED Requirements

### Requirement: Chromium browser auto-installed on package install
`apps/cli/package.json` SHALL include a `postinstall` script that runs `playwright install chromium`. This script SHALL execute automatically after any `npm install`, `pnpm install`, or `yarn` invocation on the `apps/cli` package, ensuring the Chromium binary is available without manual intervention.

#### Scenario: Fresh install includes browser binary
- **WHEN** `npm install` (or `pnpm install`) is run in `apps/cli` on a machine with no prior Playwright binaries
- **THEN** the `postinstall` script downloads the Chromium binary and `pixdom convert` succeeds without a browser launch error

#### Scenario: Re-install is idempotent
- **WHEN** `npm install` is run again on a machine that already has the Chromium binary installed
- **THEN** `playwright install chromium` exits quickly without re-downloading and the existing binary remains intact
