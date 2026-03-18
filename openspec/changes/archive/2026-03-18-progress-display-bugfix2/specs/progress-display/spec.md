## MODIFIED Requirements

### Requirement: ora spinner step display
The `STEP_LABELS` map SHALL include `'write-output': 'Writing output'` so that `step-start`/`step-done` events for the `write-output` step display a "Writing output" spinner.

The reporter SHALL handle the `encode-done` event by calling `spinner.succeed(\`Encoding ${event.format} (100%)\`)` and setting `spinner = null`. This ensures the encode spinner is properly closed with a success mark before the `write-output` spinner begins.

#### Scenario: write-output spinner shown for all renderers
- **WHEN** any renderer emits `step-start 'write-output'`
- **THEN** a spinner with text `"Writing output"` is shown and succeeded on `step-done 'write-output'`

#### Scenario: encode-done succeeds encode spinner
- **WHEN** `encode-done` is received after FFmpeg encoding
- **THEN** the encode spinner is succeeded with `"Encoding GIF (100%)"` (or MP4/WEBM) and no spinner remains active
