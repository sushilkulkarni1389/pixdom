## Why

Pixdom currently outputs terse single-line errors like `Error: No animation detected (code: NO_ANIMATION_DETECTED)` that tell users what went wrong but not what to do about it. Users with no prior context — new CLI users, CI pipelines, integration testers — have no next step. This change replaces every error message with a structured, actionable format: title, explanation, recovery instruction, concrete corrected example, and optional auto-detected hints (e.g. possible cycle lengths for animation failures).

## What Changes

- New structured error formatter in the CLI layer with a five-field layout: title, `What happened`, `How to fix`, `Example` (reconstructed from original argv), `Docs`
- New `INVALID_FILE_TYPE` error code in `@pixdom/types` for unsupported file extensions on `--file` and `--image`
- Two new error codes: `FILE_NOT_FOUND` and `IMAGE_NOT_FOUND` for missing file inputs; `SHARP_ERROR` for Sharp processing failures
- Extension-based file type validation in the CLI at parse time (before any browser launch), with MIME sniff fallback for extension-less or ambiguous files
- Animation cycle auto-hint: when `NO_ANIMATION_DETECTED` fires, scan the page source for cycle length patterns (CSS `animation-duration`, JS variable assignments, rAF comparisons) and surface up to 3 candidates as hints
- `--no-color` flag and `NO_COLOR` env var support to suppress ANSI formatting
- All existing error codes get registered message templates; unknown codes fall back to a generic bug-report template

## Capabilities

### New Capabilities

- `error-formatter`: Structured CLI error output system — five-field format, ANSI color, `--no-color`/`NO_COLOR` support, argv reconstruction for corrected example lines, generic fallback for unknown codes
- `animation-cycle-hint`: Page source scanner for cycle length candidates used as hints when `NO_ANIMATION_DETECTED` fires
- `file-type-validation`: CLI-layer extension and MIME-sniff validation for `--file` and `--image` inputs before rendering begins

### Modified Capabilities

- `render-pipeline`: New error codes added (`INVALID_FILE_TYPE`, `FILE_NOT_FOUND`, `IMAGE_NOT_FOUND`, `SHARP_ERROR`) to `RenderErrorCode` union; `FILE_NOT_FOUND` and `IMAGE_NOT_FOUND` emitted by `render()` when input paths do not exist
- `cli-convert-command`: File type validation before `render()` call; `--no-color` flag wired to formatter; original argv captured and passed to error formatter; structured error output replaces current terse `process.stderr.write`
- `image-passthrough-renderer`: Emits `SHARP_ERROR` instead of `CAPTURE_FAILED` for Sharp processing failures; emits `IMAGE_NOT_FOUND` if input file is missing

## Impact

- `packages/types/src/index.ts` — new error codes added to `RenderErrorCode` union
- `packages/core/src/errors.ts` — updated union
- `packages/core/src/image-renderer.ts` — `IMAGE_NOT_FOUND` and `SHARP_ERROR` error codes
- `packages/core/src/index.ts` — `FILE_NOT_FOUND` check for `file`/`url`-adjacent input paths where applicable
- `apps/cli/src/index.ts` — file type validation, argv capture, `--no-color` flag, structured error output
- `apps/cli/src/error-formatter.ts` — new file: message templates + formatter function
- `apps/cli/src/animation-cycle-hint.ts` — new file: page source scanner (used internally by core before throwing `NO_ANIMATION_DETECTED`)
- No new npm dependencies required (regex-based scanning; ANSI via manual escape codes or existing terminal detection)
