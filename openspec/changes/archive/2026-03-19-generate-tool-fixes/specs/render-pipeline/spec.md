## ADDED Requirements

### Requirement: profileViewport field in RenderOptions
`RenderOptionsSchema` SHALL include an optional `profileViewport?: boolean` field. When `true`, it signals that the viewport dimensions are locked to a platform profile and MUST NOT be overridden by auto element detection. When omitted or `false`, existing auto-detection behaviour is unchanged.

#### Scenario: profileViewport accepted in RenderOptions
- **WHEN** `RenderOptionsSchema.parse({ ..., profileViewport: true })` is called
- **THEN** the schema parses successfully with `profileViewport === true`

#### Scenario: profileViewport omitted does not break existing calls
- **WHEN** `RenderOptionsSchema.parse({ input, format, viewport })` is called without `profileViewport`
- **THEN** the parsed value has `profileViewport` equal to `undefined` or `false` and no validation error is thrown

### Requirement: profileViewport suppresses auto element capture
When `options.auto === true` and `options.profileViewport === true`, `render()` SHALL run `autoDetectElement()` only to obtain a selector for timing detection (`autoDetectDuration`, `autoDetectFps`). The auto-detected selector SHALL NOT be assigned to `autoEffectiveSelector` for the purpose of resolving an `ElementHandle`. The renderer SHALL receive `elementHandle = undefined` and SHALL use full-page `page.screenshot()` at the profile viewport dimensions.

An explicit `options.selector` (user-provided) SHALL still be resolved to an `ElementHandle` regardless of `profileViewport` — explicit selector always drives element-level capture.

#### Scenario: auto + profileViewport uses full-page screenshot
- **WHEN** `render({ auto: true, profileViewport: true, viewport: { width: 1200, height: 1200 }, format: 'gif', ... })` is called on a page where `autoDetectElement` returns `{ selector: 'div.card', width: 800, height: 600 }`
- **THEN** the capture uses `page.screenshot()` (not `element.screenshot()`) and output dimensions are 1200×1200

#### Scenario: auto + profileViewport still detects animation timing
- **WHEN** `render({ auto: true, profileViewport: true, ... })` is called on a page with CSS animations
- **THEN** `autoDetectDuration` is called and the detected duration is used for the animation cycle

#### Scenario: explicit selector overrides profileViewport for capture
- **WHEN** `render({ auto: true, profileViewport: true, selector: '#card', ... })` is called
- **THEN** `elementHandle` is resolved from `#card` and `element.screenshot()` is used for capture

#### Scenario: profileViewport false behaves as before
- **WHEN** `render({ auto: true, profileViewport: false, ... })` is called
- **THEN** auto-detected element drives both timing and capture (existing behaviour unchanged)
