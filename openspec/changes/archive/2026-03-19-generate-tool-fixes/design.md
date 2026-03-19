## Context

Two bugs were confirmed through testing of the `generate_and_convert` MCP tool.

**Bug 1 — Preamble text in rendered output**: The Claude API response is extracted with a simple `.filter(type === 'text').join('')`. When the model includes a conversational opener, markdown fences (` ```html `), or trailing comments alongside the HTML, all of that text reaches `page.setContent()` and is rendered as visible DOM text nodes at the top of the screenshot. The system prompt instructs the model to output only HTML, but this cannot be fully relied upon.

**Bug 2/3 — Auto element detection overrides profile viewport**: `autoDetectElement()` returns a DOM element's bounding box. That element's `ElementHandle` is passed to `captureFrames()`, which uses `element.screenshot()`. This captures only the element's natural bounds (e.g., 800×600) — ignoring the profile viewport (e.g., 1200×1200 for `linkedin-post`). The bug occurs whenever `auto:true` and a profile are both set and an element is detected.

The two bugs are independent and fixed independently.

## Goals / Non-Goals

**Goals:**
- Strip markdown fences and preamble from Claude API HTML responses before passing to `render()`
- Return a structured `GENERATE_EMPTY_HTML` error if extraction yields no usable HTML
- When a profile is set, use full-page `page.screenshot()` at profile viewport — not element-level capture
- Auto element detection still runs for timing purposes (duration, fps) even when profile is set
- No change to auto behaviour when neither profile nor explicit selector is set

**Non-Goals:**
- Changing the Claude model or system prompt (a prompt engineering approach is insufficient as a sole fix)
- Modifying `autoDetectElement()` itself — the detection algorithm is correct; only how its result is used changes
- Fixing `autoSize` (distinct feature, not involved in these bugs)
- Changing the MCP tool's response schema or the CLI interface

## Decisions

### D1 — HTML extraction as a pure function in the MCP server layer

The extraction logic lives in `apps/mcp-server/src/index.ts` (or a sibling helper), not in `packages/core`. The core `render()` function accepts pre-validated HTML; it is not responsible for cleaning Claude API output. This keeps concerns separated and avoids coupling the render pipeline to LLM response quirks.

**Extraction algorithm:**
1. Strip markdown code fences — remove ` ```html ` … ` ``` ` wrappers (regex: `` /^```(?:html)?\s*\n?/gm `` on opening, `` /\n?```\s*$/gm `` on closing)
2. Find the first HTML boundary — `indexOf('<!DOCTYPE')`, `indexOf('<html')`, `indexOf('<')` — and slice from there
3. Trim whitespace
4. If result length < 50 characters, return `GENERATE_EMPTY_HTML` error

Alternative considered: fix at the system prompt level only. Rejected — model output is non-deterministic and cannot be guaranteed.

Alternative considered: put extraction in `packages/core`. Rejected — `core` should not know about Anthropic response formats.

### D2 — `profileViewport` flag on `RenderOptions` to separate timing from capture

A new optional boolean field `profileViewport?: boolean` is added to `RenderOptions` (and its Zod schema in `packages/types`). When `true`, it signals that the viewport dimensions are profile-locked and the renderer must not override them with an auto-detected element's bounding box.

In `render()`:
- Auto-detection still calls `autoDetectElement()` to get a selector for timing purposes
- The detected selector is passed to `autoDetectDuration()` and `autoDetectFps()` as before
- BUT: when `options.profileViewport === true`, the detected selector is NOT assigned to `autoEffectiveSelector` for the purpose of `elementHandle` resolution — only explicit `options.selector` drives element-level capture
- The renderer receives `elementHandle = undefined`, so `page.screenshot()` is used at the full profile viewport

**Why `profileViewport` over inferring from viewport size:**
Inferring ("if width !== 1280, skip element capture") is fragile — a user could pass a custom `width: 1200` without a profile, and we'd wrongly suppress element detection. An explicit flag is unambiguous and testable.

**Why not a new `autoMode: 'timing-only' | 'full'` enum:**
Overengineered for two states. Boolean flag is sufficient and easier to type-check.

In `generate_and_convert` handler: when `profile` param is set, pass `profileViewport: true` to `render()`. When no profile is set, omit the field (preserving existing behaviour).

Alternative considered: pass `elementHandle` always but resize it to profile dimensions in the renderer. Rejected — `element.screenshot()` captures the element's layout bounds; resizing after the fact degrades quality and complexity.

### D3 — `GENERATE_EMPTY_HTML` error added to MCP error map

The new error code is handled in the `generate_and_convert` catch block and returns `{ isError: true }` with a `howToFix` pointing the user to rephrase their prompt. It does not propagate to `packages/core` since it is MCP-layer only.

## Risks / Trade-offs

**[Risk] Extraction strips valid `<` characters from non-HTML preamble that is part of the actual content** → Mitigation: the slice starts at the first `<` that begins an HTML tag; the regex is anchored to structural HTML markers (`<!DOCTYPE`, `<html`, or any `<`). Edge case: a prompt response whose HTML itself starts without any HTML tag (bare body content). In that case, we fall back to slicing from first `<`, which is correct for any HTML fragment. The 50-char minimum guards against degenerate cases.

**[Risk] `profileViewport: true` suppresses element capture even when the user wants element-level output within a profile** → Mitigation: explicit `--selector` overrides this — when the user provides a selector, `elementHandle` is always resolved regardless of `profileViewport`. The flag only suppresses the *auto-detected* element from driving capture.

**[Risk] Auto-detected selector used for duration detection may not exist in the DOM at capture time** → Not a new risk; already present. `autoDetectDuration` is a read-only CSS property query; it does not interact with `elementHandle`.

## Open Questions

None — design is fully determined by the bug reports and existing code structure.
