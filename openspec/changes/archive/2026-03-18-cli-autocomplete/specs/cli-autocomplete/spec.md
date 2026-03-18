## ADDED Requirements

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

### Requirement: File-path completion for file-based flags
After sourcing the completion script, pressing TAB after `--file ` or `--image ` SHALL delegate to the shell's native file-path completion mechanism.

#### Scenario: --file triggers path completion
- **WHEN** the completion script is sourced and the user types `pixdom convert --file ./` then presses TAB
- **THEN** the shell lists filesystem entries under `./` as candidates

### Requirement: No completion for free-text and numeric flags
`--url`, `--html`, `--width`, `--height`, `--quality`, `--fps`, and `--duration` SHALL NOT provide value-level completions. The shell SHALL fall back to its default behaviour (typically no suggestions or filename completion) for these flags.

#### Scenario: --url provides no value completions
- **WHEN** the completion script is sourced and the user types `pixdom convert --url ` then presses TAB
- **THEN** no pixdom-specific candidates are injected by the completion script

### Requirement: Cross-shell support
The completion script produced by `pixdom completion` SHALL be compatible with bash (≥3.2), zsh (≥5.0), and fish (≥3.0). The omelette package SHALL be used to generate and register completions for all three shells.

#### Scenario: Script sources without error in bash
- **WHEN** the output of `pixdom completion` is piped into `bash -s`
- **THEN** the process exits with code 0 and no error is printed

#### Scenario: Script sources without error in zsh
- **WHEN** the output of `pixdom completion` is piped into `zsh -s`
- **THEN** the process exits with code 0 and no error is printed
