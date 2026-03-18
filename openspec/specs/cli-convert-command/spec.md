# cli-convert-command — requirements

### Requirement: Package scaffold and binary
`apps/cli` SHALL be a valid pnpm workspace package with a `package.json` declaring a `bin.pixdom` entry, `commander` as a runtime dependency, and `@pixdom/core`, `@pixdom/profiles`, and `@pixdom/types` as workspace dependencies. It SHALL have zero direct Playwright, Sharp, or FFmpeg imports.

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
The `convert` subcommand SHALL accept `--profile <slug>` where `slug` is any canonical `ProfileSlug` value or any legacy alias (`instagram`, `twitter`, `linkedin`). When provided, `width`, `height`, `format`, and `quality` SHALL be pre-filled from the resolved preset via `resolveProfile()`. Individual override flags applied alongside `--profile` SHALL take precedence. The `--profile` flag's `--help` output SHALL enumerate all valid slugs grouped by platform.

#### Scenario: Canonical slug sets dimensions
- **WHEN** `pixdom convert --html "x" --profile instagram-post-square` is run
- **THEN** the output image has dimensions 1080×1080

#### Scenario: Legacy slug still resolves
- **WHEN** `pixdom convert --html "x" --profile instagram` is run
- **THEN** the output image has dimensions 1080×1080 (resolves to `instagram-post-square`)

#### Scenario: New namespaced slug sets correct dimensions
- **WHEN** `pixdom convert --html "x" --profile linkedin-background` is run
- **THEN** the output image has dimensions 1584×396 and format is jpeg

