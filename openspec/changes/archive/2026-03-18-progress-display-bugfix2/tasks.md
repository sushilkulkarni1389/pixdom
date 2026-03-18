## 1. Core — ProgressEvent encode-done type

- [x] 1.1 Add `{ type: 'encode-done'; format: string }` variant to `ProgressEvent` in `packages/core/src/progress.ts`

## 2. Animated renderer — percent clamp, encode-done, write-output

- [x] 2.1 In `ffmpegEncode()`, clamp percent before emitting: `Math.min(100, Math.round(p.percent ?? 0))`
- [x] 2.2 In `encodeGif()` pass-2 inline `ffmpeg()` block, add the same clamped `.on('progress')` handler
- [x] 2.3 In `renderAnimated()`, emit `{ type: 'encode-done', format: options.format.toUpperCase() }` after each `encode*()` call returns
- [x] 2.4 In `renderAnimated()`, emit `step-start 'write-output'` before `fs.readFile(outPath)` and `step-done 'write-output'` after (wrap each encode branch)

## 3. Static renderer — write-output events

- [x] 3.1 In `renderStatic()`, emit `step-start 'write-output'` before the Sharp `.toBuffer()` call and `step-done 'write-output'` after it resolves (for all three format branches)

## 4. Image renderer — write-output events

- [x] 4.1 In `renderImage()`, emit `step-start 'write-output'` before the Sharp `.toBuffer()` call and `step-done 'write-output'` after it resolves (for all three format branches)

## 5. Reporter — encode-done handler and write-output label

- [x] 5.1 Add `'write-output': 'Writing output'` to `STEP_LABELS` in `progress-reporter.ts`
- [x] 5.2 Add `encode-done` case to `onProgress` switch: call `spinner.succeed(\`Encoding ${event.format} (100%)\`)` and set `spinner = null`

## 6. Verification

- [x] 6.1 Run `pnpm --filter @pixdom/core build` — no TypeScript errors
- [x] 6.2 Run `pnpm --filter pixdom build` — no TypeScript errors
