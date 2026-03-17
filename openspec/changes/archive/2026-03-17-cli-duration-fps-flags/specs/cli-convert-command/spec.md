## ADDED Requirements

### Requirement: --fps flag
The `convert` subcommand SHALL accept `--fps <n>` where `n` is a positive integer specifying the frame rate for animated output formats (GIF, MP4, WebM). When omitted, the animated renderer's built-in default of 30fps applies. The flag SHALL be passed as `fps` in `RenderOptions`.

#### Scenario: --fps sets frame rate
- **WHEN** `pixdom convert --html "<div>" --format gif --fps 24` is run
- **THEN** `RenderOptions.fps` is set to `24` and the output GIF is encoded at 24fps

#### Scenario: --fps omitted uses renderer default
- **WHEN** `pixdom convert --html "<div>" --format mp4` is run without `--fps`
- **THEN** `RenderOptions.fps` is `undefined` and the animated renderer defaults to 30fps

### Requirement: --duration flag
The `convert` subcommand SHALL accept `--duration <ms>` where `ms` is a positive integer specifying the animation cycle length in milliseconds. When provided, `render()` SHALL use this value as the cycle duration instead of calling `detectAnimationCycle()`. The flag SHALL be validated: a value of 0 or less SHALL cause the CLI to print an error to stderr and exit with code 1.

#### Scenario: --duration overrides detection
- **WHEN** `pixdom convert --html "<div>" --format gif --duration 2000` is run
- **THEN** `RenderOptions.duration` is set to `2000` and the GIF captures a 2000ms animation cycle

#### Scenario: --duration omitted uses auto-detection
- **WHEN** `pixdom convert --html "<div>" --format gif` is run without `--duration`
- **THEN** `RenderOptions.duration` is `undefined` and `render()` calls `detectAnimationCycle()`

#### Scenario: --duration zero or negative exits with error
- **WHEN** `pixdom convert --html "<div>" --format gif --duration 0` is run
- **THEN** stderr contains a validation error and the process exits with code 1