#### Scenario: Profile flag with format override
- **WHEN** `pixdom convert --html "x" --profile instagram-post-square --format jpeg` is run
- **THEN** the output is a JPEG (overrides the profile's default jpeg — no behavioural change)

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
The `convert` subcommand SHALL accept `--format <fmt>`, `--width <n>`, `--height <n>`, and `--quality <n>` flags that override the corresponding fields in `RenderOptions`. All flags are optional and default to `png`, `1280`, `720`, and `90` respectively when no profile is active. `--width` SHALL be validated as an integer in range 1–7680. `--height` SHALL be validated as an integer in range 1–4320. Values outside these ranges SHALL be rejected with error code `RESOURCE_LIMIT_EXCEEDED` at parse time.

#### Scenario: Width and height override applied
- **WHEN** `pixdom convert --html "x" --width 400 --height 300` is run
- **THEN** the output image has dimensions 400×300

#### Scenario: Quality flag passed through
- **WHEN** `pixdom convert --html "x" --format jpeg --quality 50` is run
- **THEN** a JPEG is produced (verifiable by file signature)

#### Scenario: width=8000 rejected at parse time
- **WHEN** `pixdom convert --html "x" --width 8000` is run
- **THEN** the process exits with code 1 and stderr contains `RESOURCE_LIMIT_EXCEEDED` before any render begins

#### Scenario: height=4321 rejected at parse time
- **WHEN** `pixdom convert --html "x" --height 4321` is run
- **THEN** the process exits with code 1 and stderr contains `RESOURCE_LIMIT_EXCEEDED`

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

### Requirement: --fps flag
The `convert` subcommand SHALL accept `--fps <n>` where `n` is a positive integer specifying the frame rate for animated output formats (GIF, MP4, WebM). When omitted, the animated renderer's built-in default of 30fps applies. The flag SHALL be passed as `fps` in `RenderOptions`.

#### Scenario: --fps sets frame rate
- **WHEN** `pixdom convert --html "<div>" --format gif --fps 24` is run
- **THEN** `RenderOptions.fps` is set to `24` and the output GIF is encoded at 24fps

#### Scenario: --fps omitted uses renderer default
- **WHEN** `pixdom convert --html "<div>" --format mp4` is run without `--fps`
- **THEN** `RenderOptions.fps` is `undefined` and the animated renderer defaults to 30fps

### Requirement: --duration flag
The `convert` subcommand SHALL accept `--duration <ms>` where `ms` is a positive integer specifying the animation cycle length in milliseconds. When provided, `render()` SHALL use this value as the cycle duration instead of calling `detectAnimationCycle()`. The flag SHALL be validated: a value of 0 or less SHALL cause the CLI to print an error to stderr and exit with code 1.

#### Scenario: --duration overrides detection
- **WHEN** `pixdom convert --html "<div>" --format gif --duration 2000` is run
- **THEN** `RenderOptions.duration` is set to `2000` and the GIF captures a 2000ms animation cycle

#### Scenario: --duration omitted uses auto-detection
- **WHEN** `pixdom convert --html "<div>" --format gif` is run without `--duration`
- **THEN** `RenderOptions.duration` is `undefined` and `render()` calls `detectAnimationCycle()`

#### Scenario: --duration zero or negative exits with error
- **WHEN** `pixdom convert --html "<div>" --format gif --duration 0` is run
- **THEN** stderr contains a validation error and the process exits with code 1

### Requirement: --auto-size flag
The `convert` subcommand SHALL accept `--auto-size` as a boolean flag (no value). When present, `RenderOptions.autoSize` SHALL be set to `true` and the rendered output dimensions SHALL reflect the page's natural content size.

#### Scenario: --auto-size passes autoSize to render
- **WHEN** `pixdom convert --html "<div style='height:2000px'>" --auto-size` is run
- **THEN** `RenderOptions.autoSize` is `true` and the output image height is approximately 2000px

#### Scenario: --auto-size omitted uses fixed viewport
- **WHEN** `pixdom convert --html "<div style='height:2000px'>"` is run without `--auto-size`
- **THEN** the output image height is the default 720px (or the `--height` value)

#### Scenario: --auto-size combined with --width
- **WHEN** `pixdom convert --html "..." --auto-size --width 600` is run
- **THEN** the output width is 600px and the height is auto-detected from content

### Requirement: --selector flag
The `convert` subcommand SHALL accept `--selector <css>` as an optional string flag. When provided, its value SHALL be passed as `RenderOptions.selector`. The flag SHALL be documented in `--help` output.

#### Scenario: --selector passed to render
- **WHEN** `pixdom convert --html "<div id='x'>" --selector "#x"` is run
- **THEN** `RenderOptions.selector` is set to `"#x"` and `render()` is called with that value

#### Scenario: --selector absent leaves selector undefined
- **WHEN** `pixdom convert --html "..."` is run without `--selector`
- **THEN** `RenderOptions.selector` is `undefined` and full-viewport capture proceeds

### Requirement: --selector warns when combined with --width or --height
When `--selector` is provided alongside `--width` or `--height`, the CLI SHALL write a warning to stderr before calling `render()`. The `--width`/`--height` values SHALL NOT be passed into `RenderOptions.viewport` — the element bounding box determines output dimensions. The process SHALL NOT exit with an error.

#### Scenario: --width with --selector emits warning
- **WHEN** `pixdom convert --html "..." --selector "#x" --width 1280` is run
- **THEN** stderr contains a warning that `--width` is ignored because `--selector` is active, and the process continues

#### Scenario: --height with --selector emits warning
- **WHEN** `pixdom convert --html "..." --selector "#x" --height 720` is run
- **THEN** stderr contains a warning that `--height` is ignored because `--selector` is active, and the process continues

### Requirement: --selector suppresses --auto-size
When `--selector` is provided alongside `--auto-size`, `RenderOptions.autoSize` SHALL be set to `false` (or omitted). The CLI MAY omit a warning for this combination; suppression is silent.

#### Scenario: --auto-size silently suppressed when --selector active
- **WHEN** `pixdom convert --html "..." --selector "#x" --auto-size` is run
- **THEN** `RenderOptions.autoSize` is `false` (or undefined) and element bounding box drives output dimensions

### Requirement: --selector ignored for --image input
When `--selector` is provided alongside `--image`, the CLI SHALL write a warning to stderr that `--selector` is not supported for image inputs, and SHALL proceed without passing `selector` to `render()`.

#### Scenario: --selector with --image emits warning and proceeds
- **WHEN** `pixdom convert --image photo.jpg --selector "#x"` is run
- **THEN** stderr contains a warning that `--selector` is ignored for `--image` inputs, and the process exits with code 0 (assuming successful image conversion)

### Requirement: Chromium browser auto-installed on package install
`apps/cli/package.json` SHALL include a `postinstall` script that runs `playwright install chromium`. This script SHALL execute automatically after any `npm install`, `pnpm install`, or `yarn` invocation on the `apps/cli` package, ensuring the Chromium binary is available without manual intervention.

#### Scenario: Fresh install includes browser binary
- **WHEN** `npm install` (or `pnpm install`) is run in `apps/cli` on a machine with no prior Playwright binaries
- **THEN** the `postinstall` script downloads the Chromium binary and `pixdom convert` succeeds without a browser launch error

#### Scenario: Re-install is idempotent
- **WHEN** `npm install` is run again on a machine that already has the Chromium binary installed
- **THEN** `playwright install chromium` exits quickly without re-downloading and the existing binary remains intact

### Requirement: --image flag
The `convert` subcommand SHALL accept `--image <path>` as a fourth mutually-exclusive input flag alongside `--html`, `--file`, and `--url`. When provided, `RenderInput` SHALL be set to `{ type: 'image', path: path.resolve(opts.image) }`. The path SHALL be resolved to an absolute path before passing to `render()`.

#### Scenario: --image produces output file
- **WHEN** `pixdom convert --image /path/to/photo.jpg --format png` is run
- **THEN** a PNG file is written to the output path and its absolute path is printed to stdout

#### Scenario: --image with --html exits with error
- **WHEN** `pixdom convert --image photo.jpg --html "<h1>Hi</h1>"` is run
- **THEN** stderr contains a mutual-exclusion error and the process exits with code 1

#### Scenario: --image with animated format exits with error
- **WHEN** `pixdom convert --image photo.jpg --format gif` is run
- **THEN** the process exits with code 1 (CAPTURE_FAILED propagated from render)

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
