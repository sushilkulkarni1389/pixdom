## Requirements

### Requirement: MCP file input allowlist
The MCP server SHALL define an allowlist of directories from which `--file` inputs are permitted. The default allowlist SHALL be `~/pixdom-input/`, `~/Downloads/`, and `~/Desktop/` (each expanded to an absolute path at startup). The allowlist MAY be extended via the `PIXDOM_MCP_ALLOWED_DIRS` environment variable (colon-separated list of absolute or `~`-relative paths).

#### Scenario: Default allowlist includes standard directories
- **WHEN** `PIXDOM_MCP_ALLOWED_DIRS` is not set
- **THEN** the effective allowlist contains the absolute paths of `~/pixdom-input/`, `~/Downloads/`, and `~/Desktop/`

#### Scenario: Custom allowlist extends defaults
- **WHEN** `PIXDOM_MCP_ALLOWED_DIRS=/srv/assets:/home/user/work` is set
- **THEN** the effective allowlist contains those two directories in addition to (or instead of, per design decision) the defaults

### Requirement: MCP file input path validation
When `convert_html_to_asset` receives a `file` parameter in MCP context, the server SHALL resolve it to a real absolute path via `fs.realpathSync()` and verify the resolved path starts with one of the allowed directories. If it does not, the tool SHALL return `{ isError: true }` with error code `MCP_FILE_PATH_RESTRICTED` before any render occurs.

#### Scenario: File inside allowed directory accepted
- **WHEN** `file` resolves to `~/Downloads/page.html`
- **THEN** the tool proceeds to render

#### Scenario: File outside all allowed directories rejected
- **WHEN** `file` is set to `/etc/passwd`
- **THEN** the tool returns `{ isError: true }` with `MCP_FILE_PATH_RESTRICTED` and no render occurs

#### Scenario: Symlink pointing outside allowed directory rejected
- **WHEN** `file` is a symlink inside `~/Downloads/` that resolves (via `realpathSync`) to `/home/user/.ssh/config`
- **THEN** the real path fails the allowlist check and the tool returns `MCP_FILE_PATH_RESTRICTED`

#### Scenario: Non-existent file returns restricted error
- **WHEN** `file` points to a path that does not exist
- **THEN** `realpathSync` throws `ENOENT` and the tool returns `{ isError: true }` with `MCP_FILE_PATH_RESTRICTED` and a "file not found" message

#### Scenario: Error message includes allowlist and override instructions
- **WHEN** `MCP_FILE_PATH_RESTRICTED` is returned
- **THEN** the error message text lists the effective allowed directories and mentions `PIXDOM_MCP_ALLOWED_DIRS`

### Requirement: Sub-resource file: request blocking
When a render is triggered from a `--file` input in MCP context, the Playwright request interception layer SHALL allow the `file:` protocol only for the main document navigation. All sub-resource `file:` requests (stylesheets, scripts, iframes, images loaded via `file:`) SHALL be aborted.

#### Scenario: Main document file: navigation allowed
- **WHEN** an MCP render uses a local HTML file as the main document
- **THEN** the page loads successfully (main document request is not blocked)

#### Scenario: Linked local stylesheet blocked
- **WHEN** the HTML file contains `<link rel="stylesheet" href="file:///etc/local.css">`
- **THEN** the stylesheet request is aborted and the page renders without it

#### Scenario: iframe with local source blocked
- **WHEN** the HTML file contains `<iframe src="file:///home/user/.bashrc">`
- **THEN** the iframe request is aborted

#### Scenario: Script tag with local source blocked
- **WHEN** the HTML file contains `<script src="file:///etc/config.js">`
- **THEN** the script request is aborted

#### Scenario: CLI --file flag not affected by sub-resource blocking
- **WHEN** `pixdom convert --file page.html` is run via CLI
- **THEN** sub-resource `file:` requests are not blocked (CLI context does not apply MCP sub-resource blocking)

### Requirement: --status shows allowed input directories
`pixdom mcp --status` SHALL include an "Allowed input dirs" line listing the effective allowlist (all directories, including any from `PIXDOM_MCP_ALLOWED_DIRS`).

#### Scenario: Status shows default allowed dirs
- **WHEN** `PIXDOM_MCP_ALLOWED_DIRS` is not set and `pixdom mcp --status` is run
- **THEN** stdout contains "Allowed input dirs:" followed by `~/pixdom-input/`, `~/Downloads/`, `~/Desktop/`

#### Scenario: Status shows custom allowed dirs
- **WHEN** `PIXDOM_MCP_ALLOWED_DIRS=/srv/assets` is set and `pixdom mcp --status` is run
- **THEN** stdout contains `/srv/assets` in the allowed dirs list
