## ADDED Requirements

### Requirement: Custom compgen intercept runs before omelette init
`registerCompletion()` SHALL check for `--compgen` in `process.argv` before instantiating or calling `completion.init()`. When `--compgen` is found, it SHALL extract the `prev` word at `process.argv[compgenIdx + 2]`, resolve completions via `getCompletionsForPrev(prev)`, write the newline-joined result to stdout, and call `process.exit(0)`. The `completion.init()` call SHALL NOT be reached for `--compgen` invocations.

#### Scenario: --profile completions returned via compgen intercept
- **WHEN** the shell invokes `pixdom --compbash --compgen 3 --profile "pixdom convert --profile "`
- **THEN** stdout contains all 22 profile slugs (one per line) and the process exits with code 0

#### Scenario: --format completions returned via compgen intercept
- **WHEN** the shell invokes `pixdom --compbash --compgen 3 --format "pixdom convert --format "`
- **THEN** stdout contains exactly `png`, `jpeg`, `webp`, `gif`, `mp4`, `webm` (one per line) and the process exits with code 0

#### Scenario: Unknown prev falls through to empty output
- **WHEN** the shell invokes `pixdom --compbash --compgen 3 --url "pixdom convert --url "`
- **THEN** stdout is empty (or a single newline) and the process exits with code 0

### Requirement: getCompletionsForPrev covers all enumerable flag values
`getCompletionsForPrev(prev: string)` SHALL return:
- `PROFILE_SLUGS` (22 entries) when `prev` is `--profile`
- `FORMAT_VALUES` (`png jpeg webp gif mp4 webm`) when `prev` is `--format`
- `[]` for all other flags (`--url`, `--html`, `--selector`, `--output`, `--file`, `--image`, `--width`, `--height`, `--quality`, `--fps`, `--duration`)
- Subcommand lists (`['convert', 'completion', 'mcp']`) when `prev` is `pixdom`
- `[]` as the default case

#### Scenario: PROFILE_SLUGS returned for --profile
- **WHEN** `getCompletionsForPrev('--profile')` is called
- **THEN** the return value contains exactly 22 entries including `linkedin-post` and `instagram`

#### Scenario: FORMAT_VALUES returned for --format
- **WHEN** `getCompletionsForPrev('--format')` is called
- **THEN** the return value is `['png', 'jpeg', 'webp', 'gif', 'mp4', 'webm']`

#### Scenario: Empty array for free-text flags
- **WHEN** `getCompletionsForPrev('--url')` is called
- **THEN** the return value is `[]`

## MODIFIED Requirements

### Requirement: File-path completion for file-based flags
After sourcing the completion script, pressing TAB after `--file ` or `--image ` SHALL delegate to the shell's native file-path completion mechanism.

The `--compgen` early intercept (see "Custom compgen intercept runs before omelette init") runs before `completion.init()`. For `--file` and `--image`, `getCompletionsForPrev()` returns `[]`, causing the intercept to write an empty line and exit. The shell's `-o default` (bash) or `_path_files` (zsh) fallback then provides native filename completion.

The omelette `init()` call SHALL be wrapped in a try/catch so that any internal crash during TAB completion that reaches this path (Layer 1, Layer 2 traversal) is silently swallowed. When an error is caught, completion exits without output and the shell falls through to its default filename completion behaviour.

After the try/catch around `completion.init()`, `registerCompletion()` SHALL check whether any omelette completion flags (`--compbash`, `--compzsh`, `--compgen`, `--compfish`) are present in `process.argv` (recorded before `init()` runs). If so and the process has not already exited, it SHALL write `'\n'` to stdout and call `process.exit(0)`.

#### Scenario: --file triggers path completion
- **WHEN** the completion script is sourced and the user types `pixdom convert --file ./` then presses TAB
- **THEN** the shell lists filesystem entries under `./` as candidates

#### Scenario: No crash when --file follows other flags
- **WHEN** the completion script is sourced and the user types `pixdom convert --html "x" --file ./` then presses TAB
- **THEN** no stack trace is printed to stderr and the shell falls through to native filename completion

#### Scenario: --file triggers path completion regardless of surrounding flags
- **WHEN** the completion script is sourced and the user types `pixdom convert --selector "#x" --file ./` then presses TAB
- **THEN** the shell lists filesystem entries under `./` as candidates (native completion fallback)

#### Scenario: No Commander error after omelette crash
- **WHEN** omelette's `init()` crashes during completion context (e.g. `pixdom --compbash --compgen N prev line`)
- **THEN** the process exits with code 0 and stderr does not contain "unknown option"
