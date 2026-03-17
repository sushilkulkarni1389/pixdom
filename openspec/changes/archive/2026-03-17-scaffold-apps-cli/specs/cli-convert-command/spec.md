## ADDED Requirements

### Requirement: Package scaffold and binary
`apps/cli` SHALL be a valid pnpm workspace package with a `package.json` declaring `bin: { pixdom: "./src/index.ts" }` (for development via tsx), `commander` as a runtime dependency, and `@pixdom/core`, `@pixdom/profiles`, and `@pixdom/types` as workspace dependencies. It SHALL have zero direct Playwright, Sharp, or FFmpeg imports.

#### Scenario: Binary resolves in workspace
- **WHEN** `pnpm exec pixdom --help` is run from the monorepo root
- **THEN** it exits with code 0 and prints usage to stdout

#### Scenario: No direct renderer imports
- **WHEN** `apps/cli/src/index.ts` is statically analysed
- **THEN** no import path resolves to `playwright`, `sharp`, or `fluent-ffmpeg`

### Requirement: convert subcommand
`apps/cli` SHALL expose a `convert` subcommand as the primary action. Running `pixdom convert` with valid flags SHALL invoke `render()` from `@pixdom/core` and write the result buffer to the output path.

#### Scenario: HTML input produces output file
- **WHEN** `pixdom convert --html "<h1>Hello</h1>"` is run
- **THEN** a PNG file is written to `./pixdom-output.png` and its absolute path is printed to stdout

#### Scenario: File input renders correctly
- **WHEN** `pixdom convert --file path/to/page.html` is run
- **THEN** the file is rendered and the output path is printed to stdout

#### Scenario: URL input renders correctly
- **WHEN** `pixdom convert --url https://example.com` is run
- **THEN** the URL is rendered and the output path is printed to stdout

### Requirement: Mutually exclusive input flags
The `convert` subcommand SHALL accept `--html <string>`, `--file <path>`, and `--url <url>` flags. Exactly one SHALL be provided. If zero or more than one are given, the CLI SHALL print an error to stderr and exit with code 1.

#### Scenario: Zero input flags exits with error
- **WHEN** `pixdom convert --format png` is run with no input flag
- **THEN** stderr contains "Provide exactly one of --html, --file, or --url" and the process exits with code 1

#### Scenario: Multiple input flags exits with error
- **WHEN** `pixdom convert --html "x" --url https://example.com` is run
- **THEN** stderr contains an error message and the process exits with code 1

### Requirement: --profile flag
The `convert` subcommand SHALL accept `--profile <id>` where `id` is one of `instagram | twitter | linkedin | square`. When provided, `width`, `height`, `format`, and `quality` SHALL be pre-filled from the matching preset. Individual override flags applied alongside `--profile` SHALL take precedence.

#### Scenario: Profile sets dimensions
- **WHEN** `pixdom convert --html "x" --profile instagram` is run
- **THEN** the output image has dimensions 1080×1080

#### Scenario: Profile flag with format override
- **WHEN** `pixdom convert --html "x" --profile instagram --format jpeg` is run
- **THEN** the output is a JPEG (not the profile's default webp)

#### Scenario: Invalid profile exits with error
- **WHEN** `pixdom convert --html "x" --profile tiktok` is run
- **THEN** stderr contains an error about the invalid profile and the process exits with code 1

### Requirement: --output flag
The `convert` subcommand SHALL accept `--output <path>` specifying the destination file. If omitted, the output SHALL default to `./pixdom-output.<format>` in the current working directory.

#### Scenario: Custom output path used
- **WHEN** `pixdom convert --html "x" --output /tmp/test.png` is run
- **THEN** the file is written to `/tmp/test.png` and that path is printed to stdout

#### Scenario: Default output path generated
- **WHEN** `pixdom convert --html "x"` is run without `--output`
- **THEN** the file is written to `./pixdom-output.png` and that absolute path is printed to stdout

### Requirement: Format, viewport, and quality overrides
The `convert` subcommand SHALL accept `--format <fmt>`, `--width <n>`, `--height <n>`, and `--quality <n>` flags that override the corresponding fields in `RenderOptions`. All flags are optional and default to `png`, `1280`, `720`, and `90` respectively when no profile is active.

#### Scenario: Width and height override applied
- **WHEN** `pixdom convert --html "x" --width 400 --height 300` is run
- **THEN** the output image has dimensions 400×300

#### Scenario: Quality flag passed through
- **WHEN** `pixdom convert --html "x" --format jpeg --quality 50` is run
- **THEN** a JPEG is produced (verifiable by file signature)

### Requirement: Stdout and stderr discipline
On success, `pixdom convert` SHALL print the resolved absolute output path to stdout and exit with code 0. On any failure (invalid flags, render error, file write error), it SHALL print a human-readable error message to stderr and exit with code 1. Nothing SHALL be printed to stdout on failure.

#### Scenario: Success prints path to stdout only
- **WHEN** `pixdom convert --html "x" --output /tmp/out.png` completes successfully
- **THEN** stdout contains `/tmp/out.png` and stderr is empty

#### Scenario: Render failure exits code 1
- **WHEN** `render()` returns a `Result.err`
- **THEN** the error message is printed to stderr and the process exits with code 1

#### Scenario: --help exits with code 0
- **WHEN** `pixdom --help` or `pixdom convert --help` is run
- **THEN** usage is printed and the process exits with code 0
