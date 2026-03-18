## MODIFIED Requirements

### Requirement: Image passthrough render
The image passthrough renderer SHALL accept `{ type: 'image', path: string }` input and pass it through Sharp for format conversion. When the input file does not exist at the given path, it SHALL return `{ ok: false, error: { code: 'IMAGE_NOT_FOUND', message: string } }`. When Sharp processing fails for any other reason, it SHALL return `{ ok: false, error: { code: 'SHARP_ERROR', message: string } }`.

The renderer SHALL also accept an optional `onProgress?: (event: ProgressEvent) => void` parameter. When provided:
- It SHALL emit `{ type: 'step-start', step: 'read-image' }` before opening the file
- It SHALL emit `{ type: 'step-done', step: 'read-image' }` after Sharp metadata is available
- It SHALL emit `{ type: 'step-start', step: 'resize' }` before any resize operation (only if resize is active)
- It SHALL emit `{ type: 'step-done', step: 'resize' }` after resize completes

#### Scenario: Valid image converts successfully
- **WHEN** `render({ input: { type: 'image', path: '/valid/photo.jpg' }, format: 'png', ... })` is called
- **THEN** `render()` returns `{ ok: true, value: <Buffer> }` with the converted PNG data

#### Scenario: Missing image returns IMAGE_NOT_FOUND
- **WHEN** `render({ input: { type: 'image', path: '/nonexistent/photo.jpg' }, format: 'png', ... })` is called
- **THEN** `render()` returns `{ ok: false, error: { code: 'IMAGE_NOT_FOUND', message: string } }`

#### Scenario: Sharp processing failure returns SHARP_ERROR
- **WHEN** `render({ input: { type: 'image', path: '/path/to/corrupt.jpg' }, format: 'png', ... })` is called and Sharp throws
- **THEN** `render()` returns `{ ok: false, error: { code: 'SHARP_ERROR', message: string } }`

#### Scenario: read-image events emitted when onProgress provided
- **WHEN** `renderImage` is called with a non-null `onProgress`
- **THEN** `onProgress` receives `step-start` then `step-done` for the `'read-image'` step

#### Scenario: resize events emitted only when resize is active
- **WHEN** `renderImage` is called with custom viewport dimensions and a non-null `onProgress`
- **THEN** `onProgress` receives `step-start` and `step-done` for the `'resize'` step
