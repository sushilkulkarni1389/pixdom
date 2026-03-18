# image-passthrough-renderer — requirements

### Requirement: Image passthrough render
The image passthrough renderer SHALL accept `{ type: 'image', path: string }` input and pass it through Sharp for format conversion. When the input file does not exist at the given path, it SHALL return `{ ok: false, error: { code: 'IMAGE_NOT_FOUND', message: string } }`. When Sharp processing fails for any other reason, it SHALL return `{ ok: false, error: { code: 'SHARP_ERROR', message: string } }` rather than `{ code: 'CAPTURE_FAILED' }`.

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
- **THEN** `render()` returns `{ ok: false, error: { code: 'SHARP_ERROR', message: string } }` (not `CAPTURE_FAILED`)

#### Scenario: read-image events emitted when onProgress provided
- **WHEN** `renderImage` is called with a non-null `onProgress`
- **THEN** `onProgress` receives `step-start` then `step-done` for the `'read-image'` step

#### Scenario: resize events emitted only when resize is active
- **WHEN** `renderImage` is called with custom viewport dimensions and a non-null `onProgress`
- **THEN** `onProgress` receives `step-start` and `step-done` for the `'resize'` step

### Requirement: Viewport-based resize
When `options.viewport.width` or `options.viewport.height` differ from their defaults (1280 and 720 respectively), the image renderer SHALL resize the source image to fit within the specified dimensions using Sharp's `resize` with `fit: 'inside'`, preserving aspect ratio without cropping.

#### Scenario: Image resized to fit viewport
- **WHEN** `render({ input: { type: 'image', path: '/path/to/large.png' }, viewport: { width: 400, height: 300 }, format: 'png' })` is called with a 1600×1200 source image
- **THEN** the output image fits within 400×300 (both dimensions ≤ specified values) with aspect ratio preserved

#### Scenario: Image not upscaled beyond natural size
- **WHEN** `render({ input: { type: 'image', path: '/path/to/small.png' }, viewport: { width: 1920, height: 1080 }, format: 'png' })` is called with a 100×100 source image and `withoutEnlargement: false` is NOT set
- **THEN** behavior is implementation-defined (enlargement or passthrough both acceptable)

### Requirement: Animated formats rejected for image inputs
The image renderer SHALL return `Result.err({ code: 'CAPTURE_FAILED' })` when `options.format` is `gif`, `mp4`, or `webm`. Image inputs cannot produce animated output.

#### Scenario: GIF format returns error
- **WHEN** `render({ input: { type: 'image', path: '/path/to/photo.jpg' }, format: 'gif', ... })` is called
- **THEN** `render()` returns `{ ok: false, error: { code: 'CAPTURE_FAILED', ... } }` without reading the file

#### Scenario: MP4 format returns error
- **WHEN** `render({ input: { type: 'image', path: '/path/to/photo.jpg' }, format: 'mp4', ... })` is called
- **THEN** `render()` returns `{ ok: false, error: { code: 'CAPTURE_FAILED', ... } }`
