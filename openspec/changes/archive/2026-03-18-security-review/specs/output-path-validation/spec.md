## ADDED Requirements

### Requirement: Pre-render --output path validation
The CLI SHALL validate the `--output` path at parse time, before any browser is launched or rendering begins. Validation SHALL:
1. Resolve the path to an absolute path.
2. Reject paths whose absolute form starts with `/dev/`, `/proc/`, or `/sys/`.
3. Verify the parent directory exists (`fs.statSync` reachable).
4. Verify the parent directory is writable (`fs.accessSync` with `fs.constants.W_OK`).
The error code for all rejection cases SHALL be `INVALID_OUTPUT_PATH`.

#### Scenario: /dev/null output path rejected
- **WHEN** `pixdom convert --html "x" --output /dev/null` is run
- **THEN** the process exits with code 1 and stderr contains `INVALID_OUTPUT_PATH` before any render begins

#### Scenario: /proc/self/mem output path rejected
- **WHEN** `pixdom convert --html "x" --output /proc/self/mem` is run
- **THEN** the process exits with code 1 and stderr contains `INVALID_OUTPUT_PATH`

#### Scenario: Non-existent parent directory rejected
- **WHEN** `pixdom convert --html "x" --output /nonexistent/dir/out.png` is run
- **THEN** the process exits with code 1 and stderr contains `INVALID_OUTPUT_PATH`

#### Scenario: Non-writable parent directory rejected
- **WHEN** `pixdom convert --html "x" --output /root/out.png` is run as a non-root user
- **THEN** the process exits with code 1 and stderr contains `INVALID_OUTPUT_PATH`

#### Scenario: Valid output path in writable directory passes
- **WHEN** `pixdom convert --html "x" --output /tmp/out.png` is run
- **THEN** the validation passes and rendering proceeds

### Requirement: Overwrite warning for existing output file
When the `--output` path refers to an existing file, the CLI SHALL print a warning to stderr before rendering begins but SHALL NOT block the render.

#### Scenario: Existing output file triggers warning
- **WHEN** `pixdom convert --html "x" --output /tmp/existing.png` is run and `/tmp/existing.png` already exists
- **THEN** stderr contains a warning that the file will be overwritten, and the render completes successfully

#### Scenario: Non-existing output path has no warning
- **WHEN** `pixdom convert --html "x" --output /tmp/new-file.png` is run and the file does not exist
- **THEN** no overwrite warning is printed

### Requirement: Shell metacharacter rejection in --output
The CLI SHALL reject `--output` values that contain any of the following shell metacharacters: `;`, `&`, `|`, `$`, `` ` ``, `(`, `)`, `<`, `>`, newline (`\n`). Error code: `INVALID_OUTPUT_PATH`.

#### Scenario: Semicolon in output path rejected
- **WHEN** `pixdom convert --html "x" --output "out.png; rm -rf ~"` is run
- **THEN** the process exits with code 1 and stderr contains `INVALID_OUTPUT_PATH`
