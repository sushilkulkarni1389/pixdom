# error-formatter — requirements

### Requirement: Five-field error output format
The CLI error formatter SHALL output errors to stderr in the following structure:

```
✗ <title>
  What happened: <explanation>
  How to fix:    <recovery instruction>
  Example:       <corrected command> (omitted when non-trivial)
  Docs:          <flag or --help section name>
```

The `✗` symbol and field labels SHALL be rendered in ANSI color when color is enabled. All output SHALL go to stderr only; stdout SHALL remain empty on error.

#### Scenario: Structured error written to stderr
- **WHEN** `render()` returns `{ ok: false, error: { code: 'NO_ANIMATION_DETECTED' } }`
- **THEN** stderr contains lines for `What happened:`, `How to fix:`, and `Docs:` and stdout is empty

#### Scenario: Example line included when correction is simple
- **WHEN** the error has a registered single-flag correction (e.g. add `--duration 1000`)
- **THEN** stderr contains an `Example:` line showing the original command with the corrected flag spliced in

#### Scenario: Example line omitted for complex errors
- **WHEN** the error code is `FFMPEG_ERROR`, `SHARP_ERROR`, or `PLAYWRIGHT_ERROR`
- **THEN** stderr does NOT contain an `Example:` line

### Requirement: Registered message template for every RenderErrorCode
The error formatter SHALL have a registered template for each of the following codes: `NO_ANIMATION_DETECTED`, `SELECTOR_NOT_FOUND`, `INVALID_FILE_TYPE`, `FILE_NOT_FOUND`, `IMAGE_NOT_FOUND`, `BROWSER_LAUNCH_FAILED`, `PAGE_LOAD_FAILED`, `CAPTURE_FAILED`, `ENCODE_FAILED`, `SHARP_ERROR`, `INVALID_URL_PROTOCOL`, `INVALID_URL_HOST`, `INVALID_OUTPUT_PATH`, `INVALID_FPS`, `INVALID_DURATION`, `RESOURCE_LIMIT_EXCEEDED`. Each template SHALL supply at minimum a `title` and `howToFix` string.

#### Scenario: All known codes produce structured output
- **WHEN** `formatError()` is called with any registered error code
- **THEN** the output includes a non-empty `How to fix:` line specific to that code

#### Scenario: INVALID_URL_PROTOCOL produces meaningful error
- **WHEN** `formatError()` is called with `{ code: 'INVALID_URL_PROTOCOL' }`
- **THEN** stderr explains that only http:// and https:// URLs are supported

#### Scenario: INVALID_URL_HOST produces meaningful error
- **WHEN** `formatError()` is called with `{ code: 'INVALID_URL_HOST' }`
- **THEN** stderr explains that loopback and private addresses are blocked, and mentions --allow-local

#### Scenario: RESOURCE_LIMIT_EXCEEDED includes limit hint
- **WHEN** `formatError()` is called with `{ code: 'RESOURCE_LIMIT_EXCEEDED', message: '...' }`
- **THEN** stderr includes the message with specific limit information

#### Scenario: Unknown error code uses generic fallback template
- **WHEN** `formatError()` is called with an unrecognised error code
- **THEN** stderr contains the raw error code, the raw message, and a prompt to file a bug report at the pixdom issue tracker

### Requirement: Secret scrubbing in error context
The error formatter SHALL scan error context objects for keys matching the pattern `/key|token|secret|password|api_?key/i` and replace their string values with `[REDACTED]` before formatting. This prevents API keys and tokens from appearing in error output.

#### Scenario: ANTHROPIC_API_KEY redacted in error context
- **WHEN** an error context object contains `{ ANTHROPIC_API_KEY: 'sk-ant-...' }` and is formatted
- **THEN** the formatted output contains `[REDACTED]` instead of the key value

#### Scenario: Non-secret context values pass through
- **WHEN** an error context object contains `{ format: 'gif', width: 1080 }`
- **THEN** those values appear unmodified in the formatted output

### Requirement: Relative paths in error messages
When error messages reference file system paths, the formatter SHALL convert absolute paths to paths relative to `process.cwd()` using `path.relative()` before displaying them to the user.

#### Scenario: Absolute path converted to relative in error output
- **WHEN** an error message contains `/home/user/project/input.html` and cwd is `/home/user/project`
- **THEN** the formatted output shows `input.html` rather than the absolute path

### Requirement: FFmpeg stderr sanitisation
When the error formatter displays FFmpeg stderr output (in `ENCODE_FAILED` errors), it SHALL scan the stderr string for patterns matching base64-like tokens (`[A-Za-z0-9+/=]{20,}`) and redact them before display.

#### Scenario: Long base64-like string in FFmpeg stderr is redacted
- **WHEN** FFmpeg stderr contains a string that looks like a credential token (≥20 base64 characters)
- **THEN** the formatted error output shows `[REDACTED]` in place of that token

### Requirement: --no-color flag and NO_COLOR env var
The CLI SHALL accept `--no-color` as a global boolean flag. When `--no-color` is set, or when the `NO_COLOR` environment variable is set (any non-empty value), or when stderr is not a TTY, the formatter SHALL emit plain text with no ANSI escape sequences.

#### Scenario: --no-color suppresses ANSI codes
- **WHEN** `pixdom convert --html "x" --no-color` produces an error
- **THEN** stderr contains no ANSI escape sequences (no `\x1b[` bytes)

#### Scenario: NO_COLOR env var suppresses ANSI codes
- **WHEN** `NO_COLOR=1 pixdom convert --html "x"` produces an error
- **THEN** stderr contains no ANSI escape sequences

#### Scenario: ANSI codes present in TTY without --no-color
- **WHEN** stderr is a TTY and `--no-color` is not set and `NO_COLOR` is unset
- **THEN** the `✗` prefix and field labels in stderr contain ANSI color codes

### Requirement: argv captured before parse for example reconstruction
The CLI entry point SHALL capture `process.argv.slice(2)` before calling `program.parse()`. This original argv SHALL be passed to `formatError()` so the Example line can be constructed by splicing in corrected flags.

#### Scenario: Example reflects original command tokens
- **WHEN** user runs `pixdom convert --html "<div>" --format gif` and gets `NO_ANIMATION_DETECTED`
- **THEN** the `Example:` line contains `--format gif` with `--duration` added alongside it

### Requirement: Raw detail appended for encoder and processor errors
For `ENCODE_FAILED` and `SHARP_ERROR`, the formatter SHALL append the raw underlying error message as an indented `Detail:` block after the standard fields.

#### Scenario: FFMPEG error includes raw detail
- **WHEN** `render()` returns `{ code: 'ENCODE_FAILED', message: 'exit code 1: ...' }`
- **THEN** stderr contains a `Detail:` line with the raw FFmpeg message

#### Scenario: SHARP_ERROR includes raw detail
- **WHEN** `render()` returns `{ code: 'SHARP_ERROR', message: 'Input file is missing' }`
- **THEN** stderr contains a `Detail:` line with the raw Sharp message
