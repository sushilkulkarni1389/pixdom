## ADDED Requirements

### Requirement: --allow-local flag on convert subcommand
The `convert` subcommand SHALL accept `--allow-local` as a boolean flag. When set, it bypasses the private/loopback host validation for `--url` inputs and threads through to the Playwright request guard. A warning SHALL be printed to stderr when `--allow-local` is active. The flag SHALL have no effect when `--html` or `--file` inputs are used.

#### Scenario: --allow-local appears in --help output
- **WHEN** `pixdom convert --help` is run
- **THEN** `--allow-local` appears in the flag list with a description

#### Scenario: --allow-local flag absent from --html render
- **WHEN** `pixdom convert --html "x" --allow-local` is run
- **THEN** the flag is silently accepted (no error) and the render proceeds normally

### Requirement: Path traversal prevention for --file and --image
The `convert` subcommand SHALL resolve `--file` and `--image` paths using `fs.realpathSync()` to follow symlinks to their true destination before any further validation or use. The resolved real path SHALL be used for extension validation, existence checks, and passing to the renderer.

#### Scenario: Symlink .html file resolved to real path
- **WHEN** `--file` points to a `.html` symlink that resolves to a `.txt` file
- **THEN** extension validation runs against the resolved `.txt` path and the CLI exits with code 1

#### Scenario: Non-symlink file resolved identically
- **WHEN** `--file` points to a regular `/tmp/page.html` file
- **THEN** `fs.realpathSync('/tmp/page.html')` returns the same path and rendering proceeds

## MODIFIED Requirements

### Requirement: Format, viewport, and quality overrides
The `convert` subcommand SHALL accept `--format <fmt>`, `--width <n>`, `--height <n>`, and `--quality <n>` flags that override the corresponding fields in `RenderOptions`. All flags are optional and default to `png`, `1280`, `720`, and `90` respectively when no profile is active. `--width` SHALL be validated as an integer in range 1–7680. `--height` SHALL be validated as an integer in range 1–4320. Values outside these ranges SHALL be rejected with error code `RESOURCE_LIMIT_EXCEEDED` at parse time.

#### Scenario: Width and height override applied
- **WHEN** `pixdom convert --html "x" --width 400 --height 300` is run
- **THEN** the output image has dimensions 400×300

#### Scenario: width=8000 rejected at parse time
- **WHEN** `pixdom convert --html "x" --width 8000` is run
- **THEN** the process exits with code 1 and stderr contains `RESOURCE_LIMIT_EXCEEDED` before any render begins

#### Scenario: height=4321 rejected at parse time
- **WHEN** `pixdom convert --html "x" --height 4321` is run
- **THEN** the process exits with code 1 and stderr contains `RESOURCE_LIMIT_EXCEEDED`
