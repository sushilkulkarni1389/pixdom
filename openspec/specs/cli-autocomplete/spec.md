# cli-autocomplete — requirements

### Requirement: completion subcommand exists
`apps/cli` SHALL expose a `completion` subcommand reachable as `pixdom completion`. When invoked with no flags, it SHALL print the shell-completion initialization script to stdout and exit with code 0. Nothing SHALL be written to stderr on success.

#### Scenario: Completion script printed to stdout
- **WHEN** `pixdom completion` is run with no flags
- **THEN** stdout contains a non-empty shell completion script and the process exits with code 0

#### Scenario: Stderr is silent on success
- **WHEN** `pixdom completion` is run with no flags
- **THEN** stderr is empty

### Requirement: --install flag prints installation instructions
The `completion` subcommand SHALL accept a `--install` flag. When provided, it SHALL print human-readable installation instructions for bash, zsh, and fish to stdout and exit with code 0. The instructions SHALL include the exact command to append to the user's shell rc file.

#### Scenario: Install instructions include rc file commands
- **WHEN** `pixdom completion --install` is run
- **THEN** stdout contains at least one of `~/.bashrc`, `~/.zshrc`, or `~/.config/fish/completions/` and the process exits with code 0

#### Scenario: Install flag does not modify any files
- **WHEN** `pixdom completion --install` is run
- **THEN** no files on disk are created or modified by the process

### Requirement: Flag-level completions for convert subcommand
After sourcing the completion script, pressing TAB after `pixdom convert --` SHALL suggest all flags defined in the `convert` subcommand: `--html`, `--file`, `--url`, `--image`, `--profile`, `--output`, `--format`, `--width`, `--height`, `--quality`, `--fps`, `--duration`, `--auto-size`.

#### Scenario: All convert flags surface on TAB
- **WHEN** the completion script is sourced and the user types `pixdom convert --` then presses TAB
- **THEN** the shell presents all convert flags as completion candidates

### Requirement: --profile value completion
After sourcing the completion script, pressing TAB after `pixdom convert --profile ` (with trailing space) SHALL suggest all canonical profile slugs plus the three legacy alias slugs (`instagram`, `twitter`, `linkedin`). The full candidate list is: `linkedin-background`, `linkedin-post`, `linkedin-article-cover`, `linkedin-profile`, `linkedin-single-image-ad`, `linkedin-career-background`, `twitter-post`, `twitter-header`, `twitter-ad`, `twitter-video`, `twitter-ad-landscape`, `instagram-post-3-4`, `instagram-post-4-5`, `instagram-post-square`, `instagram-story`, `instagram-reel`, `instagram-profile`, `instagram-story-video`, `square`, `linkedin`, `twitter`, `instagram`.

#### Scenario: Profile slugs surface as choices
- **WHEN** the completion script is sourced and the user types `pixdom convert --profile ` then presses TAB
- **THEN** the shell presents all 22 slugs (19 canonical + 3 legacy aliases) as candidates

#### Scenario: Legacy alias slugs surface as choices
- **WHEN** the completion script is sourced and the user types `pixdom convert --profile ins` then presses TAB
- **THEN** the shell presents both the bare `instagram` alias and all `instagram-*` canonical slugs as candidates

### Requirement: --format value completion
After sourcing the completion script, pressing TAB after `pixdom convert --format ` SHALL suggest the six valid format values: `png`, `jpeg`, `webp`, `gif`, `mp4`, `webm`.

#### Scenario: Format values surface as choices
- **WHEN** the completion script is sourced and the user types `pixdom convert --format ` then presses TAB
- **THEN** the shell presents exactly `png jpeg webp gif mp4 webm` as candidates

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

### Requirement: No completion for free-text and numeric flags
`--url`, `--html`, `--width`, `--height`, `--quality`, `--fps`, and `--duration` SHALL NOT provide value-level completions. The shell SHALL fall back to its default behaviour (typically no suggestions or filename completion) for these flags.

#### Scenario: --url provides no value completions
- **WHEN** the completion script is sourced and the user types `pixdom convert --url ` then presses TAB
- **THEN** no pixdom-specific candidates are injected by the completion script

### Requirement: Cross-shell support
The completion script produced by `pixdom completion` SHALL be compatible with bash (≥3.2), zsh (≥5.0), and fish (≥3.0). The omelette package SHALL be used to generate and register completions for all three shells.

The bash completion registration SHALL use `complete -F ${fn} -o default ${program}` (adding `-o default`) so that when the completion function returns an empty COMPREPLY, bash falls back to its native filename completion rather than showing nothing.

The zsh completion function SHALL capture omelette's output into a local variable and call `compadd` only when the output is non-empty; when the output is empty, it SHALL call `_path_files` as a fallback so zsh performs native path completion.

For fish, `pixdom --completion-fish` SHALL be intercepted before omelette is instantiated and SHALL output a custom fish completion file generated by a `generateFishCompletionScript()` function. This function emits:
- `complete -c pixdom -f` (disable default file completion globally)
- Per-flag `complete` entries for all convert flags
- `-F` (force-files) flag on `--file` and `--image` entries to re-enable native path completion for those flags
- `-r -a "..."` value lists for `--format` and `--profile`

#### Scenario: Script sources without error in bash
- **WHEN** the output of `pixdom completion` is piped into `bash -s`
- **THEN** the process exits with code 0 and no error is printed

#### Scenario: Script sources without error in zsh
- **WHEN** the output of `pixdom completion` is piped into `zsh -s`
- **THEN** the process exits with code 0 and no error is printed

#### Scenario: Bash falls back to filename completion when no candidates
- **WHEN** the completion script is sourced and TAB is pressed after `--file` with no omelette candidates
- **THEN** bash presents filesystem entries (via `-o default` fallback) rather than an empty list

#### Scenario: Zsh falls back to path completion when no candidates
- **WHEN** the completion script is sourced and TAB is pressed after `--file` with no omelette candidates
- **THEN** zsh calls `_path_files` and presents filesystem entries

#### Scenario: Fish completes file paths for --file and --image
- **WHEN** `pixdom --completion-fish` output is saved to the fish completions directory and the user types `pixdom convert --file ./` then presses TAB
- **THEN** fish presents filesystem entries (via `-F` force-files in the generated completion entry)

#### Scenario: Fish --completion-fish output is custom
- **WHEN** `pixdom --completion-fish` is run
- **THEN** stdout contains `complete -c pixdom -l file` with `-F` flag and profile/format value lists
