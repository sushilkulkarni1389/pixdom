## ADDED Requirements

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
