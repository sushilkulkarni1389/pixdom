## ADDED Requirements

### Requirement: Playwright request guard for all input types
`packages/core` SHALL export an `installRequestGuard(page, options)` utility that attaches a `page.route('**')` handler to the given Playwright page. The handler SHALL re-evaluate every outgoing request URL against the same protocol/host blocklist used by CLI URL validation (http/https only; no loopback, private, or link-local hosts). Blocked requests SHALL be aborted with `route.abort('blockedbyclient')`. The guard SHALL be installed regardless of input type (`--url`, `--html`, `--file`, `--image`). The `--allow-local` flag, when set in `RenderOptions`, SHALL disable host blocking within the guard (protocol blocking remains active).

#### Scenario: Sub-resource request to blocked host is aborted
- **WHEN** inline HTML contains `<img src="http://192.168.1.1/logo.png">` and is rendered
- **THEN** the request to `192.168.1.1` is aborted and does not reach the network

#### Scenario: Redirect chain to blocked host is aborted
- **WHEN** `--url` targets a public host that HTTP-redirects to `http://169.254.169.254/`
- **THEN** the redirect request is aborted and rendering completes without reaching the metadata endpoint

#### Scenario: file:// sub-resource request aborted within --file input
- **WHEN** an HTML file references `<iframe src="file:///etc/passwd">`
- **THEN** the iframe request is aborted

#### Scenario: Legitimate HTTPS sub-resources pass through
- **WHEN** inline HTML contains `<img src="https://example.com/logo.png">`
- **THEN** the request is not aborted and proceeds normally

#### Scenario: --allow-local permits localhost sub-resources
- **WHEN** `--allow-local` is active and HTML contains `<img src="http://localhost:3000/img.png">`
- **THEN** the request is not aborted

### Requirement: Service Worker blocking
The Playwright browser context SHALL be configured with `serviceWorkers: 'block'` so that no Service Worker script can be registered during rendering. This prevents malicious SW persistence across renders.

#### Scenario: Service Worker registration fails silently
- **WHEN** rendered HTML calls `navigator.serviceWorker.register('/sw.js')`
- **THEN** the registration is blocked by the browser context configuration and no SW is installed

### Requirement: Browser hardening arguments
The Playwright browser launch configuration SHALL include the following additional args: `--disable-webrtc`, `--disable-extensions`, `--disable-plugins`, `--disable-background-networking`. These reduce the browser attack surface beyond the request guard.

#### Scenario: Browser launches with hardening args
- **WHEN** `render()` is called for any input type
- **THEN** the Chromium process is started with `--disable-webrtc` and `--disable-extensions` in its argument list
