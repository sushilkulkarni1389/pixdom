## MODIFIED Requirements

### Requirement: File-path completion for file-based flags
The omelette `init()` call SHALL be wrapped in a try/catch so that any internal crash during TAB completion (e.g. omelette's tree traversal via `reduce()` hitting `undefined` when a flag value rather than a flag name appears as a tree key) is silently swallowed. When an error is caught, completion exits without output and the shell falls through to its default filename completion behaviour.

This guard is required because omelette's tree-traversal crashes when other flags and their values precede `--file` or `--image` in the command line (e.g. `pixdom convert --html "x" --file <TAB>`). The `--file` and `--image` completion nodes already return `[]` to signal native filename completion; the try/catch ensures that path is reached even in multi-flag contexts.

#### Scenario: No crash when --file follows other flags
- **WHEN** the completion script is sourced and the user types `pixdom convert --html "x" --file ./` then presses TAB
- **THEN** no stack trace is printed to stderr and the shell falls through to native filename completion

#### Scenario: --file triggers path completion regardless of surrounding flags
- **WHEN** the completion script is sourced and the user types `pixdom convert --selector "#x" --file ./` then presses TAB
- **THEN** the shell lists filesystem entries under `./` as candidates (native completion fallback)
