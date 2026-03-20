## MODIFIED Requirements

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
