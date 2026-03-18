## MODIFIED Requirements

### Requirement: rAF frame capture loop
`encode-progress` events SHALL have their `pct` value clamped to a maximum of 100 before emission — `Math.min(100, Math.round(percent))`. This prevents consumers from displaying values above 100% when FFmpeg reports progress exceeding 100 during GIF two-pass palette generation.

After encoding completes, `renderAnimated()` SHALL emit `{ type: 'encode-done', format: string }` (uppercase format, e.g. `"GIF"`) before any subsequent step events. Following `encode-done`, it SHALL emit `{ type: 'step-start', step: 'write-output' }` and `{ type: 'step-done', step: 'write-output' }` to signal the final buffer handoff step.

#### Scenario: encode-progress pct never exceeds 100
- **WHEN** FFmpeg emits a progress event with a percent value above 100 (common in GIF two-pass encoding)
- **THEN** the `encode-progress` event received by `onProgress` has `pct` clamped to `100`

#### Scenario: encode-done emitted after encoding
- **WHEN** `renderAnimated` completes FFmpeg encoding for any format
- **THEN** `onProgress` receives `{ type: 'encode-done', format: 'GIF' | 'MP4' | 'WEBM' }` before the `write-output` step events

#### Scenario: write-output step emitted after encode-done
- **WHEN** `renderAnimated` completes encoding
- **THEN** `onProgress` receives `step-start` then `step-done` for `'write-output'` after `encode-done`
