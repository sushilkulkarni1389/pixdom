# image-passthrough-renderer — requirements

### Requirement: Sharp-based image conversion
`packages/core` SHALL export a `renderImage(options: RenderOptions)` function (or equivalent internal helper) that reads the source image file at `options.input.path` using Sharp and encodes it to the requested `OutputFormat` with the `quality` setting from `RenderOptions`. No Playwright browser SHALL be launched.

#### Scenario: PNG output from JPEG source
- **WHEN** `render({ input: { type: 'image', path: '/path/to/photo.jpg' }, format: 'png', ... })` is called
- **THEN** the output buffer is a valid PNG (begins with `\x89PNG`) and no browser process is spawned

#### Scenario: JPEG output respects quality
- **WHEN** `render({ input: { type: 'image', path: '/path/to/photo.png' }, format: 'jpeg', quality: 60, ... })` is called
- **THEN** the output is a valid JPEG encoded at quality 60

#### Scenario: WebP output is valid
- **WHEN** `render({ input: { type: 'image', path: '/path/to/photo.png' }, format: 'webp', quality: 85, ... })` is called
- **THEN** the output buffer begins with the WebP file signature (`RIFF....WEBP`)

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
