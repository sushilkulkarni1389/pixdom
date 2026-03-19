## ADDED Requirements

### Requirement: --auto flag on convert subcommand
The `convert` subcommand SHALL accept `--auto` as a boolean flag (no value). When present, `RenderOptions.auto` SHALL be set to `true`. The flag SHALL be documented in `--help` output with a description that summarises its three effects: element detection, duration detection, and FPS selection.

#### Scenario: --auto accepted without error
- **WHEN** `pixdom convert --html "<div></div>" --format gif --auto` is run
- **THEN** the process does not exit with a flag-parsing error

#### Scenario: --auto appears in help output
- **WHEN** `pixdom convert --help` is run
- **THEN** `--auto` appears in the flag list with a description mentioning element, duration, and FPS detection

### Requirement: --auto auto-summary block on stderr
When `--auto` is active and the CLI receives an `auto-detected` ProgressEvent, it SHALL print a multi-line summary block to stderr before the render steps begin:

```
Auto mode:
  Element:  <selector or "full page"> (<width>×<height>)
  Duration: <durationMs>ms (<strategy description>)
  FPS:      <fps> (<timing description>)
  Frames:   <frames>
```

When `element` is `null` (ambiguous detection), the Element line SHALL read `full page (ambiguous)`. When `duration` is `null` (no animation found), the Duration line SHALL read `none detected — producing static PNG`. The summary SHALL be suppressed when `--no-progress` is set or stderr is not a TTY.

#### Scenario: Auto-summary printed to stderr before render
- **WHEN** `pixdom convert --file page.html --format gif --auto` is run in a TTY
- **THEN** stderr contains an "Auto mode:" block with Element, Duration, FPS, and Frames lines before any "✓" step lines

#### Scenario: Auto-summary suppressed with --no-progress
- **WHEN** `pixdom --no-progress convert --file page.html --format gif --auto` is run
- **THEN** stderr contains no "Auto mode:" block

#### Scenario: No animation detected shown in summary
- **WHEN** `--auto` is active and auto-detection finds no animation cycle
- **THEN** the Duration line in the summary reads `none detected — producing static PNG`

### Requirement: --auto incompatibility warning for --image
When `--auto` is provided alongside `--image`, the CLI SHALL print a warning to stderr that `--auto` is not supported for `--image` inputs and proceed with `auto: false`. The process SHALL NOT exit with an error.

#### Scenario: --auto with --image warns and continues
- **WHEN** `pixdom convert --image photo.jpg --format png --auto` is run
- **THEN** stderr contains a warning that `--auto` is ignored for `--image` inputs and the process exits with code 0 (assuming successful image conversion)

#### Scenario: --auto with --image does not set auto=true in RenderOptions
- **WHEN** `pixdom convert --image photo.jpg --format png --auto` is run
- **THEN** `RenderOptions.auto` is `false` (or not set) when passed to `render()`

### Requirement: --auto ambiguity warning
When `autoDetectElement` returns `null` (ambiguous scores), the CLI SHALL write to stderr: `"Auto-selector: ambiguous — capturing full page. Use --selector to specify."` This is printed as part of the auto-summary block or immediately before it.

#### Scenario: Ambiguity warning printed when element detection fails
- **WHEN** `--auto` is active and `autoDetectElement` returns `null`
- **THEN** stderr contains the ambiguity warning message

### Requirement: --auto LCM-exceeded warning
When `autoDetectDuration` uses the longest-individual-duration fallback (because LCM exceeded 10 000ms), the CLI SHALL print to stderr: `"Animation LCM (<lcm>ms) exceeds 10s cap — using longest single cycle (<durationMs>ms)"`.

#### Scenario: LCM exceeded warning printed
- **WHEN** auto-duration detection falls back from LCM to longest-individual-duration
- **THEN** stderr contains the LCM-exceeded warning with both values

### Requirement: --auto no-animation static fallback warning
When `autoDetectDuration` returns `null` and the requested format is animated (`gif`, `mp4`, `webm`), the CLI SHALL print to stderr: `"No animation detected — producing static PNG. Use --duration to force animated output."` The output format SHALL be silently switched to `png`.

#### Scenario: No-animation warning and format switch
- **WHEN** `pixdom convert --file static.html --format gif --auto` is run and no animation is detected
- **THEN** stderr contains the no-animation warning and a `static.png` output file is produced (not a GIF)
