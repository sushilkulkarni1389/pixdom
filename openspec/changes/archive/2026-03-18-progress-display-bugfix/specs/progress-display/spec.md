## MODIFIED Requirements

### Requirement: ora spinner step display
The CLI progress reporter SHALL handle the `capture-frames` step explicitly: on `step-start` with `step: 'capture-frames'` it SHALL immediately start a new spinner with text `"Capturing frames"`. On `frame-progress` events it SHALL update the existing spinner text in place (`"Capturing frames (N/total)"`); it SHALL NOT create a new spinner from a `frame-progress` event. On `step-done` with `step: 'capture-frames'` it SHALL succeed the spinner using the last known frame count (e.g. `"Capturing frames (30/30)"`) or `"Capturing frames"` if no frame-progress was received.

`reporter.finish()` SHALL call `spinner.stop()` on any currently active spinner before printing the Done summary line, ensuring no spinner is left running after the operation completes.

#### Scenario: Capturing frames spinner started eagerly
- **WHEN** `step-start` with `step: 'capture-frames'` is received
- **THEN** a spinner with text `"Capturing frames"` starts immediately — before any `frame-progress` event arrives

#### Scenario: frame-progress updates spinner in place
- **WHEN** `frame-progress` events arrive after `step-start 'capture-frames'`
- **THEN** the existing spinner text is updated to `"Capturing frames (N/total)"` — no new spinner line is created

#### Scenario: No dangling spinner after finish()
- **WHEN** `reporter.finish()` is called while a spinner is still active
- **THEN** the spinner is stopped before the Done summary line is printed and no spinner continues after exit
