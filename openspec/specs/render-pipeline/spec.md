# render-pipeline — requirements

### Requirement: Package scaffold
`packages/core` SHALL be a valid pnpm workspace package named `@pixdom/core` with `package.json`, `tsconfig.json`, and `src/index.ts`. It SHALL declare `playwright`, `sharp`, and `fluent-ffmpeg` as runtime dependencies and `@pixdom/types` and `@pixdom/detector` as workspace dependencies. It SHALL have zero imports from `apps/`.

#### Scenario: Package resolves in workspace
- **WHEN** another package declares `"@pixdom/core": "workspace:*"` in its dependencies
- **THEN** TypeScript resolves all named exports from `packages/core/src/index.ts`

### Requirement: image input type in RenderInput
`RenderInputSchema` SHALL include `{ type: 'image', path: string }` as a valid discriminated union member. `path` SHALL be the absolute or relative filesystem path to a supported raster image file.

#### Scenario: image input parses successfully
- **WHEN** `RenderInputSchema.parse({ type: 'image', path: '/tmp/photo.jpg' })` is called
- **THEN** the schema parses successfully with `type === 'image'` and `path === '/tmp/photo.jpg'`

#### Scenario: image input fails without path
- **WHEN** `RenderInputSchema.parse({ type: 'image' })` is called without `path`
- **THEN** Zod throws a validation error

### Requirement: image input bypasses browser launch
When `options.input.type === 'image'`, `render()` SHALL dispatch to the image passthrough renderer before calling `chromium.launch()`. No browser process SHALL be spawned for image inputs.

#### Scenario: render with image input never launches browser
- **WHEN** `render({ input: { type: 'image', path: '...' }, format: 'png', ... })` is called
- **THEN** no Chromium process is started and the result is returned directly from the Sharp renderer

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

### Requirement: autoSize field in RenderOptions
`RenderOptionsSchema` SHALL include an optional `autoSize` field of type `boolean`. When omitted it SHALL default to `false`.

#### Scenario: autoSize accepted in RenderOptions
- **WHEN** `{ autoSize: true, ... }` is passed to `RenderOptionsSchema.parse()`
- **THEN** the schema parses successfully and `autoSize` is `true`

#### Scenario: autoSize omitted defaults to false
- **WHEN** `RenderOptionsSchema.parse({ input, format, viewport })` is called without `autoSize`
- **THEN** the parsed value has `autoSize` equal to `false` or `undefined` (no validation error)

### Requirement: Viewport configuration
`render()` SHALL apply `options.viewport.width`, `options.viewport.height`, and `options.viewport.deviceScaleFactor` to the Playwright page before content load. `width` and `height` SHALL be optional in `ViewportOptionsSchema` with defaults of `1280` and `720` respectively. When `options.autoSize` is `true`, after page load `render()` SHALL query `document.documentElement.scrollWidth` and `document.documentElement.scrollHeight` and call `page.setViewportSize()` again with the detected dimensions before capture.

#### Scenario: Viewport applied to page
- **WHEN** `render({ viewport: { width: 1080, height: 1080, deviceScaleFactor: 2 }, ... })` is called
- **THEN** the captured output has pixel dimensions 2160×2160 (width × deviceScaleFactor)

#### Scenario: Viewport defaults applied when omitted
- **WHEN** `render({ viewport: {}, ... })` is called with no width/height
- **THEN** the initial viewport is 1280×720

#### Scenario: autoSize resizes viewport after load
- **WHEN** `render({ autoSize: true, viewport: { width: 800 }, ... })` is called with content that is 2400px tall
- **THEN** `page.setViewportSize()` is called a second time with `{ width: 800, height: 2400 }` before capture

### Requirement: Animation dispatch
`render()` SHALL call `detectAnimationCycle(page)` from `@pixdom/detector` after the page loads **unless `options.duration` is set**, in which case `options.duration` SHALL be used directly as `cycleMs` and `detectAnimationCycle()` SHALL NOT be called. If the resolved `cycleMs` is non-null and the requested `format` is an animated format (`gif | mp4 | webm`), it SHALL delegate to the animated renderer. Otherwise it SHALL delegate to the static renderer.

#### Scenario: Static format uses static renderer
- **WHEN** `format` is `'png'` regardless of animation detection result
- **THEN** the static renderer is used and the result is a PNG buffer

#### Scenario: Animated format with animation uses animated renderer
- **WHEN** `format` is `'mp4'` and `detectAnimationCycle` returns a non-null cycle length
- **THEN** the animated renderer is used

#### Scenario: Animated format with no animation returns error
- **WHEN** `format` is `'gif'` and `detectAnimationCycle` returns `null`
- **THEN** `render()` returns `Result.err({ code: 'NO_ANIMATION_DETECTED', message: '...' })`

#### Scenario: options.duration overrides detection
- **WHEN** `render({ format: 'gif', duration: 2000, ... })` is called
- **THEN** `detectAnimationCycle` is not called and the animated renderer receives `cycleMs = 2000`

#### Scenario: options.duration with static format is ignored
- **WHEN** `render({ format: 'png', duration: 2000, ... })` is called
- **THEN** the static renderer is used and the `duration` field has no effect

### Requirement: RenderError codes
`render()` SHALL return typed errors using the following `code` values: `'BROWSER_LAUNCH_FAILED'`, `'PAGE_LOAD_FAILED'`, `'CAPTURE_FAILED'`, `'ENCODE_FAILED'`, `'NO_ANIMATION_DETECTED'`. No unhandled exceptions SHALL propagate to the caller.

#### Scenario: Page load failure returns PAGE_LOAD_FAILED
- **WHEN** `page.goto` throws (e.g., invalid URL, network error)
- **THEN** `render()` returns `{ ok: false, error: { code: 'PAGE_LOAD_FAILED', ... } }`

#### Scenario: All errors are caught
- **WHEN** any internal operation throws an unexpected error
- **THEN** `render()` returns a `Result.err` rather than throwing
