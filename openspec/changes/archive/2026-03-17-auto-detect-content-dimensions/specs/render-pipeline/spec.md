## ADDED Requirements

### Requirement: autoSize field in RenderOptions
`RenderOptionsSchema` SHALL include an optional `autoSize` field of type `boolean`. When omitted it SHALL default to `false`.

#### Scenario: autoSize accepted in RenderOptions
- **WHEN** `{ autoSize: true, ... }` is passed to `RenderOptionsSchema.parse()`
- **THEN** the schema parses successfully and `autoSize` is `true`

#### Scenario: autoSize omitted defaults to false
- **WHEN** `RenderOptionsSchema.parse({ input, format, viewport })` is called without `autoSize`
- **THEN** the parsed value has `autoSize` equal to `false` or `undefined` (no validation error)

## MODIFIED Requirements

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
