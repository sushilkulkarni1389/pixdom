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
The `generate_and_convert` handler SHALL call the Anthropic Claude API using `@anthropic-ai/sdk` with the system prompt loaded from `.claude/context/claude-integration.md` (falling back to a hardcoded minimal prompt if the file is absent). The user message SHALL be the `prompt` parameter value. The raw API response text SHALL be passed through `robustHtmlExtract()` before use. If the extracted HTML is fewer than 50 characters, the handler SHALL return `{ isError: true }` with code `GENERATE_EMPTY_HTML` and SHALL NOT call `render()`.

#### Scenario: Prompt produces HTML
- **WHEN** `generate_and_convert({ prompt: 'A blue gradient background with centered white text "Hello"' })` is called with a valid `ANTHROPIC_API_KEY`
- **THEN** the Claude API is called, the response is extracted via `robustHtmlExtract()`, and the result contains valid HTML markup

#### Scenario: Missing API key returns error
- **WHEN** `ANTHROPIC_API_KEY` is not set in the environment
- **THEN** the tool returns `{ isError: true, content: [{ type: 'text', text: '...' }] }` without throwing

#### Scenario: Model returns preamble text — preamble stripped
- **WHEN** the Claude API response begins with `"Here is your HTML:\n<!DOCTYPE html>..."`
- **THEN** `robustHtmlExtract()` strips the preamble and `render()` receives HTML starting at `<!DOCTYPE html>`

#### Scenario: Model returns markdown-fenced HTML — fences stripped
- **WHEN** the Claude API response is ` ```html\n<!DOCTYPE html>...\n``` `
- **THEN** `robustHtmlExtract()` removes the fences and `render()` receives clean HTML

#### Scenario: Model returns no HTML — GENERATE_EMPTY_HTML returned
- **WHEN** the Claude API response contains no HTML markup (e.g., a refusal or an empty string)
- **THEN** the tool returns `{ isError: true }` with `error.code === 'GENERATE_EMPTY_HTML'` and `render()` is not called

### Requirement: generate_and_convert render pipeline
After extracting HTML from the Claude API response, the `generate_and_convert` handler SHALL pass it to `render()` from `@pixdom/core` using the same profile/format/viewport resolution logic as `convert_html_to_asset`. When the `profile` parameter is set, the handler SHALL also pass `profileViewport: true` in the `RenderOptions` so that auto element detection does not override the profile viewport dimensions. The output buffer SHALL be written to the MCP output sandbox directory (see `mcp-output-sandbox` spec). When an `output` parameter is provided, it SHALL be validated against the MCP output sandbox before any Claude API call is made. When `output` is omitted, an auto-generated filename inside the sandbox SHALL be used. The absolute path SHALL be returned in the tool result. Input validation SHALL apply the same resource limit and MCP output sandbox checks as `convert_html_to_asset` before any Claude API call is made.

#### Scenario: End-to-end produces output file inside sandbox
- **WHEN** `generate_and_convert({ prompt: 'Simple red square' })` is called with a valid API key
- **THEN** the result contains an absolute file path inside `~/pixdom-output/` and the file exists at that path

#### Scenario: Profile + auto preserves profile dimensions
- **WHEN** `generate_and_convert({ prompt: '...', profile: 'linkedin-post', format: 'gif', auto: true })` is called
- **THEN** the output file has dimensions 1200×1200 (linkedin-post profile), not the auto-detected element's bounding box

#### Scenario: render() error after generation returned as MCP error
- **WHEN** HTML generation succeeds but `render()` returns `Result.err`
- **THEN** the tool returns `{ isError: true, ... }` describing the render failure

#### Scenario: Oversized width rejected before Claude API call
- **WHEN** `generate_and_convert({ prompt: 'x', width: 8000 })` is called
- **THEN** the tool returns `{ isError: true }` with `RESOURCE_LIMIT_EXCEEDED` and the Claude API is never called

#### Scenario: ANTHROPIC_API_KEY not leaked in error output
- **WHEN** any error is returned from `generate_and_convert`
- **THEN** the tool result content does not contain the value of `ANTHROPIC_API_KEY`

#### Scenario: profileViewport not set when no profile given
- **WHEN** `generate_and_convert({ prompt: '...', auto: true })` is called without a profile
- **THEN** `render()` is called WITHOUT `profileViewport: true` and auto element detection drives capture normally

#### Scenario: Output path outside sandbox rejected before API call
- **WHEN** `generate_and_convert({ prompt: 'x', output: '/root/stolen.png' })` is called
- **THEN** the tool returns `{ isError: true }` with `MCP_OUTPUT_PATH_RESTRICTED` and the Claude API is never called

#### Scenario: Auto-generated path returned when output omitted
- **WHEN** `generate_and_convert({ prompt: 'A blue sky' })` is called without `output`
- **THEN** the result path matches the pattern `~/pixdom-output/pixdom-output-*-*.png`

### Requirement: Error containment for generate_and_convert
The `generate_and_convert` handler SHALL catch all exceptions (including Anthropic API errors, network failures, and render errors) and return a `CallToolResult` with `isError: true`. It SHALL never allow an unhandled exception to propagate to the MCP server transport.

#### Scenario: API error caught
- **WHEN** the Anthropic API returns an error response
- **THEN** the tool returns `{ isError: true, content: [{ type: 'text', text: '<error>' }] }` and the server remains alive
