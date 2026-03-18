## MODIFIED Requirements

### Requirement: onProgress callback in render()
`ProgressEvent` SHALL include a new `encode-done` variant: `{ type: 'encode-done'; format: string }`. This event SHALL be emitted by the animated renderer after FFmpeg encoding completes, signalling that the encode spinner should be succeeded before any subsequent steps (e.g. `write-output`).

#### Scenario: encode-done variant in ProgressEvent type
- **WHEN** TypeScript code does `import type { ProgressEvent } from '@pixdom/core'`
- **THEN** the `encode-done` variant is accessible with `type: 'encode-done'` and `format: string`
