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

### Requirement: selector field in RenderOptions
`RenderOptionsSchema` SHALL include an optional `selector` field of type `string`. When omitted or `undefined`, existing full-viewport capture behaviour is unchanged. The field SHALL be passed through to the static and animated renderers.

#### Scenario: selector accepted in RenderOptions
- **WHEN** `RenderOptionsSchema.parse({ ..., selector: '#canvas' })` is called
- **THEN** the schema parses successfully with `selector === '#canvas'`

#### Scenario: selector omitted does not break existing calls
- **WHEN** `RenderOptionsSchema.parse({ input, format, viewport })` is called without `selector`
- **THEN** the parsed value has `selector` equal to `undefined` and no validation error is thrown

### Requirement: SELECTOR_NOT_FOUND error code
`render()` SHALL return `{ ok: false, error: { code: 'SELECTOR_NOT_FOUND', message: string } }` when `options.selector` is set and either (a) `page.$(selector)` returns `null` or (b) the resolved element's `boundingBox()` returns `null`. The message SHALL include the selector string for debuggability.

#### Scenario: SELECTOR_NOT_FOUND returned for missing element
- **WHEN** `render({ selector: '#nope', input: { type: 'html', html: '<div></div>' }, ... })` is called
- **THEN** `render()` returns `{ ok: false, error: { code: 'SELECTOR_NOT_FOUND', message: "Selector '#nope' matched no elements in the page" } }`

### Requirement: Element resolved before render dispatch
When `options.selector` is set and `input.type !== 'image'`, `render()` SHALL call `page.$(selector)` after page load and before dispatching to the static or animated renderer. The resolved `ElementHandle` (or first match when multiple exist) SHALL be passed to the renderer. If no element is found, `render()` SHALL return `SELECTOR_NOT_FOUND` without entering the renderer.

#### Scenario: Element handle passed to static renderer
- **WHEN** `render({ selector: '#el', format: 'png', ... })` is called on a page where `#el` exists
- **THEN** the static renderer receives a non-null `ElementHandle` and uses `element.screenshot()`

#### Scenario: Element handle passed to animated renderer
- **WHEN** `render({ selector: '#el', format: 'gif', ... })` is called on a page where `#el` exists with animation
- **THEN** the animated renderer receives a non-null `ElementHandle` and uses `element.screenshot()` per frame

#### Scenario: autoSize skipped when selector active
- **WHEN** `render({ selector: '#el', autoSize: true, ... })` is called
- **THEN** `document.documentElement.scrollHeight` is never queried and the viewport is not resized by autoSize logic

#### Scenario: image input ignores selector
- **WHEN** `render({ selector: '#el', input: { type: 'image', path: '...' }, ... })` is called
- **THEN** the image passthrough renderer is invoked without attempting DOM element resolution

### Requirement: RenderError codes
`render()` SHALL return typed errors using the following `code` values: `'BROWSER_LAUNCH_FAILED'`, `'PAGE_LOAD_FAILED'`, `'CAPTURE_FAILED'`, `'ENCODE_FAILED'`, `'NO_ANIMATION_DETECTED'`, `'SELECTOR_NOT_FOUND'`. No unhandled exceptions SHALL propagate to the caller.

#### Scenario: Page load failure returns PAGE_LOAD_FAILED
- **WHEN** `page.goto` throws (e.g., invalid URL, network error)
- **THEN** `render()` returns `{ ok: false, error: { code: 'PAGE_LOAD_FAILED', ... } }`

#### Scenario: All errors are caught
- **WHEN** any internal operation throws an unexpected error
- **THEN** `render()` returns a `Result.err` rather than throwing

### Requirement: New RenderErrorCode values
`RenderErrorCode` in `packages/core/src/errors.ts` SHALL include the following additional codes: `'INVALID_FILE_TYPE'`, `'FILE_NOT_FOUND'`, `'IMAGE_NOT_FOUND'`, `'SHARP_ERROR'`. These SHALL be added to the union alongside existing codes without removing any existing values.

#### Scenario: New codes accepted by makeError
- **WHEN** `makeError('FILE_NOT_FOUND', 'File not found', undefined)` is called
- **THEN** TypeScript compiles without error and the returned object has `code === 'FILE_NOT_FOUND'`

#### Scenario: New codes accepted by makeError — IMAGE_NOT_FOUND
- **WHEN** `makeError('IMAGE_NOT_FOUND', 'Image not found', undefined)` is called
- **THEN** TypeScript compiles without error

### Requirement: hints field on RenderError
`RenderError` interface SHALL include an optional `hints?: string[]` field. When `makeError()` is called without a `hints` argument, the field is omitted. When provided, it is included in the returned error object.

#### Scenario: hints omitted by default
- **WHEN** `makeError('NO_ANIMATION_DETECTED', 'No animation', undefined)` is called
- **THEN** the returned object does not have a `hints` property

#### Scenario: hints included when provided
- **WHEN** `makeError('NO_ANIMATION_DETECTED', 'No animation', undefined, ['try --duration 2000'])` is called
- **THEN** the returned object has `hints === ['try --duration 2000']`

### Requirement: FILE_NOT_FOUND emitted for missing file inputs
`render()` SHALL check whether the input file path exists before launching the browser. If `options.input.type === 'file'` and the resolved path does not exist on the filesystem, `render()` SHALL return `{ ok: false, error: { code: 'FILE_NOT_FOUND', message: string } }` without launching a browser.

#### Scenario: FILE_NOT_FOUND returned for missing file path
- **WHEN** `render({ input: { type: 'file', path: '/nonexistent/page.html' }, ... })` is called
- **THEN** `render()` returns `{ ok: false, error: { code: 'FILE_NOT_FOUND', ... } }` and no browser is launched

### Requirement: onProgress callback in render()
`render()` SHALL accept an optional `onProgress?: (event: ProgressEvent) => void` parameter as part of a second options argument or directly alongside `RenderOptions`. When omitted or `undefined`, all progress event calls SHALL be no-ops. The callback SHALL be forwarded to the static renderer, animated renderer, and image renderer.

`ProgressEvent` SHALL be a discriminated union exported from `packages/core`:
```ts
export type ProgressEvent =
  | { type: 'step-start'; step: string }
  | { type: 'step-done'; step: string }
  | { type: 'frame-progress'; current: number; total: number }
  | { type: 'encode-progress'; pct: number }
  | { type: 'encode-format'; format: string };
```

#### Scenario: onProgress omitted — render succeeds without callback
- **WHEN** `render(options)` is called without an `onProgress` argument
- **THEN** `render()` completes successfully and no error is thrown

#### Scenario: onProgress receives step-start and step-done for page load
- **WHEN** `render(options, { onProgress: handler })` is called with an HTML input
- **THEN** `handler` is called with `{ type: 'step-start', step: 'load-page' }` before page load and `{ type: 'step-done', step: 'load-page' }` after

#### Scenario: onProgress receives step events for selector resolution
- **WHEN** `render({ ...options, selector: '#x' }, { onProgress: handler })` is called
- **THEN** `handler` is called with step events for selector resolution after page load

#### Scenario: ProgressEvent type exported from core
- **WHEN** TypeScript code does `import type { ProgressEvent } from '@pixdom/core'`
- **THEN** compilation succeeds and all event variants are accessible
