## MODIFIED Requirements

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

## ADDED Requirements

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
