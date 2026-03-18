# selector-capture — requirements

### Requirement: --selector flag accepted by CLI
The `convert` subcommand SHALL accept `--selector <css>` as an optional string flag. The value SHALL be any valid CSS selector string (e.g. `"#canvas"`, `".card"`, `"[data-export]"`). When omitted, existing full-viewport capture behaviour is unchanged.

#### Scenario: Selector flag accepted without error
- **WHEN** `pixdom convert --html "<div id='x'>" --selector "#x"` is run
- **THEN** the process does not exit with a flag-parsing error

#### Scenario: Selector flag absent uses full viewport
- **WHEN** `pixdom convert --html "<div>" --format png` is run without `--selector`
- **THEN** the output dimensions match the configured viewport (no element clipping)

### Requirement: Element resolved after page load
When `RenderOptions.selector` is set, `render()` SHALL call `page.$(selector)` after the page finishes loading to obtain an `ElementHandle`. This lookup SHALL occur before any screenshot or frame-capture logic runs.

#### Scenario: Valid selector resolves to element
- **WHEN** `render({ selector: '#target', input: { type: 'html', html: '<div id="target" style="width:200px;height:100px"></div>' }, ... })` is called
- **THEN** `page.$('#target')` returns a non-null `ElementHandle` and capture proceeds

#### Scenario: Missing selector returns SELECTOR_NOT_FOUND
- **WHEN** `render({ selector: '#missing', input: { type: 'html', html: '<div></div>' }, ... })` is called
- **THEN** `render()` returns `{ ok: false, error: { code: 'SELECTOR_NOT_FOUND', message: "Selector '#missing' matched no elements in the page" } }`

#### Scenario: Zero-size element treated as not found
- **WHEN** `render({ selector: '#hidden', input: { type: 'html', html: '<div id="hidden" style="display:none"></div>' }, ... })` is called
- **THEN** `render()` returns `{ ok: false, error: { code: 'SELECTOR_NOT_FOUND', ... } }` (null bounding box treated as no match)

### Requirement: Multiple matches use first element with warning
When the selector matches more than one element, `render()` SHALL use the first match (index 0) and SHALL write a warning to stderr. The process SHALL NOT exit with an error.

#### Scenario: Multiple matches proceed with first element
- **WHEN** `render({ selector: '.item', input: { type: 'html', html: '<div class="item"></div><div class="item"></div>' }, ... })` is called
- **THEN** the output is captured from the first `.item` element and `render()` returns `{ ok: true, ... }`

#### Scenario: Multiple matches emit warning
- **WHEN** the selector matches more than one element
- **THEN** a warning message is written to stderr before capture proceeds

### Requirement: element.screenshot() used for element capture
When a selector is active and an `ElementHandle` is resolved, capture SHALL use `element.screenshot()` rather than `page.screenshot()`. This applies to both static (single-shot) and animated (per-frame) capture paths.

#### Scenario: Static capture uses element screenshot
- **WHEN** `render({ selector: '#box', format: 'png', input: { type: 'html', html: '<div id="box" style="width:50px;height:50px;background:red"></div>' }, ... })` is called
- **THEN** the output PNG has dimensions 50×50 (element bounds, not viewport bounds)

#### Scenario: Animated capture uses element screenshot per frame
- **WHEN** `render({ selector: '#anim', format: 'gif', ... })` is called on a page with an animated element matching `#anim`
- **THEN** each captured frame is clipped to the `#anim` element bounds

### Requirement: --selector incompatible with --image input
`--selector` SHALL be ignored when the input type is `image` (Sharp passthrough). The CLI SHALL print a warning to stderr and proceed without selector behaviour. `render()` with `input.type === 'image'` SHALL ignore the `selector` field entirely.

#### Scenario: Selector with image input warns and ignores
- **WHEN** `pixdom convert --image photo.jpg --selector "#x"` is run
- **THEN** stderr contains a warning that `--selector` is ignored for image inputs and the process proceeds normally

### Requirement: --width and --height warned when selector active
When `--selector` is provided alongside `--width` or `--height`, the CLI SHALL emit a warning to stderr stating that the dimension flags are ignored. The `--width`/`--height` values SHALL NOT be applied to the viewport before capture; element bounding box dimensions take precedence.

#### Scenario: --width ignored with warning when selector active
- **WHEN** `pixdom convert --html "..." --selector "#x" --width 1280` is run
- **THEN** stderr contains a warning that `--width` is ignored because `--selector` takes precedence, and the output dimensions match the element bounds

### Requirement: --auto-size skipped when selector active
When `--selector` is set, `render()` SHALL skip `autoSize` viewport detection entirely. The element bounding box replaces auto-size as the source of output dimensions.

#### Scenario: --auto-size has no effect when selector active
- **WHEN** `render({ selector: '#box', autoSize: true, ... })` is called
- **THEN** `document.documentElement.scrollHeight` is never queried and the output dimensions match the element bounds
