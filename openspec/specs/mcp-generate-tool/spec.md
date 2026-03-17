## Requirements

### Requirement: generate_and_convert tool definition
The server SHALL register a tool named `generate_and_convert` with an input schema accepting: `prompt` (string, required — plain-text description of the desired visual), `profile` (string, optional), `format` (string, optional, default `png`), `width` (number, optional, default 1280), `height` (number, optional, default 720), `quality` (number, optional, default 90), `model` (string, optional, default `claude-haiku-4-5-20251001`), `output` (string, optional — custom output file path).

#### Scenario: Tool appears in tools/list
- **WHEN** an MCP `tools/list` request is sent
- **THEN** `generate_and_convert` is listed with its parameter schema

#### Scenario: Required prompt param enforced
- **WHEN** `generate_and_convert` is called without the `prompt` parameter
- **THEN** the tool returns a result with `isError: true` and a validation error message

### Requirement: HTML generation via Claude API
The `generate_and_convert` handler SHALL call the Anthropic Claude API using `@anthropic-ai/sdk` with the system prompt loaded from `.claude/context/claude-integration.md` (falling back to a hardcoded minimal prompt if the file is absent). The user message SHALL be the `prompt` parameter value. The API response SHALL be extracted as the HTML string for rendering.

#### Scenario: Prompt produces HTML
- **WHEN** `generate_and_convert({ prompt: 'A blue gradient background with centered white text "Hello"' })` is called with a valid `ANTHROPIC_API_KEY`
- **THEN** the Claude API is called and the response contains valid HTML markup

#### Scenario: Missing API key returns error
- **WHEN** `ANTHROPIC_API_KEY` is not set in the environment
- **THEN** the tool returns `{ isError: true, content: [{ type: 'text', text: '...' }] }` without throwing

### Requirement: generate_and_convert render pipeline
After receiving the HTML from Claude, the `generate_and_convert` handler SHALL pass it to `render()` from `@pixdom/core` using the same profile/format/viewport resolution logic as `convert_html_to_asset`. The output buffer SHALL be written to `output/<uuid>.<format>` and the absolute path returned in the tool result.

#### Scenario: End-to-end produces output file
- **WHEN** `generate_and_convert({ prompt: 'Simple red square' })` is called with a valid API key
- **THEN** the result contains an absolute file path and the file exists at that path

#### Scenario: render() error after generation returned as MCP error
- **WHEN** HTML generation succeeds but `render()` returns `Result.err`
- **THEN** the tool returns `{ isError: true, ... }` describing the render failure

### Requirement: Error containment for generate_and_convert
The `generate_and_convert` handler SHALL catch all exceptions (including Anthropic API errors, network failures, and render errors) and return a `CallToolResult` with `isError: true`. It SHALL never allow an unhandled exception to propagate to the MCP server transport.

#### Scenario: API error caught
- **WHEN** the Anthropic API returns an error response
- **THEN** the tool returns `{ isError: true, content: [{ type: 'text', text: '<error>' }] }` and the server remains alive
