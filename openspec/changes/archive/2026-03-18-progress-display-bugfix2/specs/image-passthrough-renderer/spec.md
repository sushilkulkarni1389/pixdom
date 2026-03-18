## MODIFIED Requirements

### Requirement: Image passthrough render
After any resize step (or directly after `read-image` if no resize), `renderImage()` SHALL emit `{ type: 'step-start', step: 'write-output' }` before the Sharp `toBuffer()` call and `{ type: 'step-done', step: 'write-output' }` after it resolves. This applies to all output formats (png, jpeg, webp).

#### Scenario: write-output events emitted around Sharp encode
- **WHEN** `renderImage` is called with a non-null `onProgress`
- **THEN** `onProgress` receives `step-start` then `step-done` for `'write-output'` as the final step before the buffer is returned
