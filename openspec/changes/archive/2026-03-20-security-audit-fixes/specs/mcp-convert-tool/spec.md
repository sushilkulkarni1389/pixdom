## MODIFIED Requirements

### Requirement: convert_html_to_asset handler
The `convert_html_to_asset` handler SHALL validate its input with Zod, resolve any `profile` to a `Profile` from `@pixdom/profiles` applying individual overrides, call `render()` from `@pixdom/core`, write the resulting buffer to the MCP output sandbox directory (see `mcp-output-sandbox` spec), and return a tool result containing the absolute output path and metadata. When an `output` parameter is provided, it SHALL be validated against the MCP output sandbox before rendering. When `output` is omitted, an auto-generated filename inside the sandbox SHALL be used. Input validation SHALL apply the same rules as the CLI `convert` command: resource limit checks for `width`, `height`, `fps`, and `duration` (if accepted); MCP output sandbox check for the `output` parameter; file input allowlist check for the `file` parameter (see `mcp-file-input-scope` spec); and extension validation for any file parameters. Validation errors SHALL be returned as `{ isError: true }` tool results without reaching `render()`.

#### Scenario: Simple HTML produces output file inside sandbox
- **WHEN** `convert_html_to_asset({ html: '<h1>Hello</h1>' })` is called
- **THEN** the result contains `{ path: '<absolute-path-inside-pixdom-output>', format: 'png', width: 1280, height: 720 }` and the file exists at the returned path inside `~/pixdom-output/`

#### Scenario: Profile parameter applied
- **WHEN** `convert_html_to_asset({ html: '<h1>Hi</h1>', profile: 'instagram' })` is called
- **THEN** the output image has dimensions 1080×1080 and the result metadata reflects those values

#### Scenario: render() error returned as MCP error
- **WHEN** `render()` returns `Result.err` (e.g., page load failure)
- **THEN** the tool returns `{ isError: true, content: [{ type: 'text', text: '<error message>' }] }` and does not throw

#### Scenario: Oversized width rejected before render
- **WHEN** `convert_html_to_asset({ html: 'x', width: 8000 })` is called
- **THEN** the tool returns `{ isError: true }` with `RESOURCE_LIMIT_EXCEEDED` in the message and `render()` is never called

#### Scenario: Output path outside sandbox rejected
- **WHEN** `convert_html_to_asset({ html: 'x', output: '/home/user/.bashrc' })` is called
- **THEN** the tool returns `{ isError: true }` with `MCP_OUTPUT_PATH_RESTRICTED` and no render occurs

#### Scenario: File input outside allowed dirs rejected
- **WHEN** `convert_html_to_asset({ file: '/etc/passwd' })` is called
- **THEN** the tool returns `{ isError: true }` with `MCP_FILE_PATH_RESTRICTED` and no render occurs

#### Scenario: Auto-generated path returned when output omitted
- **WHEN** `convert_html_to_asset({ html: '<p>hi</p>' })` is called without `output`
- **THEN** the result path matches the pattern `~/pixdom-output/pixdom-output-*-*.png`
