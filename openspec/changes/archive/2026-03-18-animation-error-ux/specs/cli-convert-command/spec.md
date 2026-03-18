## ADDED Requirements

### Requirement: Structured error output replaces terse message
The `convert` subcommand SHALL pass all `render()` errors through the `formatError()` function from `apps/cli/src/error-formatter.ts` before writing to stderr. The current pattern of `process.stderr.write(\`Error: ${result.error.message} (code: ${result.error.code})\n\`)` SHALL be replaced entirely.

#### Scenario: NO_ANIMATION_DETECTED shows structured output
- **WHEN** `pixdom convert --html "<div></div>" --format gif` is run and no animation is detected
- **THEN** stderr contains structured lines (`What happened:`, `How to fix:`, `Docs:`) rather than a single `Error:` line

#### Scenario: SELECTOR_NOT_FOUND shows selector value in message
- **WHEN** `pixdom convert --html "<div></div>" --selector "#missing" --format png` is run
- **THEN** stderr `What happened:` line includes the selector string `#missing`

### Requirement: --no-color global flag
The CLI SHALL accept `--no-color` as a global flag on the root `pixdom` program (not scoped to `convert`). Its value SHALL be passed to `formatError()` to suppress ANSI color output. Absence of `--no-color` defaults to color-enabled if stderr is a TTY.

#### Scenario: --no-color accepted without error
- **WHEN** `pixdom --no-color convert --html "x" --format gif` is run
- **THEN** the process does not exit with a flag-parsing error

#### Scenario: --no-color in help output
- **WHEN** `pixdom --help` is run
- **THEN** `--no-color` appears in the help text

### Requirement: File validation errors use structured format
`INVALID_FILE_TYPE`, `FILE_NOT_FOUND`, and `IMAGE_NOT_FOUND` errors detected at CLI parse time SHALL be formatted through `formatError()` in the same five-field structure as render errors before writing to stderr.

#### Scenario: INVALID_FILE_TYPE formatted as structured error
- **WHEN** `pixdom convert --file report.pdf` is run
- **THEN** stderr contains `What happened:` and `How to fix:` lines and the process exits with code 1

#### Scenario: FILE_NOT_FOUND formatted as structured error
- **WHEN** `pixdom convert --file /nonexistent.html` is run
- **THEN** stderr contains `What happened:` naming the missing file and `How to fix:` with path resolution guidance
