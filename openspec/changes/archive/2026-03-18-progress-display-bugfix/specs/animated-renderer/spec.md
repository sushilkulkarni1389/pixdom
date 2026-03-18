## MODIFIED Requirements

### Requirement: rAF frame capture loop
The `captureFrames()` function SHALL emit `{ type: 'step-start', step: 'capture-frames' }` before the frame loop begins and `{ type: 'step-done', step: 'capture-frames' }` after the loop completes (outside and after the throttled `frame-progress` events). This allows consumers to eagerly start a spinner at loop start rather than waiting for the first `frame-progress` event.

#### Scenario: capture-frames step-start emitted before first frame
- **WHEN** `captureFrames` is invoked with a non-null `onProgress`
- **THEN** `onProgress` receives `{ type: 'step-start', step: 'capture-frames' }` before any `frame-progress` event

#### Scenario: capture-frames step-done emitted after last frame
- **WHEN** `captureFrames` completes all frames and returns
- **THEN** `onProgress` receives `{ type: 'step-done', step: 'capture-frames' }` as the final event from `captureFrames`
