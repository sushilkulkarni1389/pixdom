## Context

`registerCompletion()` in `apps/cli/src/commands/completion.ts` builds an omelette completion tree that maps each flag to a values array (e.g. `'--profile' → PROFILE_SLUGS`). When the shell invokes `pixdom --compbash --compgen N prev line`, omelette's `init()` internally calls `reduce()` over the split argv to walk the tree and locate the candidate array. This traversal crashes when it reaches a flag-value entry (e.g. `tree['convert']['--profile']`) whose value is an array rather than an object — `reduce()` tries to index into the array as if it were a map and returns `undefined`, then throws. The surrounding try/catch swallows the error, the fallback `process.exit(0)` fires with empty stdout, and the shell receives no candidates for Layer 3 (flag values).

Current implementation state:
- Layer 1 (subcommands: `convert completion mcp`) — works; omelette tree traversal succeeds at top level.
- Layer 2 (flag names: `--profile --format ...`) — works; traversal finds the flag-name keys of the `convert` subtree before reaching values.
- Layer 3 (flag values: profile slugs, format values) — **broken**; traversal crashes trying to index into the values array.

## Goals / Non-Goals

**Goals:**
- Fix Layer 3 completions so `--profile <TAB>` returns 22 slugs and `--format <TAB>` returns 6 format values.
- Preserve all working behaviors: Layer 1, Layer 2, `--file`/`--image` path fallback, fish completions, `--install` rc-file write.
- Change exactly one file: `apps/cli/src/commands/completion.ts`.

**Non-Goals:**
- Fixing omelette's tree-traversal bug upstream.
- Adding completions for any flags not currently in the tree (e.g. `--no-color`, `--no-progress`).
- Changing the generated bash/zsh/fish completion scripts.
- Modifying any other source file.

## Decisions

### Decision: Early `--compgen` intercept instead of patching omelette's tree traversal

**Chosen**: Before calling `completion.init()`, inspect `process.argv` for `--compgen`. When found, extract the `prev` word (the word immediately before the cursor, passed as the third argument to the compgen invocation: `pixdom --compbash --compgen N prev line`) and call a local `getCompletionsForPrev(prev)` function that returns the correct candidate list. Write the result to stdout and exit immediately — `completion.init()` is never reached for this path.

**Alternatives considered**:
1. **Patch the omelette tree to use nested objects instead of arrays for values** — omelette's `reduce()` expects the terminal node to be an array, but traversal crashes when trying to descend into it as an object. Rearranging the tree to use `{ 'linkedin-post': {} }` shaped nodes would change the traversal path but would require keeping value lists in a parallel structure and is fragile against future omelette updates.
2. **Replace omelette entirely** — would require rewriting the bash/zsh completion script generation and all the `--compbash`/`--compzsh` protocol handling. Much larger change, higher risk.
3. **Patch `completion.init()` output with a wrapper** — monkey-patching a CommonJS-loaded library is brittle and hard to maintain.

The early intercept is the smallest possible change: omelette's `init()` still handles Layer 1 and Layer 2 (which work correctly), and the intercept only fires for the `--compgen` invocation that Layer 3 requires.

### Decision: `prev` word position in `process.argv`

The shell invokes: `pixdom --compbash --compgen <N> <prev> <line>`

`process.argv` is: `['node', 'pixdom', '--compbash', '--compgen', N, prev, line]`

`prev` is at index `compgenIdx + 2` (skip N). This is the word immediately before the cursor — the flag name whose value the user is completing. `getCompletionsForPrev()` switches on this value.

### Decision: `getCompletionsForPrev()` covers only known flag values; defaults to `[]`

For flags with free-text or numeric values (`--url`, `--html`, `--width`, `--height`, `--quality`, `--fps`, `--duration`, `--output`, `--selector`, `--file`, `--image`), return `[]`. An empty write to stdout causes the shell's completion function to fall through to its native filename/empty behavior — the same outcome as before the fix for those flags. The function also handles subcommand-level completions (`pixdom`, `convert`, `completion`, `mcp`) for completeness.

## Risks / Trade-offs

**`prev` positional assumption may be wrong for some shell invocations** → The bash and zsh scripts in `generateCompletionScript()` both pass `pixdom --compbash --compgen "$((COMP_CWORD - ...))" "$prev" "${COMP_LINE}"` (or `--compzsh` variant). The `prev` variable in both scripts is always the word immediately before the cursor, which is exactly what we switch on. The positional assumption is safe for the generated scripts. If omelette's protocol changes, the intercept degrades gracefully to returning `[]`.

**Layer 1 / Layer 2 still go through omelette `init()`** → The try/catch guard remains. If omelette crashes on Layer 1 or Layer 2 traversal in a future version, the existing fallback (`process.exit(0)` with empty stdout) still applies. The early intercept does not change this path.

**`--compgen` flag collision** → `--compgen` is omelette's own internal flag injected by the generated scripts. If a future omelette version changes the flag name, the intercept won't fire and Layer 3 will fall back to the old broken behavior. No regression beyond current state.

## Migration Plan

1. Add `getCompletionsForPrev()` function above `registerCompletion()`.
2. Inside `registerCompletion()`, insert the `--compgen` intercept block immediately before `const completion = omelette(...)`.
3. Rebuild `apps/cli` only (`pnpm --filter @pixdom/cli build` or equivalent).
4. Smoke-test: `pixdom --compbash --compgen 3 --profile "pixdom convert --profile "` should print 22 slugs.
5. Rollback: revert the two added blocks in `completion.ts` and rebuild.

## Open Questions

_(none — implementation is fully specified by the fix description)_
