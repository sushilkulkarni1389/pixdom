## Context

`cssMaxDuration` iterates all DOM elements and returns the maximum of `animationDuration` and `transitionDuration`. The bug: it treats both identically, so a button with `transition: background 0.2s ease` contributes `200` to the max, which `detectAnimationCycle` returns as the cycle — causing `render()` to flag the page as animated.

Current inner loop (simplified):
```ts
for (const raw of [style.animationDuration, style.transitionDuration]) {
  const ms = parseToMs(raw);
  if (ms > max) max = ms;
}
```

The fix is a one-line filter inside `page.evaluate()`.

## Goals / Non-Goals

**Goals:**
- Short UI hover transitions (`< 500ms`) are ignored when the element has no `animationDuration`
- Real CSS keyframe animations (`animation-duration > 0`) are always counted regardless of length
- Long transitions (`>= 500ms`) continue to be counted as animation cycles
- Fix is minimal — no new functions, no new exports, no behaviour change outside `cssMaxDuration`

**Non-Goals:**
- Filtering by animation `play-state` (paused vs. running) — too complex for v1
- Per-property transition filtering (targeting only `opacity` vs. `color` etc.)
- Configurable threshold — 500ms is hardcoded; no user-facing parameter

## Decisions

### 1. Threshold of 500ms
**Decision**: Ignore `transitionDuration` < 500ms unless `animationDuration > 0` on the same element.
**Rationale**: Standard UI micro-interactions are ≤ 300ms (Material Design, HIG). 500ms provides headroom. A threshold below this is almost certainly a hover effect, not a content animation cycle. Transitions ≥ 500ms (e.g., slide-in panels, page transitions) are plausibly intentional content animations worth capturing.

### 2. Per-element check (not a global filter)
**Decision**: The threshold is applied per-element: if an element has `animationDuration > 0`, its `transitionDuration` is also counted (the element is definitely animated).
**Rationale**: An element running both a keyframe animation and a long transition should have its full duration counted. Splitting the two into separate loops enables this.

### 3. Change confined to `cssMaxDuration` inside `page.evaluate()`
**Decision**: The threshold logic lives entirely inside the `page.evaluate()` callback.
**Rationale**: No serialisation complexity. The threshold constant (500) is a primitive, safe to capture in the closure passed to `evaluate`. No new exported helpers needed.

## Risks / Trade-offs

- **500ms cutoff may be wrong for some designs** — a site with `transition: transform 0.4s` for a drawer animation would now be missed by CSS detection and fall through to rAF sampling. Mitigation: rAF sampling still catches JS-driven and mutation-heavy animations; pure-CSS 400ms transitions on static pages are unusual enough that returning `null` is the correct behaviour.
- **No test suite yet** — correctness is verified manually. Mitigation: the spec scenarios are explicit and serve as acceptance criteria when tests are added.
