## MODIFIED Requirements

### Requirement: Image passthrough render
The image passthrough renderer SHALL accept `{ type: 'image', path: string }` input and pass it through Sharp for format conversion. When the input file does not exist at the given path, it SHALL return `{ ok: false, error: { code: 'IMAGE_NOT_FOUND', message: string } }`. When Sharp processing fails for any other reason, it SHALL return `{ ok: false, error: { code: 'SHARP_ERROR', message: string } }` rather than `{ code: 'CAPTURE_FAILED' }`.

#### Scenario: Valid image converts successfully
- **WHEN** `render({ input: { type: 'image', path: '/valid/photo.jpg' }, format: 'png', ... })` is called
- **THEN** `render()` returns `{ ok: true, value: <Buffer> }` with the converted PNG data

#### Scenario: Missing image returns IMAGE_NOT_FOUND
- **WHEN** `render({ input: { type: 'image', path: '/nonexistent/photo.jpg' }, format: 'png', ... })` is called
- **THEN** `render()` returns `{ ok: false, error: { code: 'IMAGE_NOT_FOUND', message: string } }`

#### Scenario: Sharp processing failure returns SHARP_ERROR
- **WHEN** `render({ input: { type: 'image', path: '/path/to/corrupt.jpg' }, format: 'png', ... })` is called and Sharp throws
- **THEN** `render()` returns `{ ok: false, error: { code: 'SHARP_ERROR', message: string } }` (not `CAPTURE_FAILED`)
