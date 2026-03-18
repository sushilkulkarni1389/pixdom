## MODIFIED Requirements

### Requirement: Static screenshot capture
The static renderer SHALL accept an optional `ElementHandle` parameter alongside `page` and `RenderOptions`. When the `ElementHandle` is provided, it SHALL capture the screenshot via `element.screenshot({ type: 'png' })` instead of `page.screenshot({ type: 'png', fullPage: false })`. When no `ElementHandle` is provided, existing `page.screenshot()` behaviour is unchanged.

#### Scenario: Screenshot returns buffer
- **WHEN** the static renderer is invoked on a loaded page without a selector
- **THEN** it returns a non-empty `Buffer` containing valid PNG data

#### Scenario: Element screenshot clips to element bounds
- **WHEN** the static renderer is invoked with an `ElementHandle` for an element sized 200×100
- **THEN** the returned PNG buffer has dimensions 200×100 (not the full viewport dimensions)

#### Scenario: Element screenshot used when handle provided
- **WHEN** a non-null `ElementHandle` is passed to the static renderer
- **THEN** `element.screenshot()` is called instead of `page.screenshot()`
