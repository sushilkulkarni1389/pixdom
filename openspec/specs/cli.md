# apps/cli — requirements

## Capabilities
- Accepts --html (inline string), --file (path), or --url as input
- Accepts --output flag for destination path
- Accepts --profile flag to select a platform preset
- Accepts --format flag to override output format
- Accepts --width and --height flags to override viewport
- Prints output path to stdout on success
- Prints errors to stderr with non-zero exit code on failure

## Constraints
- CLI binary name is pixdom
- Imports @pixdom/core and @pixdom/profiles only — no direct Playwright usage
- Never exits with code 0 on error
- All flags must have sensible defaults (no required flags except input source)

## v1 acceptance criteria
- [ ] pixdom convert --html "<h1>Hello</h1>" produces a PNG at default dimensions
- [ ] --profile instagram produces 1080x1080 output
- [ ] --file path/to/file.html reads and renders the file correctly
- [ ] Invalid input exits with code 1 and a message to stderr
- [ ] --help prints usage without error
- [ ] Output path is printed to stdout on success
