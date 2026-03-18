## 1. Types — selector field and SELECTOR_NOT_FOUND

- [x] 1.1 Add `selector: z.string().optional()` to `RenderOptionsSchema` in `packages/types/src/index.ts`
- [x] 1.2 Add `'SELECTOR_NOT_FOUND'` to the error code union (wherever `RenderError` codes are defined in `packages/types`)
- [x] 1.3 Run `pnpm --filter @pixdom/types build` to emit updated `.d.ts` files

## 2. Core — element resolution in render()

- [x] 2.1 In `packages/core/src/index.ts`, after page load and before renderer dispatch, check `options.selector`
- [x] 2.2 If `options.selector` is set and `input.type !== 'image'`, call `page.$$(selector)` to get all matches
- [x] 2.3 If zero matches or the matched element's `boundingBox()` returns `null`, return `{ ok: false, error: { code: 'SELECTOR_NOT_FOUND', message: "Selector '<selector>' matched no elements in the page" } }`
- [x] 2.4 If more than one match, write a warning to stderr and use the first element
- [x] 2.5 Skip `autoSize` viewport detection when `options.selector` is set
- [x] 2.6 Pass the resolved `ElementHandle | undefined` into the static renderer call
- [x] 2.7 Pass the resolved `ElementHandle | undefined` into the animated renderer call

## 3. Static renderer — element.screenshot()

- [x] 3.1 Update the static renderer function signature in `packages/core` to accept an optional `ElementHandle` parameter
- [x] 3.2 When the `ElementHandle` is provided, call `element.screenshot({ type: 'png' })` instead of `page.screenshot({ type: 'png', fullPage: false })`
- [x] 3.3 When no `ElementHandle` is provided, leave existing `page.screenshot()` behaviour unchanged

## 4. Animated renderer — element.screenshot() per frame

- [x] 4.1 Update the animated renderer function signature to accept an optional `ElementHandle` parameter
- [x] 4.2 Compute `element.boundingBox()` once before the frame loop begins (when handle is provided)
- [x] 4.3 In the frame loop, call `element.screenshot({ type: 'png' })` per frame instead of `page.screenshot({ type: 'png' })` when the handle is set
- [x] 4.4 When no `ElementHandle` is provided, leave existing `page.screenshot()` per-frame behaviour unchanged

## 5. CLI — --selector flag and warning logic

- [x] 5.1 Add `--selector <css>` as an optional string option to the `convert` subcommand in `apps/cli/src/index.ts`
- [x] 5.2 Pass `selector` value into the `RenderOptions` object passed to `render()`
- [x] 5.3 When `--selector` is provided alongside `--width`, write a warning to stderr that `--width` is ignored and do not pass `viewport.width` override
- [x] 5.4 When `--selector` is provided alongside `--height`, write a warning to stderr that `--height` is ignored and do not pass `viewport.height` override
- [x] 5.5 When `--selector` is provided alongside `--auto-size`, silently set `autoSize` to `false` (or omit it)
- [x] 5.6 When `--selector` is provided alongside `--image`, write a warning to stderr that `--selector` is ignored for image inputs, and proceed without setting `selector` in `RenderOptions`

## 6. Verification

- [x] 6.1 Run `pnpm --filter @pixdom/types build` and `pnpm --filter @pixdom/core build` — confirm no TypeScript errors
- [x] 6.2 Run `pnpm --filter @pixdom/cli build` — confirm no TypeScript errors
- [x] 6.3 Smoke-test: `pixdom convert --html "<div id='box' style='width:100px;height:100px;background:red'></div>" --selector "#box" --output /tmp/box.png` — confirm output PNG is ~100×100
- [x] 6.4 Smoke-test: `pixdom convert --html "<div></div>" --selector "#missing"` — confirm exit code non-zero and stderr contains `SELECTOR_NOT_FOUND`
- [x] 6.5 Smoke-test: `pixdom convert --html "..." --selector "#x" --width 1280` — confirm stderr warning about `--width` being ignored
