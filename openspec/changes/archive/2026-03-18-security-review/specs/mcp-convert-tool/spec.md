## MODIFIED Requirements

### Requirement: convert_html_to_asset handler
The `convert_html_to_asset` handler SHALL validate its input with Zod, resolve any `profile` to a `Profile` from `@pixdom/profiles` applying individual overrides, call `render()` from `@pixdom/core`, write the resulting buffer to `output/<uuid>.<format>`, and return a tool result containing the absolute output path and metadata. Input validation SHALL apply the same rules as the CLI `convert` command: resource limit checks for `width`, `height`, `fps`, and `duration` (if accepted); output path validation for the `output` parameter; and extension validation for any file parameters. Validation errors SHALL be returned as `{ isError: true }` tool results without reaching `render()`.

#### Scenario: Simple HTML produces output file
- **WHEN** `convert_html_to_asset({ html: '<h1>Hello</h1>' })` is called
- **THEN** the result contains `{ path: '<absolute-path>', format: 'png', width: 1280, height: 720 }` and the file exists at the returned path

#### Scenario: Profile parameter applied
- **WHEN** `convert_html_to_asset({ html: '<h1>Hi</h1>', profile: 'instagram' })` is called
- **THEN** the output image has dimensions 1080×1080 and the result metadata reflects those values

#### Scenario: render() error returned as MCP error
- **WHEN** `render()` returns `Result.err` (e.g., page load failure)
- **THEN** the tool returns `{ isError: true, content: [{ type: 'text', text: '<error message>' }] }` and does not throw

#### Scenario: Oversized width rejected before render
- **WHEN** `convert_html_to_asset({ html: 'x', width: 8000 })` is called
- **THEN** the tool returns `{ isError: true }` with `RESOURCE_LIMIT_EXCEEDED` in the message and `render()` is never called
