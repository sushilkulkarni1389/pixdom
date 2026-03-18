## MODIFIED Requirements

### Requirement: Static screenshot capture
After capturing the screenshot, `renderStatic()` SHALL emit `{ type: 'step-start', step: 'write-output' }` before the Sharp `toBuffer()` call and `{ type: 'step-done', step: 'write-output' }` after it resolves. This applies to all output formats (png, jpeg, webp).

#### Scenario: write-output events emitted around Sharp encode
- **WHEN** `renderStatic(page, options, element, onProgress)` is called
- **THEN** `onProgress` receives `step-start` then `step-done` for `'write-output'` bracketing the Sharp format conversion
