## ADDED Requirements

### Requirement: New RenderErrorCode values
`RenderErrorCode` in `packages/core/src/errors.ts` SHALL include the following additional codes: `'INVALID_FILE_TYPE'`, `'FILE_NOT_FOUND'`, `'IMAGE_NOT_FOUND'`, `'SHARP_ERROR'`. These SHALL be added to the union alongside existing codes without removing any existing values.

#### Scenario: New codes accepted by makeError
- **WHEN** `makeError('FILE_NOT_FOUND', 'File not found', undefined)` is called
- **THEN** TypeScript compiles without error and the returned object has `code === 'FILE_NOT_FOUND'`

#### Scenario: New codes accepted by makeError — IMAGE_NOT_FOUND
- **WHEN** `makeError('IMAGE_NOT_FOUND', 'Image not found', undefined)` is called
- **THEN** TypeScript compiles without error

### Requirement: hints field on RenderError
`RenderError` interface SHALL include an optional `hints?: string[]` field. When `makeError()` is called without a `hints` argument, the field is omitted. When provided, it is included in the returned error object.

#### Scenario: hints omitted by default
- **WHEN** `makeError('NO_ANIMATION_DETECTED', 'No animation', undefined)` is called
- **THEN** the returned object does not have a `hints` property

#### Scenario: hints included when provided
- **WHEN** `makeError('NO_ANIMATION_DETECTED', 'No animation', undefined, ['try --duration 2000'])` is called
- **THEN** the returned object has `hints === ['try --duration 2000']`

### Requirement: FILE_NOT_FOUND emitted for missing file inputs
`render()` SHALL check whether the input file path exists before launching the browser. If `options.input.type === 'file'` and the resolved path does not exist on the filesystem, `render()` SHALL return `{ ok: false, error: { code: 'FILE_NOT_FOUND', message: string } }` without launching a browser.

#### Scenario: FILE_NOT_FOUND returned for missing file path
- **WHEN** `render({ input: { type: 'file', path: '/nonexistent/page.html' }, ... })` is called
- **THEN** `render()` returns `{ ok: false, error: { code: 'FILE_NOT_FOUND', ... } }` and no browser is launched
