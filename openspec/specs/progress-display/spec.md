# progress-display — requirements

### Requirement: ora spinner step display
The CLI progress reporter SHALL use the `ora` package to display a spinner for each active step. Each step SHALL transition from a spinning state to a `✓` success mark when completed. Steps SHALL be written to stderr only. When `--no-progress` is set or when stderr is not a TTY, no spinner output SHALL be emitted.

The `STEP_LABELS` map SHALL include `'write-output': 'Writing output'` so that `step-start`/`step-done` events for the `write-output` step display a "Writing output" spinner.

The reporter SHALL handle the `encode-done` event by calling `spinner.succeed(\`Encoding ${event.format} (100%)\`)` and setting `spinner = null`. This ensures the encode spinner is properly closed with a success mark before the `write-output` spinner begins.

The reporter SHALL handle the `capture-frames` step explicitly:
- On `step-start` with `step: 'capture-frames'` it SHALL immediately start a new spinner with text `"Capturing frames"`.
- On `frame-progress` events it SHALL update the existing spinner text in place (`"Capturing frames (N/total)"`); it SHALL NOT create a new spinner from a `frame-progress` event.
- On `step-done` with `step: 'capture-frames'` it SHALL succeed the spinner using the last known frame count (e.g. `"Capturing frames (30/30)"`) or `"Capturing frames"` if no `frame-progress` was received.

`reporter.finish()` SHALL call `spinner.stop()` on any currently active spinner before printing the Done summary line, ensuring no spinner is left running after the operation completes.

#### Scenario: Steps appear on stderr during render
- **WHEN** `pixdom convert --html "<div></div>" --format png` is run in a TTY
- **THEN** stderr shows at least "Loading page" and "Capturing screenshot" lines with success marks before the process exits

#### Scenario: --no-progress suppresses all spinner output
- **WHEN** `pixdom convert --no-progress --html "<div></div>" --format png` is run
- **THEN** stderr contains no spinner characters or step labels

#### Scenario: Non-TTY stderr suppresses spinner
- **WHEN** `pixdom convert --html "<div></div>" --format png 2>/dev/null` is run (stderr redirected)
- **THEN** no spinner escape sequences are emitted to the redirected output

#### Scenario: Capturing frames spinner started eagerly
- **WHEN** `step-start` with `step: 'capture-frames'` is received
- **THEN** a spinner with text `"Capturing frames"` starts immediately — before any `frame-progress` event arrives

#### Scenario: frame-progress updates spinner in place
- **WHEN** `frame-progress` events arrive after `step-start 'capture-frames'`
- **THEN** the existing spinner text is updated to `"Capturing frames (N/total)"` — no new spinner line is created

#### Scenario: No dangling spinner after finish()
- **WHEN** `reporter.finish()` is called while a spinner is still active
- **THEN** the spinner is stopped before the Done summary line is printed and no spinner continues after exit

#### Scenario: write-output spinner shown for all renderers
- **WHEN** any renderer emits `step-start 'write-output'`
- **THEN** a spinner with text `"Writing output"` is shown and succeeded on `step-done 'write-output'`

#### Scenario: encode-done succeeds encode spinner
- **WHEN** `encode-done` is received after FFmpeg encoding
- **THEN** the encode spinner is succeeded with `"Encoding GIF (100%)"` (or MP4/WEBM) and no spinner remains active

### Requirement: Conditional step visibility
Steps SHALL only be shown when the corresponding operation is actually performed. Steps for operations that are skipped SHALL NOT appear in the output.

#### Scenario: Resize step absent when no profile or custom dimensions
- **WHEN** `pixdom convert --html "<div></div>" --format png` is run without `--profile`, `--width`, or `--height`
- **THEN** stderr does NOT contain a "Resizing" step

#### Scenario: Detecting content step shown when --selector active
- **WHEN** `pixdom convert --html "<div id='x'></div>" --selector "#x" --format png` is run
- **THEN** stderr contains a "Detecting content" (or equivalent selector-resolution) step

