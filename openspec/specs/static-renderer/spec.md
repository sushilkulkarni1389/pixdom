# static-renderer — requirements

### Requirement: Static screenshot capture
The static renderer SHALL accept an optional `ElementHandle` parameter alongside `page` and `RenderOptions`. When the `ElementHandle` is provided, it SHALL capture the screenshot via `element.screenshot({ type: 'png' })` instead of `page.screenshot({ type: 'png', fullPage: false })`. When no `ElementHandle` is provided, existing `page.screenshot()` behaviour is unchanged.

The static renderer SHALL also accept an optional `onProgress?: (event: ProgressEvent) => void` parameter. When provided, it SHALL emit `{ type: 'step-start', step: 'capture' }` before taking the screenshot and `{ type: 'step-done', step: 'capture' }` after.

#### Scenario: Screenshot returns buffer
- **WHEN** the static renderer is invoked on a loaded page without a selector
- **THEN** it returns a non-empty `Buffer` containing valid PNG data

#### Scenario: Element screenshot clips to element bounds
- **WHEN** the static renderer is invoked with an `ElementHandle` for an element sized 200×100
- **THEN** the returned PNG buffer has dimensions 200×100 (not the full viewport dimensions)

#### Scenario: Element screenshot used when handle provided
- **WHEN** a non-null `ElementHandle` is passed to the static renderer
- **THEN** `element.screenshot()` is called instead of `page.screenshot()`

#### Scenario: capture events emitted when onProgress provided
- **WHEN** `renderStatic(page, options, element, onProgress)` is called with a non-null `onProgress`
- **THEN** `onProgress` receives `step-start` then `step-done` for the `'capture'` step

### Requirement: Sharp format encoding
The static renderer SHALL pass the Playwright PNG screenshot buffer through Sharp and encode it to the requested `OutputFormat` (`png | jpeg | webp`) with the `quality` setting from `RenderOptions`.

#### Scenario: PNG output matches viewport dimensions
- **WHEN** `render({ format: 'png', viewport: { width: 800, height: 600 }, ... })` is called
- **THEN** the output PNG has dimensions exactly 800×600 pixels (within 1px tolerance)

#### Scenario: JPEG respects quality
- **WHEN** `render({ format: 'jpeg', quality: 60, ... })` is called
- **THEN** the output buffer is a valid JPEG and its size is smaller than a quality-100 encode of the same content

#### Scenario: WebP output is valid
- **WHEN** `render({ format: 'webp', quality: 90, ... })` is called
- **THEN** the output buffer begins with the WebP file signature (`RIFF....WEBP`)

### Requirement: GIF format unsupported in static renderer
The static renderer SHALL NOT handle `gif` format. If `format` is `'gif'` and the page has no animation, `render()` SHALL return `{ code: 'NO_ANIMATION_DETECTED' }` before invoking the static renderer.

#### Scenario: GIF with static page returns error
- **WHEN** `render({ format: 'gif', ... })` is called on a page with no animation
- **THEN** `render()` returns `Result.err({ code: 'NO_ANIMATION_DETECTED', ... })`
