## MODIFIED Requirements

### Requirement: generate_and_convert tool definition
The server SHALL register a tool named `generate_and_convert` with an input schema accepting: `prompt` (string, required — plain-text description of the desired visual), `profile` (string, optional — one of all canonical ProfileId slugs as defined in `@pixdom/types` `ProfileIdSchema`), `format` (string, optional, default `png`), `width` (number, optional, default 1280, max 7680), `height` (number, optional, default 720, max 4320), `quality` (number, optional, default 90), `model` (string, optional, default `claude-sonnet-4-20250514`), `output` (string, optional — custom output file path), `selector` (string, optional — CSS selector to capture a specific DOM element), `auto` (boolean, optional — enable smart auto mode), `fps` (number, optional, 1–60), `duration` (number, optional, 100–300000). The tool description SHALL include usage examples for animated output and profile usage.

#### Scenario: Tool appears in tools/list with full schema
- **WHEN** an MCP `tools/list` request is sent
- **THEN** `generate_and_convert` is listed with selector, auto, fps, duration, and all profile slugs in its parameter schema

#### Scenario: Required prompt param enforced
- **WHEN** `generate_and_convert` is called without the `prompt` parameter
- **THEN** the tool returns a result with `isError: true` and a structured error message

### Requirement: HTML generation via Claude API
The `generate_and_convert` handler SHALL call the Anthropic Claude API using `@anthropic-ai/sdk` with the system prompt loaded from `.claude/context/claude-integration.md` (falling back to a hardcoded minimal prompt if the file is absent) with `cache_control: { type: 'ephemeral' }` on the system prompt. The user message SHALL be the `prompt` parameter value. The API response SHALL be extracted as the HTML string for rendering.

#### Scenario: Prompt produces HTML
- **WHEN** `generate_and_convert({ prompt: 'A blue gradient background with centered white text "Hello"' })` is called with a valid `ANTHROPIC_API_KEY`
- **THEN** the Claude API is called and the response contains valid HTML markup

#### Scenario: Missing API key returns structured error
- **WHEN** `ANTHROPIC_API_KEY` is not set in the environment
- **THEN** the tool returns `{ isError: true, content: [{ type: 'text', text: '{"error":{"code":"...","message":"...","howToFix":"..."}}' }] }` without throwing

### Requirement: generate_and_convert render pipeline
After receiving the HTML from Claude, the `generate_and_convert` handler SHALL pass it to `render()` from `@pixdom/core` using the same profile/format/viewport resolution logic as `convert_html_to_asset`, including `selector`, `auto`, `fps`, and `duration` options. The output buffer SHALL be written to the configured output path and the absolute path returned in the tool result. Input validation SHALL apply the same resource limit and output path checks as `convert_html_to_asset` before any Claude API call is made. All errors SHALL be returned in the structured `{ error: { code, message, howToFix } }` format.

#### Scenario: End-to-end produces output file
- **WHEN** `generate_and_convert({ prompt: 'Simple red square' })` is called with a valid API key
- **THEN** the result contains an absolute file path and the file exists at that path

#### Scenario: render() error after generation returned as structured MCP error
- **WHEN** HTML generation succeeds but `render()` returns `Result.err`
- **THEN** the tool returns `{ isError: true }` with structured error JSON describing the render failure

#### Scenario: Oversized width rejected before Claude API call
- **WHEN** `generate_and_convert({ prompt: 'x', width: 8000 })` is called
- **THEN** the tool returns `{ isError: true }` with `RESOURCE_LIMIT_EXCEEDED` and the Claude API is never called

#### Scenario: selector passed to render options
- **WHEN** `generate_and_convert({ prompt: 'a card component', selector: '.card' })` is called
- **THEN** `render()` is called with `selector: '.card'` in the render options

#### Scenario: ANTHROPIC_API_KEY not leaked in error output
- **WHEN** any error is returned from `generate_and_convert`
- **THEN** the tool result content does not contain the value of `ANTHROPIC_API_KEY`

### Requirement: Error containment for generate_and_convert
The `generate_and_convert` handler SHALL catch all exceptions (including Anthropic API errors, network failures, and render errors) and return a `CallToolResult` with `isError: true` and structured error JSON. It SHALL never allow an unhandled exception to propagate to the MCP server transport.

#### Scenario: API error caught with structured response
- **WHEN** the Anthropic API returns an error response
- **THEN** the tool returns `{ isError: true, content: [{ type: 'text', text: '{"error":{...}}' }] }` and the server remains alive
