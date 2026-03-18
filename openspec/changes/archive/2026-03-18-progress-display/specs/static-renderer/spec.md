## MODIFIED Requirements

### Requirement: Static screenshot capture
The static renderer SHALL accept an optional `onProgress?: (event: ProgressEvent) => void` parameter alongside `page`, `RenderOptions`, and the optional `ElementHandle`. When `onProgress` is provided, it SHALL emit `{ type: 'step-start', step: 'capture' }` before taking the screenshot and `{ type: 'step-done', step: 'capture' }` after. Existing `page.screenshot()` / `element.screenshot()` behaviour is unchanged.

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
