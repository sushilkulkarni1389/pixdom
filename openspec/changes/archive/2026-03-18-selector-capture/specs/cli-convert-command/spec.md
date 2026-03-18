## ADDED Requirements

### Requirement: --selector flag
The `convert` subcommand SHALL accept `--selector <css>` as an optional string flag. When provided, its value SHALL be passed as `RenderOptions.selector`. The flag SHALL be documented in `--help` output.

#### Scenario: --selector passed to render
- **WHEN** `pixdom convert --html "<div id='x'>" --selector "#x"` is run
- **THEN** `RenderOptions.selector` is set to `"#x"` and `render()` is called with that value

#### Scenario: --selector absent leaves selector undefined
- **WHEN** `pixdom convert --html "..."` is run without `--selector`
- **THEN** `RenderOptions.selector` is `undefined` and full-viewport capture proceeds

### Requirement: --selector warns when combined with --width or --height
When `--selector` is provided alongside `--width` or `--height`, the CLI SHALL write a warning to stderr before calling `render()`. The `--width`/`--height` values SHALL NOT be passed into `RenderOptions.viewport` — the element bounding box determines output dimensions. The process SHALL NOT exit with an error.

#### Scenario: --width with --selector emits warning
- **WHEN** `pixdom convert --html "..." --selector "#x" --width 1280` is run
- **THEN** stderr contains a warning that `--width` is ignored because `--selector` is active, and the process continues

#### Scenario: --height with --selector emits warning
- **WHEN** `pixdom convert --html "..." --selector "#x" --height 720` is run
- **THEN** stderr contains a warning that `--height` is ignored because `--selector` is active, and the process continues

### Requirement: --selector suppresses --auto-size
When `--selector` is provided alongside `--auto-size`, `RenderOptions.autoSize` SHALL be set to `false` (or omitted). The CLI MAY omit a warning for this combination; suppression is silent.

#### Scenario: --auto-size silently suppressed when --selector active
- **WHEN** `pixdom convert --html "..." --selector "#x" --auto-size` is run
- **THEN** `RenderOptions.autoSize` is `false` (or undefined) and element bounding box drives output dimensions

### Requirement: --selector ignored for --image input
When `--selector` is provided alongside `--image`, the CLI SHALL write a warning to stderr that `--selector` is not supported for image inputs, and SHALL proceed without passing `selector` to `render()`.

#### Scenario: --selector with --image emits warning and proceeds
- **WHEN** `pixdom convert --image photo.jpg --selector "#x"` is run
- **THEN** stderr contains a warning that `--selector` is ignored for `--image` inputs, and the process exits with code 0 (assuming successful image conversion)
