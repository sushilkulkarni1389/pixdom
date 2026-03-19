## ADDED Requirements

### Requirement: auto-mode progress steps
When `--auto` is active, the CLI progress reporter SHALL display two additional steps between "Loading page" and "Capturing frames":
- `'analyse-page'`: label `"Analysing page"` — shown when auto-element-detection runs
- `'detect-animations'`: label `"Detecting animations"` — shown when auto-duration and auto-fps detection runs

These steps SHALL only be shown when `RenderOptions.auto === true`. They SHALL follow the same spinner pattern as all other steps (spinner while running, `✓` on completion). When `--no-progress` is set or stderr is not a TTY, these steps SHALL be suppressed along with all other progress output.

`STEP_LABELS` in `apps/cli/src/progress-reporter.ts` SHALL include:
- `'analyse-page': 'Analysing page'`
- `'detect-animations': 'Detecting animations'`

#### Scenario: Analysing page step shown when --auto active
- **WHEN** `pixdom convert --file page.html --format gif --auto` is run in a TTY
- **THEN** stderr contains `✓ Analysing page` before any `✓ Detecting animations` line

#### Scenario: Detecting animations step shown when --auto active
- **WHEN** `pixdom convert --file page.html --format gif --auto` is run in a TTY
- **THEN** stderr contains `✓ Detecting animations` before any `✓ Capturing frames` line

#### Scenario: Auto steps absent when --auto not set
- **WHEN** `pixdom convert --file page.html --format gif` is run without `--auto`
- **THEN** stderr does NOT contain `Analysing page` or `Detecting animations` lines

#### Scenario: Auto steps suppressed with --no-progress
- **WHEN** `pixdom --no-progress convert --file page.html --format gif --auto` is run
- **THEN** stderr contains no `Analysing page` or `Detecting animations` text
