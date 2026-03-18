## MODIFIED Requirements

### Requirement: generate_and_convert render pipeline
After receiving the HTML from Claude, the `generate_and_convert` handler SHALL pass it to `render()` from `@pixdom/core` using the same profile/format/viewport resolution logic as `convert_html_to_asset`. The output buffer SHALL be written to `output/<uuid>.<format>` and the absolute path returned in the tool result. Input validation SHALL apply the same resource limit and output path checks as `convert_html_to_asset` before any Claude API call is made.

#### Scenario: End-to-end produces output file
- **WHEN** `generate_and_convert({ prompt: 'Simple red square' })` is called with a valid API key
- **THEN** the result contains an absolute file path and the file exists at that path

#### Scenario: render() error after generation returned as MCP error
- **WHEN** HTML generation succeeds but `render()` returns `Result.err`
- **THEN** the tool returns `{ isError: true, ... }` describing the render failure

#### Scenario: Oversized width rejected before Claude API call
- **WHEN** `generate_and_convert({ prompt: 'x', width: 8000 })` is called
- **THEN** the tool returns `{ isError: true }` with `RESOURCE_LIMIT_EXCEEDED` and the Claude API is never called

#### Scenario: ANTHROPIC_API_KEY not leaked in error output
- **WHEN** any error is returned from `generate_and_convert`
- **THEN** the tool result content does not contain the value of `ANTHROPIC_API_KEY`
