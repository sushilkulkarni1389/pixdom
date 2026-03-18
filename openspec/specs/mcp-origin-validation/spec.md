# mcp-origin-validation — requirements

### Requirement: MCP server binds to 127.0.0.1 only
The MCP server HTTP transport SHALL bind exclusively to `127.0.0.1` and SHALL NOT listen on `0.0.0.0` or any external interface. This prevents remote network access to the MCP server.

#### Scenario: Server is not reachable on external interface
- **WHEN** the MCP server is started
- **THEN** connections from non-localhost addresses are refused at the network level

#### Scenario: Server is reachable on localhost
- **WHEN** the MCP server is started
- **THEN** MCP tool calls from `127.0.0.1` succeed normally

### Requirement: Origin header validation on all MCP connections
The MCP server SHALL validate the `Origin` HTTP header on all incoming connections. Requests with an `Origin` header that does not match `http://localhost`, `http://localhost:<port>`, `http://127.0.0.1`, or `http://127.0.0.1:<port>` SHALL receive a `403 Forbidden` response and the connection SHALL be refused. Additional origins may be allowlisted via the `PIXDOM_MCP_ALLOWED_ORIGINS` environment variable (comma-separated list of full origin strings).

#### Scenario: Request with valid localhost Origin is accepted
- **WHEN** an MCP connection includes `Origin: http://localhost:3000`
- **THEN** the request is accepted and processed normally

#### Scenario: Request with external Origin is rejected with 403
- **WHEN** an MCP connection includes `Origin: https://attacker.com`
- **THEN** the server responds with `403 Forbidden` and the tool is not invoked

#### Scenario: Request with no Origin header is accepted (non-browser clients)
- **WHEN** an MCP connection has no `Origin` header (e.g., a direct MCP SDK client)
- **THEN** the request is accepted (Origin validation only applies when the header is present)

#### Scenario: PIXDOM_MCP_ALLOWED_ORIGINS permits additional origin
- **WHEN** `PIXDOM_MCP_ALLOWED_ORIGINS=https://myapp.internal` is set and a connection includes `Origin: https://myapp.internal`
- **THEN** the request is accepted

#### Scenario: DNS rebinding attack via non-localhost Origin is blocked
- **WHEN** a browser controlled by an attacker sends a request with `Origin: http://evil.com` to the MCP server port
- **THEN** the server responds with `403 Forbidden` regardless of the resolved IP

### Requirement: MCP tool inputs validated through same layer as CLI
MCP tool handler functions SHALL validate all input parameters using the same Zod schemas and validation rules as the CLI `convert` command, including: protocol/host validation for any URL parameter, resource limit checks for fps/duration/width/height, output path validation, and file extension validation. Validation errors SHALL be returned as MCP tool results with `isError: true`.

#### Scenario: file:// URL passed to MCP tool is rejected
- **WHEN** `convert_html_to_asset` is called with `url: "file:///etc/passwd"` (if a url param is added)
- **THEN** the tool returns `{ isError: true }` with `INVALID_URL_PROTOCOL` in the message

#### Scenario: Oversized fps value passed to MCP tool is rejected
- **WHEN** a tool is called with `fps: 200`
- **THEN** the tool returns `{ isError: true }` with `INVALID_FPS` in the message
