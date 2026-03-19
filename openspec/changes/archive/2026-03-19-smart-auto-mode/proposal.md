## Why

Running `pixdom convert` on a real page currently requires the user to inspect the DOM for the right selector, measure the animation cycle manually, and guess an appropriate FPS — three distinct steps that require technical knowledge and trial-and-error. A single `--auto` flag that detects element, duration, and FPS automatically eliminates all three friction points and makes pixdom useful for first-time users and batch workflows.

## What Changes

- **New `--auto` flag** on `pixdom convert` — activates element detection, duration detection, and FPS selection simultaneously
- **Auto-selector**: scores all visible block-level elements by area × centrality − depth penalty; picks the winner; falls back to full-viewport if ambiguous
- **Auto-duration**: multi-source LCM strategy — CSS `animation-duration` LCM first, `transition-duration` fallback, source pattern scan last; falls back to static PNG if nothing found
- **Auto-FPS**: selects 24fps for easing animations, 12fps for linear/transition/canvas; reduces automatically if frame count would exceed 1200
- **Auto-summary**: prints a pre-render summary block to stderr listing element, duration, FPS, and frame count
- **New progress steps**: "Analysing page" and "Detecting animations" appear in TTY output when `--auto` is active
- **`auto` field in `RenderOptions`**: added as optional boolean; threaded from CLI through `render()` into pre-render detection flow
- `--auto` is incompatible with `--image` (warns and ignores); `--selector`, `--duration`, `--fps` always override their respective auto-detected values

## Capabilities

### New Capabilities

- `auto-element-detection`: DOM scoring algorithm that identifies the single most prominent content element using area, centrality, and depth; runs via `page.evaluate()` in `@pixdom/detector`
- `auto-fps-selection`: FPS selection logic that inspects detected CSS timing functions to choose between 12fps and 24fps, with a frame-count ceiling guard; exported from `@pixdom/detector`

### Modified Capabilities

- `animation-cycle-detection`: New LCM multi-source strategy replaces the simple max-duration approach — CSS `animation-duration` LCM (capped at 10 000ms) → `transition-duration` fallback → source-pattern scan; auto-mode also triggers static PNG fallback when no animation is found
- `render-pipeline`: New optional `auto?: boolean` field in `RenderOptionsSchema`; when `true`, `render()` runs auto-element-detection and auto-duration/fps detection before renderer dispatch and injects results into options
- `cli-convert-command`: New `--auto` global flag wired into `RenderOptions.auto`; auto-summary printed to stderr before render begins; incompatibility warning when combined with `--image`
- `progress-display`: Two new conditional progress steps — `'analyse-page'` (auto-selector) and `'detect-animations'` (auto-duration + auto-fps) — shown only when `--auto` is active, appearing after "Loading page" and before "Capturing frames"

## Impact

- `packages/detector/src/index.ts`: new exports `autoDetectElement()`, `autoDetectFps()`; modified `detectAnimationCycle()` internal strategy
- `packages/types`: `auto?: boolean` added to `RenderOptionsSchema`
- `packages/core/src/index.ts`: auto-detection pre-render branch in `render()`; new `ProgressEvent` variants for auto steps
- `apps/cli/src/index.ts`: `--auto` flag, auto-summary stderr block, incompatibility guard
- `apps/cli/src/progress-reporter.ts`: `STEP_LABELS` extended with `'analyse-page'` and `'detect-animations'`
