# render-pipeline — requirements

### Requirement: Package scaffold
`packages/core` SHALL be a valid pnpm workspace package named `@pixdom/core` with `package.json`, `tsconfig.json`, and `src/index.ts`. It SHALL declare `playwright`, `sharp`, and `fluent-ffmpeg` as runtime dependencies and `@pixdom/types` and `@pixdom/detector` as workspace dependencies. It SHALL have zero imports from `apps/`.

#### Scenario: Package resolves in workspace
- **WHEN** another package declares `"@pixdom/core": "workspace:*"` in its dependencies
- **THEN** TypeScript resolves all named exports from `packages/core/src/index.ts`

### Requirement: render function signature
`packages/core` SHALL export a function `render(options: RenderOptions): Promise<Result<Buffer, RenderError>>` where `RenderOptions` and `Result` are imported from `@pixdom/types` and `RenderError` is `{ code: string; message: string; cause?: unknown }`.

#### Scenario: Return type is Result
- **WHEN** TypeScript compiles `const r = await render(opts)`
- **THEN** `r.ok` narrows to `true | false` and `r.value` / `r.error` are accessible accordingly

### Requirement: Browser lifecycle
`render()` SHALL launch a new Chromium browser instance at the start of each call and close it in a `finally` block before the function returns, regardless of success or failure.

#### Scenario: Browser closed on success
- **WHEN** `render()` resolves successfully
- **THEN** no Playwright browser process remains open

#### Scenario: Browser closed on error
- **WHEN** an exception is thrown during page load or capture
- **THEN** the browser is still closed and `render()` returns `Result.err` with an appropriate code

### Requirement: Input routing
`render()` SHALL route the `input` field of `RenderOptions` to the correct Playwright loading method based on its `type` discriminant: `'html'` → `page.setContent(html)`, `'file'` → `page.goto('file://' + path)`, `'url'` → `page.goto(url)`.

#### Scenario: HTML string loads via setContent
- **WHEN** `render({ input: { type: 'html', html: '<h1>Hi</h1>' }, ... })` is called
- **THEN** Playwright uses `page.setContent` (not `page.goto`) to load the content

#### Scenario: File path loads via goto
- **WHEN** `render({ input: { type: 'file', path: '/tmp/test.html' }, ... })` is called
- **THEN** Playwright uses `page.goto('file:///tmp/test.html')` to load the content

#### Scenario: URL loads via goto
- **WHEN** `render({ input: { type: 'url', url: 'https://example.com' }, ... })` is called
- **THEN** Playwright uses `page.goto('https://example.com')` to load the content

### Requirement: Viewport configuration
`render()` SHALL apply `options.viewport.width`, `options.viewport.height`, and `options.viewport.deviceScaleFactor` to the Playwright page before capture.

#### Scenario: Viewport applied to page
- **WHEN** `render({ viewport: { width: 1080, height: 1080, deviceScaleFactor: 2 }, ... })` is called
- **THEN** the captured output has pixel dimensions 2160×2160 (width × deviceScaleFactor)

### Requirement: Animation dispatch
`render()` SHALL call `detectAnimationCycle(page)` from `@pixdom/detector` after the page loads. If the result is non-null and the requested `format` is an animated format (`gif | mp4 | webm`), it SHALL delegate to the animated renderer. Otherwise it SHALL delegate to the static renderer.

#### Scenario: Static format uses static renderer
- **WHEN** `format` is `'png'` regardless of animation detection result
- **THEN** the static renderer is used and the result is a PNG buffer

#### Scenario: Animated format with animation uses animated renderer
- **WHEN** `format` is `'mp4'` and `detectAnimationCycle` returns a non-null cycle length
- **THEN** the animated renderer is used

#### Scenario: Animated format with no animation returns error
- **WHEN** `format` is `'gif'` and `detectAnimationCycle` returns `null`
- **THEN** `render()` returns `Result.err({ code: 'NO_ANIMATION_DETECTED', message: '...' })`

### Requirement: RenderError codes
`render()` SHALL return typed errors using the following `code` values: `'BROWSER_LAUNCH_FAILED'`, `'PAGE_LOAD_FAILED'`, `'CAPTURE_FAILED'`, `'ENCODE_FAILED'`, `'NO_ANIMATION_DETECTED'`. No unhandled exceptions SHALL propagate to the caller.

#### Scenario: Page load failure returns PAGE_LOAD_FAILED
- **WHEN** `page.goto` throws (e.g., invalid URL, network error)
- **THEN** `render()` returns `{ ok: false, error: { code: 'PAGE_LOAD_FAILED', ... } }`

#### Scenario: All errors are caught
- **WHEN** any internal operation throws an unexpected error
- **THEN** `render()` returns a `Result.err` rather than throwing
