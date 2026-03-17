## ADDED Requirements

### Requirement: Package scaffold and server entry
`apps/mcp-server` SHALL be a valid pnpm workspace package named `@pixdom/mcp-server` with `package.json`, `tsconfig.json`, and `src/index.ts`. It SHALL declare `@modelcontextprotocol/sdk` and `@anthropic-ai/sdk` as runtime dependencies, and `@pixdom/core`, `@pixdom/profiles`, and `@pixdom/types` as workspace dependencies. It SHALL have zero direct Playwright, Sharp, or FFmpeg imports. The server SHALL start and remain running when `node dist/index.js` (or `tsx src/index.ts`) is executed.

#### Scenario: Server starts without error
- **WHEN** `node dist/index.js` (or equivalent dev command) is executed
- **THEN** the process starts without throwing and listens on stdio for MCP messages

#### Scenario: tools/list returns both tools
- **WHEN** an MCP `tools/list` request is sent to the server
- **THEN** the response includes `convert_html_to_asset` and `generate_and_convert` in the tools array

### Requirement: convert_html_to_asset tool definition
The server SHALL register a tool named `convert_html_to_asset` with an input schema accepting: `html` (string, required), `profile` (string, optional — one of `instagram | twitter | linkedin | square`), `format` (string, optional, default `png`), `width` (number, optional, default 1280), `height` (number, optional, default 720), `quality` (number, optional, default 90), `output` (string, optional — custom output file path).

#### Scenario: Tool appears in tools/list
- **WHEN** an MCP `tools/list` request is sent
- **THEN** `convert_html_to_asset` is listed with its parameter schema

#### Scenario: Required html param enforced
- **WHEN** `convert_html_to_asset` is called without the `html` parameter
- **THEN** the tool returns a result with `isError: true` and a validation error message

### Requirement: convert_html_to_asset handler
The `convert_html_to_asset` handler SHALL validate its input with Zod, resolve any `profile` to a `Profile` from `@pixdom/profiles` applying individual overrides, call `render()` from `@pixdom/core`, write the resulting buffer to `output/<uuid>.<format>`, and return a tool result containing the absolute output path and metadata.

#### Scenario: Simple HTML produces output file
- **WHEN** `convert_html_to_asset({ html: '<h1>Hello</h1>' })` is called
- **THEN** the result contains `{ path: '<absolute-path>', format: 'png', width: 1280, height: 720 }` and the file exists at the returned path

#### Scenario: Profile parameter applied
- **WHEN** `convert_html_to_asset({ html: '<h1>Hi</h1>', profile: 'instagram' })` is called
- **THEN** the output image has dimensions 1080×1080 and the result metadata reflects those values

#### Scenario: render() error returned as MCP error
- **WHEN** `render()` returns `Result.err` (e.g., page load failure)
- **THEN** the tool returns `{ isError: true, content: [{ type: 'text', text: '<error message>' }] }` and does not throw

### Requirement: Error containment for convert_html_to_asset
The `convert_html_to_asset` handler SHALL catch all exceptions and return a `CallToolResult` with `isError: true`. It SHALL never allow an unhandled exception to propagate to the MCP server transport.

#### Scenario: Unexpected exception caught
- **WHEN** an unexpected runtime error occurs inside the handler
- **THEN** the tool returns `{ isError: true, ... }` and the server process remains alive