#### Scenario: Detecting animation step shown for animated format
- **WHEN** `pixdom convert --html "..." --format gif` is run
- **THEN** stderr contains a "Detecting animation" step before "Capturing frames"

### Requirement: Live frame counter
During animated capture, the frame capture step SHALL update in place showing the current and total frame count.

#### Scenario: Frame counter updates during capture
- **WHEN** `pixdom convert --html "..." --format gif --duration 1000 --fps 30` is run
- **THEN** the "Capturing frames" spinner text updates to show `(N/30)` as frames are captured

### Requirement: FFmpeg encoding percentage
During FFmpeg encoding, the encoding step label SHALL update in place with the completion percentage when fluent-ffmpeg emits progress events.

#### Scenario: Encoding percentage shown during GIF encode
- **WHEN** a GIF is being encoded from a multi-frame sequence
- **THEN** the encoding step label updates to show `Encoding GIF (N%)` during the encode pass

#### Scenario: Encoding step shown without percentage when progress unavailable
- **WHEN** FFmpeg does not emit progress events during encode
- **THEN** the encoding step label remains `Encoding GIF` (without percentage) until encode completes

### Requirement: Profile name in resize step
When `--profile` is active and a resize step is shown, the step label SHALL include the resolved profile slug.

#### Scenario: Profile slug shown in resize step label
- **WHEN** `pixdom convert --html "..." --profile linkedin-post --format jpeg` is run
- **THEN** the resize step label contains "linkedin-post"

### Requirement: Total operation duration line
After all steps complete and the output file is written, the CLI SHALL print a single summary line to stderr:

```
✓ Done in <duration> → <absolute-output-path>
```

Duration formatting rules:
- Under 1000ms: show milliseconds — `Done in 340ms`
- 1000ms to 59999ms: show seconds with one decimal — `Done in 4.2s`
- 60000ms and over: show minutes and seconds — `Done in 1m 23s`

The output file path on stdout SHALL remain unchanged (bare path for scripting). The summary line is a stderr-only addition. When `--no-progress` is set or stderr is not a TTY, the summary line SHALL be suppressed along with all other progress output.

#### Scenario: Duration line printed to stderr after static render
- **WHEN** `pixdom convert --html "<div></div>" --format png --output /tmp/out.png` is run
- **THEN** stderr contains a line matching `✓ Done in \d+(\.\d+)?(ms|s) → /tmp/out.png`

#### Scenario: Stdout contains only the output path
- **WHEN** `pixdom convert --html "<div></div>" --format png --output /tmp/out.png` is run
- **THEN** stdout contains exactly `/tmp/out.png\n` and no timing information

#### Scenario: Duration under 1s shown in milliseconds
- **WHEN** a render completes in under 1 second
- **THEN** the summary line shows the duration in milliseconds, e.g. `Done in 340ms`

#### Scenario: Duration 1–60s shown with one decimal
- **WHEN** a render completes in between 1 and 60 seconds
- **THEN** the summary line shows the duration in seconds with one decimal, e.g. `Done in 4.2s`

#### Scenario: Duration over 60s shown as minutes and seconds
- **WHEN** a render completes in over 60 seconds
- **THEN** the summary line shows the duration in minutes and whole seconds, e.g. `Done in 1m 23s`

#### Scenario: --no-progress suppresses duration line
- **WHEN** `pixdom --no-progress convert --html "<div></div>" --format png` is run
- **THEN** stderr contains no `Done in` line

### Requirement: --no-progress global flag
The CLI SHALL accept `--no-progress` as a global boolean flag on the root `pixdom` program. When set, the `ProgressReporter` passed to `render()` SHALL be a no-op function. The flag SHALL appear in `--help` output.

#### Scenario: --no-progress accepted without error
- **WHEN** `pixdom --no-progress convert --html "x" --format png` is run
- **THEN** the process exits with code 0 (no flag parsing error)

#### Scenario: --no-progress appears in help
- **WHEN** `pixdom --help` is run
- **THEN** `--no-progress` appears in the help text
