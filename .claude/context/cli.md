# Layer 6 — CLI App
Load ONLY when working on Layer 6 — CLI App tasks.

## Goal
Implement the Commander.js CLI with all v1 flags, stdin support, progress output, and profile selection.

## Folder / File Structure to Create

```
apps/cli/src/
├── commands/
│   ├── convert.ts         # `convert` command
│   └── list-profiles.ts   # `list-profiles` command
├── input.ts               # resolve CLI args → RenderInput
├── output.ts              # resolve output path, --stdout handling
├── progress.ts            # ora spinner + step labels
└── index.ts               # entrypoint — register commands, exit codes
```

## CLI Flags — `convert` Command

```
--html <string>         Inline HTML string
--file <path>           Path to .html file
--url <url>             URL to fetch and render
--format <fmt>          png | jpeg | webp | gif | mp4 (required)
--output <path>         Output file path (required unless --stdout)
--stdout                Write binary output to stdout
--profile <id>          instagram | twitter | linkedin | square
--width <px>            Override width
--height <px>           Override height
--duration <ms>         Animation duration hint in ms
--fps <n>               Frames per second (default: 30)
```

## Input Resolution Priority

1. `--html` → `{ type: 'inline', value: html }`
2. `--file` → `{ type: 'file', value: resolvedAbsPath }`
3. `--url` → `{ type: 'url', value: url }`
4. stdin (piped) → `{ type: 'inline', value: stdinContent }`
5. None → print error + usage, exit 1

## Exit Codes

- `0` — success
- `1` — user error (bad flags, missing required args)
- `2` — render error (Playwright, FFmpeg, Sharp failure)
- `3` — network error (URL unreachable)

## Hard Rules

- `convert.ts` imports `render` from `@html2asset/core` — never imports Playwright or FFmpeg directly
- `progress.ts` writes to `stderr` only — `stdout` reserved for binary output when `--stdout` set
- All CLI flags validated with Zod before calling `render()`

## Definition of Done

- `html2asset convert --html "<h1>hi</h1>" --format png --output ./out.png` exits 0
- `html2asset list-profiles` prints all 4 profiles in aligned table
- `html2asset convert` (no args) prints help and exits 1
- `echo "<h1>hi</h1>" | html2asset convert --format png --output ./out.png` works via stdin
- `--help` shows all flags with descriptions
