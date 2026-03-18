## Why

Users invoking `pixdom` from the terminal must memorize flag names, profile slugs, and enum values, slowing adoption and increasing typo-driven errors. Shell autocomplete eliminates that friction — surfacing valid choices inline — and is a standard expectation for CLI tools targeting developer workflows.

## What Changes

- Add a `pixdom completion` subcommand that emits a shell completion script for bash, zsh, or fish
- Integrate the `omelette` npm package to handle cross-shell completion registration
- Provide `--install` flag on the subcommand that prints shell-specific installation instructions
- Wire completions for all flags defined in the `cli-convert-command` spec, including value-level completions for enum flags (`--profile`, `--format`) using data from the `platform-profiles` spec

## Capabilities

### New Capabilities

- `cli-autocomplete`: Shell completion subcommand (`pixdom completion`) and completion logic for all CLI flags, including per-flag value suggestions for `--profile` and `--format`

### Modified Capabilities

<!-- No existing spec-level requirements are changing. -->

## Impact

- **packages/cli**: New `completion` command module; `omelette` added as a runtime dependency
- **cli-convert-command spec**: Read for flag list (no spec-level change)
- **platform-profiles spec**: ProfileSlug values sourced for `--profile` completions (no spec-level change)
- **End-users**: Must run `pixdom completion` once and source the output in their shell rc; no breaking changes to existing commands
