## Requirements

### Requirement: MCP output sandbox directory
The MCP server SHALL define a sandbox output directory (`PIXDOM_MCP_OUTPUT_DIR`) that defaults to `~/pixdom-output/` (expanded to an absolute path at startup). The value MAY be overridden via the `PIXDOM_MCP_OUTPUT_DIR` environment variable. The directory SHALL be created automatically on first use with permissions `0o755` if it does not already exist.

#### Scenario: Default sandbox directory created on first use
- **WHEN** `PIXDOM_MCP_OUTPUT_DIR` is not set and the MCP server handles its first output-producing tool call
- **THEN** `~/pixdom-output/` is created with permissions `0o755` if it did not exist, and the output file is written inside it

#### Scenario: Custom sandbox directory honoured
- **WHEN** `PIXDOM_MCP_OUTPUT_DIR=/tmp/mcp-out` is set in the MCP server environment
- **THEN** all MCP tool output is written to `/tmp/mcp-out/` and `~/pixdom-output/` is not created

#### Scenario: Custom sandbox directory created automatically
- **WHEN** `PIXDOM_MCP_OUTPUT_DIR` is set to a path that does not exist
- **THEN** the directory is created at first use with permissions `0o755`

### Requirement: MCP output path restriction
When an MCP tool call includes an explicit `output` parameter, the MCP server SHALL resolve it to an absolute path via `path.resolve()` and verify the resolved path starts with `PIXDOM_MCP_OUTPUT_DIR`. If it does not, the tool SHALL return `{ isError: true }` with error code `MCP_OUTPUT_PATH_RESTRICTED` before any render occurs.

#### Scenario: Path inside sandbox accepted
- **WHEN** `output` resolves to `~/pixdom-output/result.png`
- **THEN** the tool proceeds to render and writes the file at that path

#### Scenario: Absolute path outside sandbox rejected
- **WHEN** `output` is set to `/home/user/.ssh/authorized_keys`
- **THEN** the tool returns `{ isError: true }` with `MCP_OUTPUT_PATH_RESTRICTED` in the message and no render occurs

#### Scenario: Home-relative path outside sandbox rejected
- **WHEN** `output` is set to `~/.bashrc`
- **THEN** the tool returns `{ isError: true }` with `MCP_OUTPUT_PATH_RESTRICTED` and no file is written

#### Scenario: Path traversal via `../` rejected
- **WHEN** `output` is set to `~/pixdom-output/../.ssh/id_rsa`
- **THEN** `path.resolve()` collapses the traversal and the resolved path fails the prefix check, returning `MCP_OUTPUT_PATH_RESTRICTED`

#### Scenario: Error message includes override instructions
- **WHEN** `MCP_OUTPUT_PATH_RESTRICTED` is returned
- **THEN** the error message text contains "MCP server only writes to" and "PIXDOM_MCP_OUTPUT_DIR"

### Requirement: MCP auto-generated output filename
When an MCP tool call does NOT include an `output` parameter, the MCP server SHALL auto-generate a filename inside `PIXDOM_MCP_OUTPUT_DIR` using the pattern `pixdom-output-<epoch-ms>-<4-hex-chars>.<format>` and write the output there. The tool result SHALL include the absolute generated path.

#### Scenario: Auto-generated path returned in result
- **WHEN** `convert_html_to_asset({ html: '<h1>Hi</h1>' })` is called without an `output` parameter
- **THEN** the tool result contains an absolute path matching `~/pixdom-output/pixdom-output-*.png`

#### Scenario: Auto-generated filenames are unique under concurrent calls
- **WHEN** two concurrent MCP tool calls are made without an `output` parameter at the same millisecond
- **THEN** the 4-hex-char random suffix ensures the two filenames do not collide

### Requirement: CLI output path validation unchanged
The CLI `validateOutputPath` function SHALL NOT be modified by this change. MCP sandboxing is implemented exclusively in MCP server middleware and does not affect CLI invocations.

#### Scenario: CLI accepts arbitrary writable output paths
- **WHEN** `pixdom convert --html "x" --output /tmp/out.png` is run via CLI
- **THEN** the output is written to `/tmp/out.png` without any sandbox restriction
