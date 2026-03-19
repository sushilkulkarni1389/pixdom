## MODIFIED Requirements

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
After extracting HTML from the Claude API response, the `generate_and_convert` handler SHALL pass it to `render()` from `@pixdom/core` using the same profile/format/viewport resolution logic as `convert_html_to_asset`. When the `profile` parameter is set, the handler SHALL also pass `profileViewport: true` in the `RenderOptions` so that auto element detection does not override the profile viewport dimensions. The output buffer SHALL be written to `output/<uuid>.<format>` and the absolute path returned in the tool result.

#### Scenario: End-to-end produces output file
- **WHEN** `generate_and_convert({ prompt: 'Simple red square' })` is called with a valid API key
- **THEN** the result contains an absolute file path and the file exists at that path

#### Scenario: Profile + auto preserves profile dimensions
- **WHEN** `generate_and_convert({ prompt: '...', profile: 'linkedin-post', format: 'gif', auto: true })` is called
- **THEN** the output file has dimensions 1200×1200 (linkedin-post profile), not the auto-detected element's bounding box

#### Scenario: render() error after generation returned as MCP error
- **WHEN** HTML generation succeeds but `render()` returns `Result.err`
- **THEN** the tool returns `{ isError: true, ... }` describing the render failure

#### Scenario: profileViewport not set when no profile given
- **WHEN** `generate_and_convert({ prompt: '...', auto: true })` is called without a profile
- **THEN** `render()` is called WITHOUT `profileViewport: true` and auto element detection drives capture normally
