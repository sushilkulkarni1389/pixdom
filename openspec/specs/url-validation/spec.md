# url-validation — requirements

### Requirement: Protocol restriction for --url
The CLI SHALL reject any `--url` value whose protocol is not `http:` or `https:`. The rejection SHALL occur at parse time before any browser is launched. The error code SHALL be `INVALID_URL_PROTOCOL`.

#### Scenario: file:// URL rejected
- **WHEN** `pixdom convert --url file:///etc/passwd` is run
- **THEN** the process exits with code 1, stderr contains `INVALID_URL_PROTOCOL`, and no browser is launched

#### Scenario: ftp:// URL rejected
- **WHEN** `pixdom convert --url ftp://example.com/file` is run
- **THEN** the process exits with code 1 and stderr contains `INVALID_URL_PROTOCOL`

#### Scenario: data:// URL rejected
- **WHEN** `pixdom convert --url "data:text/html,<h1>hi</h1>"` is run
- **THEN** the process exits with code 1 and stderr contains `INVALID_URL_PROTOCOL`

#### Scenario: javascript:// URL rejected
- **WHEN** `pixdom convert --url "javascript:alert(1)"` is run
- **THEN** the process exits with code 1 and stderr contains `INVALID_URL_PROTOCOL`

#### Scenario: http:// URL accepted
- **WHEN** `pixdom convert --url http://example.com` is run
- **THEN** the protocol check passes and rendering proceeds normally

#### Scenario: https:// URL accepted
- **WHEN** `pixdom convert --url https://example.com` is run
- **THEN** the protocol check passes and rendering proceeds normally

### Requirement: Private and loopback host blocking for --url
After protocol validation, the CLI SHALL resolve the `--url` hostname via DNS and reject the URL if the resolved IP address falls within any blocked range: `127.0.0.0/8` (loopback), `10.0.0.0/8` / `172.16.0.0/12` / `192.168.0.0/16` (RFC1918 private), `169.254.0.0/16` (link-local / cloud metadata), `::1` or `fc00::/7` (IPv6 private). The error code SHALL be `INVALID_URL_HOST`. The DNS lookup SHALL occur before any browser is launched.

#### Scenario: localhost URL rejected by default
- **WHEN** `pixdom convert --url http://localhost:3000` is run without `--allow-local`
- **THEN** the process exits with code 1 and stderr contains `INVALID_URL_HOST`

#### Scenario: 127.0.0.1 URL rejected by default
- **WHEN** `pixdom convert --url http://127.0.0.1:8080` is run without `--allow-local`
- **THEN** the process exits with code 1 and stderr contains `INVALID_URL_HOST`

#### Scenario: 169.254.169.254 (AWS metadata) URL rejected
- **WHEN** `pixdom convert --url http://169.254.169.254/latest/meta-data/` is run
- **THEN** the process exits with code 1 and stderr contains `INVALID_URL_HOST`

#### Scenario: Private RFC1918 range URL rejected
- **WHEN** `pixdom convert --url http://192.168.1.1` is run
- **THEN** the process exits with code 1 and stderr contains `INVALID_URL_HOST`

#### Scenario: Public URL with valid IP passes
- **WHEN** `pixdom convert --url https://example.com` is run and `example.com` resolves to a public IP
- **THEN** the host check passes and rendering proceeds normally

### Requirement: --allow-local flag bypasses host blocking
The `convert` subcommand SHALL accept `--allow-local` as a boolean flag. When set, the private/loopback host check (but not the protocol check) SHALL be skipped, allowing `http://localhost`, `http://127.0.0.1`, and RFC1918 URLs to be rendered. A warning SHALL be printed to stderr when `--allow-local` is active.

#### Scenario: --allow-local permits localhost render
- **WHEN** `pixdom convert --url http://localhost:3000 --allow-local` is run
- **THEN** the host check is bypassed and rendering proceeds, with a warning printed to stderr

#### Scenario: --allow-local does not bypass protocol check
- **WHEN** `pixdom convert --url file:///etc/passwd --allow-local` is run
- **THEN** the process exits with code 1 and stderr contains `INVALID_URL_PROTOCOL`

#### Scenario: Warning printed when --allow-local active
- **WHEN** `pixdom convert --url http://localhost:3000 --allow-local` is run
- **THEN** stderr contains a warning that local rendering is enabled
