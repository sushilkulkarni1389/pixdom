## ADDED Requirements

### Requirement: auto field in RenderOptions
`RenderOptionsSchema` SHALL include an optional `auto?: boolean` field. When omitted it SHALL default to `false` or `undefined`. When `true`, `render()` SHALL run auto-detection before renderer dispatch.

#### Scenario: auto accepted in RenderOptions
- **WHEN** `RenderOptionsSchema.parse({ ..., auto: true })` is called
- **THEN** the schema parses successfully with `auto === true`

#### Scenario: auto omitted does not break existing calls
- **WHEN** `RenderOptionsSchema.parse({ input, format, viewport })` is called without `auto`
- **THEN** the parsed value has `auto` equal to `undefined` or `false` and no validation error is thrown

### Requirement: auto-detection pre-render dispatch
When `options.auto === true` and `options.input.type !== 'image'`, `render()` SHALL, after page load and before renderer dispatch, execute the following in order:
1. Call `autoDetectElement(page)` unless `options.selector` is already set — inject result into `options.selector`
2. Call `autoDetectDuration(page, options.selector)` unless `options.duration` is already set — inject result as `cycleMs`
3. Call `autoDetectFps(page, options.selector, cycleMs)` unless `options.fps` is already set — inject result as `fps`
4. Emit `{ type: 'auto-detected', element: selector | null, duration: durationMs | null, fps, frames }` via `onProgress`

When `options.auto === true` and `options.input.type === 'image'`, `render()` SHALL emit a warning via `onProgress` and proceed without auto-detection.

#### Scenario: auto=true injects detected selector into options
- **WHEN** `render({ auto: true, input: { type: 'html', html: '...' }, format: 'gif' })` is called on a page where `autoDetectElement` returns `{ selector: '#card', width: 350, height: 520 }`
- **THEN** `options.selector` is set to `'#card'` before the renderer is called

#### Scenario: explicit --selector overrides auto-element-detection
- **WHEN** `render({ auto: true, selector: '#manual', ... })` is called
- **THEN** `autoDetectElement` is NOT called and `options.selector` remains `'#manual'`

#### Scenario: auto=true with no animation detected uses static renderer for animated format
- **WHEN** `render({ auto: true, format: 'gif', ... })` is called and `autoDetectDuration` returns `null`
- **THEN** `render()` calls the static renderer (producing PNG) and emits a warning rather than returning `NO_ANIMATION_DETECTED`

#### Scenario: auto=true with image input proceeds without detection
- **WHEN** `render({ auto: true, input: { type: 'image', path: '...' }, format: 'png' })` is called
- **THEN** `autoDetectElement` is NOT called and the image passthrough renderer is invoked normally

#### Scenario: auto-detected ProgressEvent emitted before renderer
- **WHEN** `render({ auto: true, ... }, { onProgress: handler })` is called
- **THEN** `handler` receives `{ type: 'auto-detected', element, duration, fps, frames }` before any `step-start 'capture-frames'` event

### Requirement: auto-detected ProgressEvent variant
`ProgressEvent` SHALL include a new variant `{ type: 'auto-detected'; element: string | null; duration: number | null; fps: number; frames: number }`. The `element` field is the detected CSS selector or `null` if full-viewport fallback was used. The `duration` field is the detected cycle in ms or `null` if no animation was found. `fps` and `frames` are the selected FPS and resulting frame count.

#### Scenario: ProgressEvent type includes auto-detected variant
- **WHEN** TypeScript code does `import type { ProgressEvent } from '@pixdom/core'`
- **THEN** the `auto-detected` variant is accessible with all four fields

#### Scenario: auto-detected frames is fps × duration/1000
- **WHEN** auto-detection resolves to `{ duration: 3500, fps: 24 }`
- **THEN** the emitted `auto-detected` event has `frames: 84`
