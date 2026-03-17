## ADDED Requirements

### Requirement: --image flag
The `convert` subcommand SHALL accept `--image <path>` as a fourth mutually-exclusive input flag alongside `--html`, `--file`, and `--url`. When provided, `RenderInput` SHALL be set to `{ type: 'image', path: path.resolve(opts.image) }`. The path SHALL be resolved to an absolute path before passing to `render()`.

#### Scenario: --image produces output file
- **WHEN** `pixdom convert --image /path/to/photo.jpg --format png` is run
- **THEN** a PNG file is written to the output path and its absolute path is printed to stdout

#### Scenario: --image with --html exits with error
- **WHEN** `pixdom convert --image photo.jpg --html "<h1>Hi</h1>"` is run
- **THEN** stderr contains a mutual-exclusion error and the process exits with code 1

#### Scenario: --image with animated format exits with error
- **WHEN** `pixdom convert --image photo.jpg --format gif` is run
- **THEN** the process exits with code 1 (CAPTURE_FAILED propagated from render)
