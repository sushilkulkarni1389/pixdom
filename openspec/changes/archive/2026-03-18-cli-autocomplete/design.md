## Context

`pixdom` is a Node.js CLI built on `commander` inside `apps/cli`. Users currently must recall all flag names, valid profile slugs (`instagram`, `twitter`, `linkedin`, `square`), and format values (`png`, `jpeg`, `webp`, `gif`, `mp4`, `webm`) from memory. The `omelette` package provides a lightweight, cross-shell (bash/zsh/fish) completion framework that integrates well with Node.js CLIs without requiring native binaries.

## Goals / Non-Goals

**Goals:**
- `pixdom completion` prints a shell-completion script to stdout that users can source
- `pixdom completion --install` prints copy-paste installation instructions for bash, zsh, and fish
- `--<TAB>` completes all flags from `convert` subcommand
- `--profile <TAB>` completes `instagram twitter linkedin square`
- `--format <TAB>` completes `png jpeg webp gif mp4 webm`
- `--input <TAB>` (file-based flags) delegates to shell's native file-path completion
- No impact on existing `convert` subcommand behaviour

**Non-Goals:**
- Dynamic completion from remote sources (e.g., fetching profiles at runtime)
- Windows PowerShell / cmd.exe completion
- Completion for `--html` value (arbitrary HTML string)
- Completion for numeric flags (`--width`, `--height`, `--quality`, `--fps`, `--duration`)

## Decisions

### 1. Use `omelette` over custom shell scripts
**Decision**: Add `omelette` as a runtime dependency in `apps/cli`.

**Rationale**: `omelette` handles the per-shell boilerplate (bash `complete`, zsh `compdef`, fish `complete`) and exposes a simple event-driven API (`omelette.on('--profile', ...)`) that maps cleanly to the flag-level completion needed. Writing raw shell scripts for three shells would add ~300 lines of fragile shell code with no type safety.

**Alternative considered**: `commander`'s built-in `parseOptions` with `zsh-tab-completion` — rejected because it has no fish support and requires manual tab-file management.

### 2. Static value lists, not runtime import
**Decision**: Hard-code the profile slugs (`['instagram', 'twitter', 'linkedin', 'square']`) and format values (`['png', 'jpeg', 'webp', 'gif', 'mp4', 'webm']`) in the completion module rather than importing `PROFILES` from `@pixdom/profiles` at completion time.

**Rationale**: Completion scripts are installed once and sourced into the shell; they do not re-execute on each TAB press. `omelette`'s `setupShellInitFile` emits a static script. Dynamic import at completion-hint time is only relevant for `omelette`'s programmatic (non-init-file) mode, which adds startup latency. Keeping values static avoids requiring `@pixdom/profiles` to be resolved at shell init.

**Trade-off**: If a new profile is added, the completion list must be manually updated alongside the profiles package.

### 3. `pixdom completion` as a sibling subcommand to `convert`
**Decision**: Register `completion` as a `commander` subcommand at the top-level program, not as a flag.

**Rationale**: This follows conventions established by tools like `kubectl completion`, `gh completion`, and `npm completion`. It keeps the top-level `--help` output clean and makes the feature discoverable.

### 4. `--install` flag prints instructions; pipe prints the script
**Decision**: `pixdom completion` (no flags) prints the raw completion script to stdout. `pixdom completion --install` prints human-readable shell-specific instructions.

**Rationale**: Piping is idiomatic on Unix (`pixdom completion >> ~/.zshrc`). The `--install` flag serves users who want step-by-step guidance without having to know their shell's rc file path.

## Risks / Trade-offs

- **`omelette` maturity**: The package is lightly maintained (~2019 last major release) but stable and widely used. Risk of abandonment is low-impact since it's a dev-facing feature. → Mitigation: pin a specific minor version.
- **Shell detection**: `omelette` detects the current shell via `$SHELL`. In environments with non-standard `$SHELL` (e.g., Docker containers), it may default to bash. → Mitigation: document bash as the fallback; users can pass `--shell` if omelette supports it.
- **Static profile list drift**: If `platform-profiles` gains new presets, `--profile` completion will silently omit them. → Mitigation: add a comment in the completion source pointing to the profiles spec.

## Migration Plan

1. Add `omelette` dependency to `apps/cli/package.json`
2. Create `apps/cli/src/commands/completion.ts` with completion definitions
3. Register the command in `apps/cli/src/index.ts`
4. Users opt in by running `pixdom completion >> ~/.zshrc` (or equivalent) once — no existing behaviour changes
5. No rollback needed; removing the subcommand in a future version is non-breaking
