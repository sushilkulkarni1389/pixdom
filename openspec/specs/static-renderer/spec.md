# static-renderer — requirements

### Requirement: Static screenshot capture
The static renderer SHALL capture the full-page screenshot via `page.screenshot({ type: 'png', fullPage: false })` and return the raw PNG buffer for downstream Sharp processing.

#### Scenario: Screenshot returns buffer
- **WHEN** the static renderer is invoked on a loaded page
- **THEN** it returns a non-empty `Buffer` containing valid PNG data

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
