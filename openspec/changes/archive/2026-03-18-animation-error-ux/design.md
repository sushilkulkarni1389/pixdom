## Context

The CLI currently writes errors via `process.stderr.write(\`Error: ${result.error.message} (code: ${result.error.code})\n\`)` and exits 1. This single line gives users no recovery path. The error codes (`NO_ANIMATION_DETECTED`, `SELECTOR_NOT_FOUND`, `CAPTURE_FAILED`, etc.) are typed in `packages/core/src/errors.ts` but the human-readable content is wholly absent from the system. The formatter, validation, and hint logic all belong in the CLI layer — `packages/core` stays clean of UX concerns.

Current error path:
- `render()` returns `{ ok: false, error: { code, message } }`
- CLI writes raw message + code to stderr

Target error path:
- CLI captures `process.argv` before `program.parse()`
- On render error, passes `{ error, argv }` to `formatError()`
- `formatError()` looks up the registered template, reconstructs example from argv, optionally runs async hint (for `NO_ANIMATION_DETECTED`), and writes the five-field block to stderr

## Goals / Non-Goals

**Goals:**
- Every `RenderErrorCode` has a registered template with title, explanation, fix, and optional example
- `INVALID_FILE_TYPE`, `FILE_NOT_FOUND`, `IMAGE_NOT_FOUND`, `SHARP_ERROR` added as new error codes
- File type + existence validation at CLI parse time (before browser launch)
- Animation cycle hint injected into the `NO_ANIMATION_DETECTED` message
- `--no-color` / `NO_COLOR` suppresses ANSI escape codes
- Unknown codes fall back to a generic template rather than silently producing a bad UX

**Non-Goals:**
- Internationalisation / localisation
- Machine-readable JSON error output mode
- Error telemetry or reporting
- Adding UX logic to `packages/core` — the core remains a pure Result-returning library

## Decisions

### 1. Error formatter lives entirely in the CLI layer
**Decision**: `apps/cli/src/error-formatter.ts` contains all templates and formatting logic. `packages/core` stays unchanged except for new error codes.

**Rationale**: Core is a library; its callers decide how to present errors. Mixing UX into core would couple it to terminal output assumptions (color, line width, locale). The MCP server is a separate caller and will format differently.

**Alternative considered**: A shared `@pixdom/error-messages` package — rejected because only the CLI needs human-readable terminals output at this time.

### 2. Argv reconstruction for example line
**Decision**: `process.argv.slice(2)` is captured before `program.parse()` and stored. The error formatter receives it as `originalArgv: string[]`. Templates specify which flag to splice/replace to produce the corrected command.

**Rationale**: Commander does not expose the raw argv after parse; we need it before mutation. Templates specify a `correction` that names the flag and its replacement value; the formatter replaces or inserts it into the original argv array.

**Alternative considered**: Reconstructing from Commander's parsed opts — rejected because Commander normalises defaults and loses the original tokens.

**Limitation**: Example is omitted when the correction is non-trivial (FFMPEG_ERROR, SHARP_ERROR, PLAYWRIGHT_ERROR) — those cases have no safe single-flag fix to surface.

### 3. Animation cycle hint runs before error is returned
**Decision**: When `NO_ANIMATION_DETECTED` would be returned, `render()` calls `scanForCycleLengths(pageContent)` first (a pure regex scan on the already-fetched HTML string), then includes up to 3 candidate hints in the `RenderError.hints` field (new optional field).

**Rationale**: The hint is specific to the animation renderer path and requires the page content that is already available in `render()`. Pushing this to the CLI would require passing a page handle out of core, which breaks encapsulation. Adding `hints?: string[]` to `RenderError` is a minimal, backwards-compatible extension.

**Alternative considered**: CLI-layer hint generation using a separate Playwright session — rejected because it doubles browser launch overhead.

**Implementation**: `scanForCycleLengths(html: string): string[]` is a pure function in `packages/core/src/animation-cycle-hint.ts`. It applies 3 regex passes (CSS `animation-duration`, JS variable assignment, rAF comparison), converts candidates to ms, deduplicates, returns top-3 by pattern confidence order.

### 4. File existence and type validation at CLI parse time
**Decision**: In `convertAction()`, before calling `render()`:
1. If `--file` or `--image` is set, check `fs.access(path)` — emit `FILE_NOT_FOUND` / `IMAGE_NOT_FOUND` on failure.
2. Check file extension against allowed lists — emit `INVALID_FILE_TYPE` on mismatch.
3. If extension is absent or `.bin`-style ambiguous, sniff first 4 bytes.

**Rationale**: Failing fast (before browser launch) gives a better UX — no 3–5 second Playwright cold start before hitting an obvious input error.

**MIME sniff byte patterns:**
- PNG: `\x89PNG`
- JPEG: `\xFF\xD8`
- WebP: `RIFF` (bytes 0–3) + `WEBP` (bytes 8–11)
- GIF: `GIF8`
- HTML: check for `<!`, `<html`, or `<head` in first 512 bytes (text sniff)

### 5. ANSI color handling
**Decision**: Use a minimal inline ANSI helper (no new dependency). `formatError()` accepts a `color: boolean` parameter derived from `--no-color` flag or `process.env.NO_COLOR !== undefined` or `!process.stdout.isTTY`.

**Rationale**: Avoids adding a chalk/kleur dependency for ~5 color codes. The helper is ~10 lines.

**Alternative considered**: `chalk` — rejected to keep the CLI dependency surface small.

## Risks / Trade-offs

- **Hint false positives**: The cycle scanner may surface a JS variable named `duration` that is unrelated to the animation. → Mitigation: label hints as "possible cycle length" (not "cycle length"), let users verify. Never fabricate a `--duration` invocation without a hint.
- **Argv reconstruction edge cases**: Flags with spaces or quoted values may not round-trip perfectly through argv slice/join. → Mitigation: the `Example:` line is advisory, not executable. Wrap in a note: "Approximate — adjust for your shell."
- **New error codes breaking MCP callers**: Adding codes to `RenderErrorCode` is additive. MCP currently uses `result.error.code` in a switch; unknown codes fall to a default. → Mitigation: acceptable non-breaking change; MCP default arm already handles unknown codes.
- **`RenderError.hints` field**: Adding an optional field to `RenderError` is backwards-compatible. Callers that destructure only `{ code, message }` are unaffected.

## Migration Plan

1. Add new error codes to `@pixdom/types` and `packages/core/src/errors.ts`
2. Add `hints?: string[]` to `RenderError` interface
3. Add `scanForCycleLengths()` to `packages/core` and wire into animated renderer
4. Add `IMAGE_NOT_FOUND` / `SHARP_ERROR` to image renderer; `FILE_NOT_FOUND` to render() for file inputs
5. Add `apps/cli/src/error-formatter.ts` with all templates
6. Add file existence + type validation to `convertAction()`
7. Wire `--no-color` flag and argv capture in CLI entry point
8. Replace the single `process.stderr.write` error line in CLI with `formatError()` call
