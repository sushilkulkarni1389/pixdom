## ADDED Requirements

### Requirement: --no-progress global flag
The CLI SHALL accept `--no-progress` as a global boolean flag on the root `pixdom` program. When set, or when stderr is not a TTY, no progress output SHALL be emitted. The flag SHALL appear in `--help` output.

#### Scenario: --no-progress accepted without error
- **WHEN** `pixdom --no-progress convert --html "x" --format png` is run
- **THEN** the process exits with code 0 and stderr contains no spinner characters

#### Scenario: --no-progress in help output
- **WHEN** `pixdom --help` is run
- **THEN** `--no-progress` appears in the help text

### Requirement: Progress reporter wired into render()
The `convert` subcommand SHALL construct a `ProgressReporter` (from `apps/cli/src/progress-reporter.ts`) and pass its `onProgress` callback to `render()`. When `--no-progress` is set or stderr is not a TTY, a no-op callback SHALL be passed instead.

#### Scenario: Progress shown during static render in TTY
- **WHEN** `pixdom convert --html "<div></div>" --format png` is run with stderr connected to a TTY
- **THEN** stderr contains step completion lines (e.g. "✓ Loading page") before the output path is printed

#### Scenario: Stdout remains clean with progress active
- **WHEN** `pixdom convert --html "<div></div>" --format png --output /tmp/out.png` is run
- **THEN** stdout contains only the output file path (`/tmp/out.png`) and stderr contains the progress lines and the final `Done in` summary line

### Requirement: Resize step shown conditionally
The "Resizing" progress step SHALL only be shown when a resize operation is actually performed: when `--profile` is set, or when `--width`/`--height` differ from their defaults for image passthrough, or when a profile changes the effective dimensions. When no resize is performed, the step SHALL be absent.

#### Scenario: Resize step absent for default HTML render
- **WHEN** `pixdom convert --html "<div></div>" --format png` is run
- **THEN** stderr does NOT contain a "Resizing" step label

#### Scenario: Resize step present with --profile
- **WHEN** `pixdom convert --html "..." --profile linkedin-post --format jpeg` is run
- **THEN** stderr contains a resize step label including the profile slug
