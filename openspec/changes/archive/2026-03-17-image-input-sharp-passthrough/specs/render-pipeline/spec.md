## ADDED Requirements

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
