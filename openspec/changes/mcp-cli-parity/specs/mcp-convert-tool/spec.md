## MODIFIED Requirements

### Requirement: convert_html_to_asset tool definition
The server SHALL register a tool named `convert_html_to_asset` with an input schema accepting mutually exclusive input modes — exactly one of: `html` (string, optional — inline HTML markup), `url` (string, optional — http/https URL), `file` (string, optional — absolute path to .html/.htm file), `image` (string, optional — absolute path to image file). Output options: `profile` (string, optional — one of all canonical ProfileId slugs as defined in `@pixdom/types` `ProfileIdSchema`), `format` (string, optional, default `png`), `width` (number, optional, default 1280, max 7680), `height` (number, optional, default 720, max 4320), `quality` (number, optional, default 90). Processing flags: `selector` (string, optional — CSS selector to capture a specific DOM element), `auto` (boolean, optional — enable smart auto mode for element + duration + fps detection), `autoSize` (boolean, optional — auto-detect content dimensions), `fps` (number, optional, 1–60 — frame rate for animated output), `duration` (number, optional, 100–300000 — animation cycle length in ms), `allowLocal` (boolean, optional — permit localhost/private-network URLs, for dev use only). `output` (string, optional — custom output file path). The tool description SHALL include usage examples for selector, animated output, and profile usage. The profile parameter description SHALL list all canonical slugs.

#### Scenario: Tool appears in tools/list with full schema
- **WHEN** an MCP `tools/list` request is sent
- **THEN** `convert_html_to_asset` is listed with all input mode fields and all processing flag fields in its parameter schema

#### Scenario: url input accepted
- **WHEN** `convert_html_to_asset({ url: 'https://example.com' })` is called
- **THEN** the handler processes the URL input and returns a result without `isError: true`

#### Scenario: file input accepted
- **WHEN** `convert_html_to_asset({ file: '/absolute/path/to/page.html' })` is called with a valid HTML file
- **THEN** the handler processes the file input and returns a result without `isError: true`

#### Scenario: image input accepted
- **WHEN** `convert_html_to_asset({ image: '/absolute/path/to/photo.png' })` is called with a valid image file
- **THEN** the handler bypasses the browser and returns a result without `isError: true`

#### Scenario: zero inputs rejected
- **WHEN** `convert_html_to_asset({})` is called with no input mode provided
- **THEN** the tool returns `{ isError: true }` with a structured error including `code: 'INVALID_INPUT'` and a `howToFix` field

#### Scenario: multiple inputs rejected
- **WHEN** `convert_html_to_asset({ html: '<h1>Hi</h1>', url: 'https://example.com' })` is called
- **THEN** the tool returns `{ isError: true }` with a structured error including `code: 'INVALID_INPUT'`

### Requirement: convert_html_to_asset handler
The `convert_html_to_asset` handler SHALL validate its input, resolve any `profile` to a `Profile` from `@pixdom/profiles` applying individual overrides, call `render()` from `@pixdom/core`, write the resulting buffer to the output path, and return a tool result containing the absolute output path and metadata. Input validation SHALL apply the same rules as the CLI `convert` command: URL protocol and DNS-based host validation (blocking private IPs unless `allowLocal` is true), file path resolution via `realpathSync` with extension and magic-byte validation, output path validation (no shell metacharacters, no `/dev/`, `/proc/`, `/sys/` prefixes), and resource limit checks for `width`, `height`, `fps`, `duration`, and total frame count (max 3600). All validation errors SHALL be returned as structured `{ isError: true }` tool results with `{ error: { code, message, howToFix } }` in the content text.

#### Scenario: Simple HTML produces output file
- **WHEN** `convert_html_to_asset({ html: '<h1>Hello</h1>' })` is called
- **THEN** the result contains `{ path: '<absolute-path>', format: 'png', width: 1280, height: 720 }` and the file exists at the returned path

#### Scenario: Profile parameter applied
- **WHEN** `convert_html_to_asset({ html: '<h1>Hi</h1>', profile: 'instagram' })` is called
- **THEN** the output image has dimensions 1080×1080 and the result metadata reflects those values

#### Scenario: render() error returned as structured MCP error
- **WHEN** `render()` returns `Result.err`
- **THEN** the tool returns `{ isError: true, content: [{ type: 'text', text: '{"error":{"code":"...","message":"...","howToFix":"..."}}' }] }` and does not throw

#### Scenario: Oversized width rejected before render
- **WHEN** `convert_html_to_asset({ html: 'x', width: 8000 })` is called
- **THEN** the tool returns `{ isError: true }` with `RESOURCE_LIMIT_EXCEEDED` in the structured error and `render()` is never called

#### Scenario: Private URL blocked
- **WHEN** `convert_html_to_asset({ url: 'http://192.168.1.1/' })` is called without `allowLocal`
- **THEN** the tool returns `{ isError: true }` with `code: 'INVALID_URL_HOST'` and `render()` is never called

#### Scenario: file:// URL blocked
- **WHEN** `convert_html_to_asset({ url: 'file:///etc/passwd' })` is called
- **THEN** the tool returns `{ isError: true }` with `code: 'INVALID_URL_PROTOCOL'`

#### Scenario: allowLocal permits localhost URL
- **WHEN** `convert_html_to_asset({ url: 'http://localhost:3000', allowLocal: true })` is called
- **THEN** the handler proceeds to render (no INVALID_URL_HOST error) and a warning is written to stderr

#### Scenario: Invalid output path rejected
- **WHEN** `convert_html_to_asset({ html: 'x', output: '/proc/self/mem' })` is called
- **THEN** the tool returns `{ isError: true }` with `code: 'INVALID_OUTPUT_PATH'`

#### Scenario: selector passed to render options
- **WHEN** `convert_html_to_asset({ html: '<div id="card">hi</div>', selector: '#card' })` is called
- **THEN** `render()` is called with `selector: '#card'` in the options

#### Scenario: Frame count limit enforced
- **WHEN** `convert_html_to_asset({ html: 'x', format: 'gif', fps: 60, duration: 300000 })` is called (60 × 300 = 18000 frames)
- **THEN** the tool returns `{ isError: true }` with `code: 'RESOURCE_LIMIT_EXCEEDED'` before calling `render()`

### Requirement: Error containment for convert_html_to_asset
The `convert_html_to_asset` handler SHALL catch all exceptions and return a `CallToolResult` with `isError: true` and a structured error JSON string. It SHALL never allow an unhandled exception to propagate to the MCP server transport.

#### Scenario: Unexpected exception caught
- **WHEN** an unexpected runtime error occurs inside the handler
- **THEN** the tool returns `{ isError: true, content: [{ type: 'text', text: '{"error":{...}}' }] }` and the server process remains alive

## ADDED Requirements

### Requirement: Structured error response format
All `{ isError: true }` responses from both MCP tools SHALL include a `content` array with a single `{ type: 'text' }` element whose `text` is a JSON string matching the shape `{ "error": { "code": "<RenderErrorCode>", "message": "<human-readable>", "howToFix": "<actionable guidance>" } }`. Generic exceptions that do not map to a `RenderErrorCode` SHALL use `code: "INTERNAL_ERROR"`.

#### Scenario: Structured error parseable by caller
- **WHEN** any MCP tool returns `{ isError: true }`
- **THEN** `JSON.parse(result.content[0].text)` succeeds and the resulting object has `.error.code`, `.error.message`, and `.error.howToFix` string fields
