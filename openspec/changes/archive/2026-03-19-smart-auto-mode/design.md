## Context

`pixdom convert` currently requires users to supply `--selector`, `--duration`, and `--fps` explicitly. For HTML animations created by others (e.g. festival cards, social media posts), users must inspect the DOM, read CSS keyframe durations, and estimate FPS — work that the tool itself could do. The `@pixdom/detector` package already performs rAF-based animation detection for non-auto use; this change extends it with element scoring and CSS-LCM duration analysis, and wires a new `--auto` flag through the full stack.

## Goals / Non-Goals

**Goals:**
- Single `--auto` flag covers element selection, duration detection, and FPS choice
- `--selector`, `--duration`, `--fps` always override their respective auto-detected values
- Auto-detection runs inside the already-open Playwright page — no extra browser launch
- Progress steps and stderr summary keep the user informed of what was detected
- No behavioral change to existing non-auto render paths

**Non-Goals:**
- Auto-detecting output format (user still specifies `--format`)
- Auto-detecting viewport dimensions beyond what `--auto-size` already provides
- Handling canvas/WebGL animations in auto-mode (rAF fallback covers JS-driven DOM mutations only)
- Making `--auto` work with `--image` input (no DOM available)

## Decisions

### Decision 1: Add `autoDetectDuration()` as a new export alongside `detectAnimationCycle()`, not a replacement

**Choice**: Keep `detectAnimationCycle()` unchanged. Add `autoDetectDuration(page, element?)` that implements the LCM multi-source strategy.

**Rationale**: `detectAnimationCycle()` is the established API used by non-auto render paths and is well-specified. Modifying it would be a breaking change to existing behavior. The auto-duration function has different semantics (scoped to element subtree, LCM vs max, cap at 10 000ms) so a new function is the right call.

### Decision 2: Auto-detection runs inside `render()` in `@pixdom/core`, not in the CLI

**Choice**: When `options.auto === true`, `render()` calls `autoDetectElement()`, `autoDetectDuration()`, and `autoDetectFps()` before renderer dispatch. The CLI only passes `auto: true` and prints the summary after the pre-render phase.

**Rationale**: The Playwright `Page` object is only available inside `render()`. Detection logic that needs `page.evaluate()` must run there. The CLI does not have access to the page.

**How the summary gets to the CLI**: `render()` fires new `ProgressEvent` variants — `{ type: 'auto-detected', element, duration, fps, frames }` — that the CLI's progress reporter catches and uses to print the summary block.

### Decision 3: Element scoring algorithm uses CSS selector generation, not ElementHandle passing

**Choice**: `autoDetectElement()` returns the CSS selector string (e.g. `"#card"`, `"main > .wrapper"`) for the winning element, derived inside `page.evaluate()`.

**Alternatives considered**:
- Return an `ElementHandle` directly: not serialisable across `page.evaluate()` boundaries without using `page.evaluateHandle()`, which adds complexity.
- Return bounding box only: loses the selector needed for subsequent `page.$(selector)` calls in the renderer.

**Rationale**: Returning a CSS selector is serialisable and is exactly what `render()` already expects for `options.selector`. The detected selector can be injected directly into `options.selector` before renderer dispatch.

### Decision 4: LCM cap at 10 000ms — use longest individual duration if exceeded, not the cap value itself

**Choice**: When LCM > 10 000ms, use `Math.max(...durations)` (the single longest CSS animation duration) instead of clamping to 10 000ms.

**Rationale**: A clamped 10 000ms cycle would cut off a 9 800ms + 3 500ms animation mid-cycle. The longest individual duration at least captures one full cycle of the slowest animation. A warning is always printed so the user can override with `--duration`.

### Decision 5: Auto-FPS selection based on timing function introspection

**Choice**: `autoDetectFps(page, element?)` queries `getComputedStyle` for `animation-timing-function` on the detected element subtree. If any non-linear timing function is found (`ease`, `ease-in`, `ease-out`, `ease-in-out`, `cubic-bezier(...)` that isn't `linear`), return 24. Otherwise return 12.

**Rationale**: 24fps visibly smooths easing curves over 12fps. Linear animations (e.g. a steady rotation) look identical at 12fps and are 50% smaller. Frame-count ceiling (1200 frames) prevents runaway output sizes regardless of the choice.

## Risks / Trade-offs

- **Selector generation may be fragile** → Elements without `id` or unique class names get path-based selectors (`:nth-child` chains). These work within the same page instance but are not stable across re-renders. Acceptable since the selector is only used within the same `render()` call. Mitigation: prefer `#id` → `.unique-class` → path-based in the generator.
- **LCM of many small durations can be huge** → e.g. 10 durations with coprime values. The 10 000ms cap and fallback to longest-individual handle this. Warn in output.
- **Page.evaluate timing** → If the page hasn't finished loading animations (web fonts, deferred JS), `getComputedStyle` may return `0s`. Mitigation: detection runs after `waitForLoadState('networkidle')` which is already the existing behavior.
- **`--auto` with `--image`** → No DOM to query. Mitigation: warn and ignore `--auto`, proceed as normal image conversion.
- **New ProgressEvent variants** → CLI progress reporter must handle unknown event types gracefully (already does via no-op fallthrough).

## Migration Plan

1. Add `autoDetectElement()` and `autoDetectFps()` to `packages/detector/src/index.ts`
2. Modify `autoDetectDuration()` strategy in `packages/detector/src/index.ts` (new export)
3. Add `auto?: boolean` to `RenderOptionsSchema` in `packages/types`
4. Add `auto-detected` ProgressEvent variant to `ProgressEvent` union in `packages/core`
5. Add auto-detection pre-render branch in `packages/core/src/index.ts`
6. Extend `STEP_LABELS` in `apps/cli/src/progress-reporter.ts`
7. Add `--auto` flag and auto-summary handler in `apps/cli/src/index.ts`
8. Build and smoke-test: `pixdom convert --file <animated-page.html> --format gif --auto`
