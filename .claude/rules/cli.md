---
paths:
  - "apps/cli/**/*.ts"
---

# Rules — CLI App

1. All CLI flags MUST be validated with Zod before calling `render()`.
2. Progress output (spinner, steps) MUST write to `stderr` only.
3. Binary `--stdout` output MUST write to `process.stdout` with no other writes to stdout.
4. `convert.ts` MUST NOT import Playwright, FFmpeg, or Sharp directly.
5. Exit codes: 0=success, 1=user error, 2=render error, 3=network error — no other codes.
6. Stdin detection: check `!process.stdin.isTTY` — read piped content before parsing flags.
7. `--file` paths MUST be resolved to absolute paths with `path.resolve()` before use.
8. Help text MUST show all flags — use `.description()` on every Commander option.
9. Never `process.exit()` inside command handlers — let the Commander error handling propagate.
10. `list-profiles` output MUST be formatted as a fixed-width table to stderr.
