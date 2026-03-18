## MODIFIED Requirements

### Requirement: Package scaffold
`packages/core` SHALL be a valid pnpm workspace package named `@pixdom/core` with `package.json`, `tsconfig.json`, and `src/index.ts`. It SHALL declare `playwright` (pinned to `>=1.55.1`), `sharp`, and `ffmpeg-static` (v5.3.0) as runtime dependencies and `@pixdom/types` and `@pixdom/detector` as workspace dependencies. It SHALL NOT declare `fluent-ffmpeg` as a dependency. It SHALL have zero imports from `apps/`.

#### Scenario: Package resolves in workspace
- **WHEN** another package declares `"@pixdom/core": "workspace:*"` in its dependencies
- **THEN** TypeScript resolves all named exports from `packages/core/src/index.ts`

#### Scenario: fluent-ffmpeg is not a dependency
- **WHEN** `packages/core/package.json` is inspected
- **THEN** `fluent-ffmpeg` does not appear in `dependencies` or `devDependencies`

#### Scenario: playwright version is pinned to >=1.55.1
- **WHEN** `packages/core/package.json` is inspected
- **THEN** the playwright version specifier is `>=1.55.1` or a specific version ≥1.55.1

### Requirement: Browser lifecycle
`render()` SHALL launch a new Chromium browser instance at the start of each call and close it in a `finally` block before the function returns, regardless of success or failure. The browser SHALL be launched without `--no-sandbox` unless the `PIXDOM_NO_SANDBOX` environment variable is set to `"1"` or `"true"`, in which case a warning SHALL be printed to stderr and `--no-sandbox --disable-setuid-sandbox` SHALL be included in the launch args. The default launch args SHALL include `--disable-extensions`, `--disable-plugins`, `--disable-background-networking`, and `--disable-webrtc`.

#### Scenario: Browser closed on success
- **WHEN** `render()` resolves successfully
- **THEN** no Playwright browser process remains open

#### Scenario: Browser closed on error
- **WHEN** an exception is thrown during page load or capture
- **THEN** the browser is still closed and `render()` returns `Result.err` with an appropriate code

#### Scenario: Default launch has no --no-sandbox
- **WHEN** `PIXDOM_NO_SANDBOX` is not set and `render()` is called
- **THEN** the Chromium process is launched without `--no-sandbox` in its arguments

#### Scenario: PIXDOM_NO_SANDBOX=1 enables --no-sandbox with warning
- **WHEN** `PIXDOM_NO_SANDBOX=1 pixdom convert --html "x"` is run
- **THEN** Chromium launches with `--no-sandbox` and a warning is printed to stderr

#### Scenario: Hardening args present in default launch
- **WHEN** `render()` is called with default settings
- **THEN** the Chromium process includes `--disable-extensions` and `--disable-webrtc` in its arguments

### Requirement: Input routing
`render()` SHALL route the `input` field of `RenderOptions` to the correct Playwright loading method based on its `type` discriminant: `'html'` → `page.setContent(html)`, `'file'` → `page.goto('file://' + path)`, `'url'` → `page.goto(url)`. For all input types, a request guard SHALL be installed via `installRequestGuard(page, options)` after the page is created and before content is loaded. The browser context SHALL be created with `serviceWorkers: 'block'`.

#### Scenario: HTML string loads via setContent
- **WHEN** `render({ input: { type: 'html', html: '<h1>Hi</h1>' }, ... })` is called
- **THEN** Playwright uses `page.setContent` (not `page.goto`) to load the content

#### Scenario: File path loads via goto
- **WHEN** `render({ input: { type: 'file', path: '/tmp/test.html' }, ... })` is called
- **THEN** Playwright uses `page.goto('file:///tmp/test.html')` to load the content

#### Scenario: URL loads via goto
- **WHEN** `render({ input: { type: 'url', url: 'https://example.com' }, ... })` is called
- **THEN** Playwright uses `page.goto('https://example.com')` to load the content

#### Scenario: Request guard installed for all input types
- **WHEN** `render()` is called with any input type
- **THEN** a `page.route('**')` handler is active before any content begins loading

#### Scenario: Service workers blocked in browser context
- **WHEN** `render()` is called
- **THEN** the browser context is created with `serviceWorkers: 'block'`
