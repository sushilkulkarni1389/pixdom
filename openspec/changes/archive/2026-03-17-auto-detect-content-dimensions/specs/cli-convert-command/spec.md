## ADDED Requirements

### Requirement: --auto-size flag
The `convert` subcommand SHALL accept `--auto-size` as a boolean flag (no value). When present, `RenderOptions.autoSize` SHALL be set to `true` and the rendered output dimensions SHALL reflect the page's natural content size.

#### Scenario: --auto-size passes autoSize to render
- **WHEN** `pixdom convert --html "<div style='height:2000px'>" --auto-size` is run
- **THEN** `RenderOptions.autoSize` is `true` and the output image height is approximately 2000px

#### Scenario: --auto-size omitted uses fixed viewport
- **WHEN** `pixdom convert --html "<div style='height:2000px'>"` is run without `--auto-size`
- **THEN** the output image height is the default 720px (or the `--height` value)

#### Scenario: --auto-size combined with --width
- **WHEN** `pixdom convert --html "..." --auto-size --width 600` is run
- **THEN** the output width is 600px and the height is auto-detected from content
