## ADDED Requirements

### Requirement: MCP output path routed through sandbox, not validateOutputPath
In MCP context, the `output` parameter SHALL be validated by the MCP output sandbox middleware (see `mcp-output-sandbox` spec) instead of the CLI `validateOutputPath` function. `validateOutputPath` SHALL NOT be called for MCP tool invocations.

#### Scenario: MCP output path bypasses CLI validateOutputPath
- **WHEN** `convert_html_to_asset` is called via MCP with `output: '/tmp/out.png'`
- **THEN** the MCP sandbox check runs (and rejects, since `/tmp/` is outside `~/pixdom-output/`), and `validateOutputPath` is not invoked

#### Scenario: CLI validateOutputPath still runs for CLI invocations
- **WHEN** `pixdom convert --html "x" --output /tmp/out.png` is run via CLI
- **THEN** `validateOutputPath` runs its existing checks without any sandbox restriction
