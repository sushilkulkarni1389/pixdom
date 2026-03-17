# apps/mcp-server — requirements

## Capabilities
- Exposes two MCP tools: convert_html_to_asset and generate_and_convert
- convert_html_to_asset: accepts html, profile, format, width, height params
- generate_and_convert: accepts a prompt, generates HTML via Claude API, then converts
- Returns asset path and metadata in tool response
- Starts as a stdio MCP server via node dist/index.js

## Constraints
- Tool handlers never throw — all errors returned as MCP error responses
- Imports @pixdom/core and @pixdom/profiles only — no direct Playwright usage
- System prompt for HTML generation is loaded from .claude/context/claude-integration.md
- No direct file system writes outside of output/ directory

## v1 acceptance criteria
- [ ] Server starts without error via node dist/index.js
- [ ] convert_html_to_asset returns a valid asset path for simple HTML input
- [ ] generate_and_convert produces an asset from a plain text prompt
- [ ] Invalid params return a structured MCP error, not an uncaught exception
- [ ] Tool list is discoverable via MCP tools/list request
